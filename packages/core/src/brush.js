import { clamp, hash, newSeed, noise, random, smoothstep } from './math.js';
import { BRUSHES, MAX_INK } from './presets.js';

/**
 * Bristle brush engine.
 *
 *   brush.down(x, y, p, { seed }) → brush.to(x, y, p)… → brush.up()
 *
 * Ink model, after a real brush:
 *   - `ink` is what the belly holds (0 – MAX_INK). Painting spends it by area.
 *   - `tip` is how wet the hairs at the point are. It dries along a stroke much
 *     faster than the belly empties, and refills from the belly when you lift.
 *   A wet tip lays a solid body; a drying tip shrinks the body until only parted
 *   hairs touch the paper (飛白, flying white).
 *
 * Each stroke is drawn opaquely onto the brush's wet layer and shown at the
 * ink's density. The body's two edges are traced separately with their own
 * noise, so they fray rather than run smooth; the outermost hairs break up
 * first; and on absorbent paper (bleed, water, overload) fine fibres of ink
 * wick out of the edge as it is painted, so nothing changes when the brush lifts.
 *
 * Determinism: every call to `down` and `to` paints its own segment, and all
 * texture comes from the stroke's seed, so a stroke's pixels depend only on its
 * seed, settings and the sequence of points — never on frame timing, nor on
 * what the brush painted before. That is what lets a saved stroke re-render
 * exactly, anywhere.
 *
 * @typedef {import('./presets.js').BrushPreset} BrushPreset
 * @typedef {{ u: number, lead: number, strand: number, capacity: number, seed: number, open: boolean, lx: number, ly: number }} Bristle
 * @typedef {{ u: number, cut: number, seed: number, trail: number[] }} Gap a dry hair near the rim that leaves a streak of paper inside the body
 * @typedef {{ heading?: [number, number], seed?: number }} DownOptions heading: initial travel direction; seed: texture seed for this stroke
 */

/** Hairs are drawn in three width groups, so a segment costs a handful of draw calls. */
const STRANDS = [0.65, 0.95, 1.25];
/** Widths of the paper streaks cut by dry hairs. */
const CUTS = [0.6, 1];
/** How many recent points a gap re-cuts each segment, so the next body stamps can't paint over it. */
const TRAIL = 12;

/** Highest pressure a brush paints with; the input and path helpers stay below it. */
export const MAX_PRESSURE = 1.4;

/** @param {number} width */
const strandOf = (width) => (width < 0.8 ? 0 : width < 1.1 ? 1 : 2);

/**
 * Half the body width at pressure p: soft hair splays more under pressure.
 * @param {Pick<BrushPreset, 'tilt' | 'stiffness'>} preset
 * @param {number} size
 * @param {number} p
 */
export const halfWidth = (preset, size, p) =>
	size * 0.5 * (1 + preset.tilt * 0.45) * Math.pow(Math.max(0, p), 1.25 - preset.stiffness * 0.6);

/**
 * How far ink can reach from the centreline at any pressure: splayed bristles,
 * ragged edges and wicking fibres.
 * @param {Pick<BrushPreset, 'tilt' | 'stiffness'>} preset
 * @param {number} size
 */
export const reachOf = (preset, size) => halfWidth(preset, size, MAX_PRESSURE) * 1.7 + size * 0.35 + 2;

/**
 * Add a quadrilateral wound the same way as canvas ellipses, so overlapping
 * shapes in one nonzero fill never cancel into holes.
 * @param {Path2D} path @param {number[]} q x0, y0 … x3, y3
 */
const quad = (path, q) => {
	let area = 0;
	for (let i = 0; i < 8; i += 2) area += q[i] * q[(i + 3) % 8] - q[(i + 2) % 8] * q[i + 1];
	const order = area >= 0 ? [0, 2, 4, 6] : [6, 4, 2, 0];
	path.moveTo(q[order[0]], q[order[0] + 1]);
	for (let i = 1; i < 4; i++) path.lineTo(q[order[i]], q[order[i] + 1]);
	path.closePath();
};

export class Brush {
	/**
	 * @param {import('./surface.js').Surface} surface
	 * @param {Partial<BrushPreset>} [preset]
	 * @param {{ color?: string, record?: boolean }} [options] record: whether each stroke makes an undo point
	 */
	constructor(surface, preset = BRUSHES[0], { color = '#16110d', record = true } = {}) {
		this.surface = surface;
		this.layer = surface.layer();
		this.color = color;
		this.record = record;
		/** @type {BrushPreset} */
		this.preset = { ...BRUSHES[0] };
		this.size = this.preset.size;
		/** @type {Bristle[]} */
		this.bristles = [];
		/** @type {Gap[]} */
		this.gaps = [];
		this.seed = 0;
		this.ink = 1;
		this.tip = 1;
		/** @type {((ink: number) => void) | null} */
		this.onink = null;
		this.active = false;
		this.x = 0;
		this.y = 0;
		this.p = 0;
		this.dx = 1;
		this.dy = 0;
		/** Whether the hairs point along the stroke yet; the first movement turns them if not. */
		this.aimed = false;
		this.ax = 0;
		this.ay = 1;
		this.travel = 0;
		this.batchP = 0;
		this.batchN = 0;
		/** Centreline extent of the unflushed segment: [minX, minY, maxX, maxY]. */
		this.span = [Infinity, Infinity, -Infinity, -Infinity];
		this.core = new Path2D();
		this.fringe = new Path2D();
		/** @type {Path2D[]} */
		this.strands = [];
		/** Last traced edge and centre points [lx, ly, rx, ry, cx, cy], or null where the body broke. @type {number[] | null} */
		this.rim = null;
		/** Per-stroke texture salt, derived from the seed. */
		this.salt = 0;
		/** How strongly ink wicks into the paper this stroke. */
		this.wick = 0;
		/** Ink above a full load at the start of this stroke. */
		this.flood = 0;
		this.ticks = 0;
		this.set(preset);
		this.reset();
	}

	/** @param {Partial<BrushPreset>} preset */
	set(preset) {
		const count = this.preset.bristles;
		this.preset = { ...this.preset, ...preset };
		this.size = this.preset.size;
		if (!this.bristles.length || count !== this.preset.bristles) this.hairs(this.seed);
	}

	/**
	 * Lay out the hairs for a seed. Every stroke re-lays them from its own seed.
	 * @param {number} [seed]
	 */
	hairs(seed = newSeed()) {
		this.seed = seed >>> 0;
		const rand = random(this.seed);
		const clumps = 10 + Math.round(rand() * 8);
		this.bristles = Array.from({ length: Math.round(this.preset.bristles) }, () => {
			const u = clamp((rand() + rand() + rand()) / 1.5 - 1, -1, 1);
			const clump = Math.floor(((u + 1) / 2) * clumps);
			return {
				u,
				lead: 1 - u * u,
				strand: strandOf(0.5 + rand() * 0.9),
				capacity: 0.75 + rand() * 0.5,
				seed: clump * 37.7 + rand() * 0.35,
				open: false,
				lx: 0,
				ly: 0
			};
		});
		this.gaps = Array.from({ length: 6 + Math.round(rand() * 4) }, (_, i) => ({
			u: (i % 2 ? 1 : -1) * (0.5 + rand() * 0.42),
			cut: 0.4 + rand() * 0.8 < 0.8 ? 0 : 1,
			seed: 500 + rand() * 300,
			trail: []
		}));
		this.salt = random(this.seed ^ 0x5bd1e995)() * 1000;
	}

	/** Add ink to the belly (e.g. while held in the inkstone). @param {number} amount */
	load(amount) {
		this.ink = clamp(this.ink + amount, 0, MAX_INK);
		this.tip = Math.max(this.tip, this.saturation());
		this.onink?.(this.ink);
	}

	/** Set the belly to an exact level, as a fresh dip. @param {number} [level] */
	dip(level = 1) {
		this.ink = clamp(level, 0, MAX_INK);
		this.tip = this.saturation();
		this.onink?.(this.ink);
	}

	/** How wet the tip can get from what the belly holds; even a light load wets the point. */
	saturation() {
		return Math.min(1.15, Math.sqrt(this.ink) * 1.12);
	}

	/** How opaque this stroke lands: water dilutes, a nearly empty brush lays thinner ink. */
	density() {
		return clamp(1 - this.preset.water * 0.72, 0.12, 1) * (0.78 + 0.22 * Math.min(1, this.ink * 1.6));
	}

	/**
	 * @param {number} x
	 * @param {number} y
	 * @param {number} [p]
	 * @param {DownOptions} [options]
	 */
	down(x, y, p = 0.6, { heading, seed } = {}) {
		if (this.active) this.up();
		p = clamp(p, 0, MAX_PRESSURE);
		this.hairs(seed ?? newSeed());
		this.surface.tape?.begin(this, x, y, p, heading);
		this.active = true;
		this.x = x;
		this.y = y;
		this.p = p;
		this.travel = 0;
		const [hx, hy] = heading ?? [0, 0];
		const len = Math.hypot(hx, hy);
		this.aimed = len > 0;
		this.dx = this.aimed ? hx / len : 1;
		this.dy = this.aimed ? hy / len : 0;
		this.tip = Math.max(this.tip, this.saturation());
		const { grain, bleed, water } = this.preset;
		const flood = Math.max(0, this.ink - 0.9);
		this.wick = bleed * 0.6 + water * 0.8 + flood * 1.4;
		this.ticks = 0;
		this.rim = null;
		this.layer.begin(this.density(), grain * (0.35 + 0.65 * (1 - Math.min(1, this.tip))) * (1 - Math.min(0.8, flood)));
		this.flood = flood;
		this.reset();
		this.step(x, y, p);
		this.flush();
	}

	/** @param {number} x @param {number} y @param {number} p */
	to(x, y, p) {
		if (!this.active) return this.down(x, y, p);
		p = clamp(p, 0, MAX_PRESSURE);
		this.surface.tape?.point(this, x, y, p);
		const dist = Math.hypot(x - this.x, y - this.y);
		const minor = Math.max(0.5, this.half(Math.min(p, this.p)) * (1 - this.preset.tilt * 0.82));
		const stride = Math.max(0.5, minor * 0.3);
		const steps = Math.max(1, Math.ceil(dist / stride));
		const [x0, y0, p0] = [this.x, this.y, this.p];
		for (let i = 1; i <= steps; i++) {
			const t = i / steps;
			this.step(x0 + (x - x0) * t, y0 + (y - y0) * t, p0 + (p - p0) * t);
		}
		this.flush();
	}

	/** Half the body width at pressure p. @param {number} p */
	half(p) {
		return halfWidth(this.preset, this.size, p);
	}

	/** Paint what the last `down` or `to` laid onto the wet layer. */
	flush() {
		if (!this.batchN) return;
		const { ctx } = this.layer;
		const p = this.batchP / this.batchN;
		ctx.fillStyle = this.color;
		ctx.strokeStyle = this.color;
		ctx.lineCap = 'round';
		ctx.lineJoin = 'round';
		ctx.fill(this.core);
		this.strands.forEach((path, i) => {
			ctx.lineWidth = Math.max(0.4, this.size * Math.max(0.15, p) * STRANDS[i] * 0.038);
			ctx.stroke(path);
		});
		if (this.wick > 0.02) {
			ctx.globalAlpha = 0.42;
			ctx.lineWidth = Math.max(0.35, this.size * 0.014);
			ctx.stroke(this.fringe);
			ctx.globalAlpha = 1;
		}
		const cuts = CUTS.map(() => new Path2D());
		for (const g of this.gaps) {
			if (g.trail.length < 4) continue;
			const path = cuts[g.cut];
			path.moveTo(g.trail[0], g.trail[1]);
			for (let i = 2; i < g.trail.length; i += 2) path.lineTo(g.trail[i], g.trail[i + 1]);
		}
		ctx.globalCompositeOperation = 'destination-out';
		ctx.globalAlpha = 0.7;
		cuts.forEach((path, i) => {
			ctx.lineWidth = Math.max(0.35, this.size * Math.max(0.2, p) * CUTS[i] * 0.026);
			ctx.stroke(path);
		});
		ctx.globalAlpha = 1;
		ctx.globalCompositeOperation = 'source-over';
		const reach = reachOf(this.preset, this.size);
		const [x0, y0, x1, y1] = this.span;
		this.layer.touch(x0 - reach, y0 - reach, x1 + reach, y1 + reach);
		this.reset();
		this.surface.invalidate();
		this.onink?.(this.ink);
	}

	up() {
		if (!this.active) return;
		this.surface.tape?.end(this);
		this.flush();
		this.active = false;
		this.layer.commit({ record: this.record });
		this.tip = Math.min(this.tip + 0.35, this.saturation());
		this.onink?.(this.ink);
	}

	/** Start fresh paths for the next segment. */
	reset() {
		this.core = new Path2D();
		this.fringe = new Path2D();
		this.strands = STRANDS.map(() => new Path2D());
		this.batchP = 0;
		this.batchN = 0;
		this.span = [Infinity, Infinity, -Infinity, -Infinity];
	}

	/** Turn the hairs to the stroke's first movement: edges, streaks and hairs start afresh from here. */
	aim() {
		this.aimed = true;
		this.rim = null;
		for (const g of this.gaps) g.trail.length = 0;
		for (const b of this.bristles) b.open = false;
	}

	/**
	 * Advance one substep: spend ink, stamp the body, extend every touching hair.
	 * @param {number} x @param {number} y @param {number} p
	 */
	step(x, y, p) {
		const { size, preset } = this;
		const mx = x - this.x;
		const my = y - this.y;
		const ds = Math.hypot(mx, my);
		if (ds > 0.001) {
			const k = !this.aimed ? 1 : this.travel < size * 0.5 ? 0.5 : 0.22;
			const nx = this.dx * (1 - k) + (mx / ds) * k;
			const ny = this.dy * (1 - k) + (my / ds) * k;
			const nl = Math.hypot(nx, ny) || 1;
			this.dx = nx / nl;
			this.dy = ny / nl;
			if (!this.aimed) this.aim();
		}
		this.x = x;
		this.y = y;
		this.p = p;
		this.travel += ds;
		const { span } = this;
		span[0] = Math.min(span[0], x);
		span[1] = Math.min(span[1], y);
		span[2] = Math.max(span[2], x);
		span[3] = Math.max(span[3], y);

		const half = this.half(p);
		this.ink = Math.max(0, this.ink - ((ds * half * 2) / (size * size)) * preset.flow * 0.012);
		this.tip = Math.max(0, this.tip - (ds / size) * preset.dryness * 0.05 * (0.5 + p));
		this.tip = Math.min(this.tip, this.saturation() + 0.02);
		const wet = this.tip;

		// The hairs fan across the stroke for an upright brush, and along the
		// brush's fixed angle when it is laid over (side tip).
		const angle = (preset.angle * Math.PI) / 180;
		let fx = Math.cos(angle);
		let fy = Math.sin(angle);
		if (fx * -this.dy + fy * this.dx < 0) [fx, fy] = [-fx, -fy];
		const ax = -this.dy * (1 - preset.tilt) + fx * preset.tilt;
		const ay = this.dx * (1 - preset.tilt) + fy * preset.tilt;
		const al = Math.hypot(ax, ay) || 1;
		this.ax = ax / al;
		this.ay = ay / al;

		const along = this.travel / size;
		const body = smoothstep(0.25 + preset.split * 0.6, 0.7 + preset.split * 0.55, wet);
		if (body > 0.02 && half > 0.3) {
			const grain = 1 + (noise(along * 4.3 + 7) - 0.5) * preset.grain * 0.3;
			const r = half * (0.42 + 0.4 * body) * grain;
			const minor = r * (1 - preset.tilt * 0.82);
			const rotation = Math.atan2(this.ay, this.ax);
			const ox = (noise(along * 2.1 + 3) - 0.5) * preset.grain * half * 0.25;
			const cx = x + this.ax * ox;
			const cy = y + this.ay * ox;
			const inner = r * 0.82;
			this.core.moveTo(cx + Math.cos(rotation) * inner, cy + Math.sin(rotation) * inner);
			this.core.ellipse(cx, cy, inner, Math.max(0.3, minor * 0.82), rotation, 0, Math.PI * 2);
			this.edge(cx, cy, r);
			this.streak(cx, cy, r, along, wet);
		} else {
			this.rim = null;
			for (const g of this.gaps) g.trail.length = 0;
		}

		const lead = half * preset.tip * 0.5;
		const reach = 0.25 + p * 0.9;
		const part = preset.split;
		const frequency = 1.6 - preset.split * 1.1;
		const fray = 0.9 + preset.grain * 1.6;
		for (const b of this.bristles) {
			const ragged = (noise(b.seed + along * 3) - 0.5) * preset.grain * 0.18;
			const u = b.u + ragged;
			const bx = x + this.ax * u * half + this.dx * b.lead * lead;
			const by = y + this.ay * u * half + this.dy * b.lead * lead;
			const touching = Math.abs(b.u) < reach;
			const level = (wet * b.capacity - 0.08) * 2.2 - part - smoothstep(0.62, 1, Math.abs(b.u)) * fray;
			const inked = noise(b.seed + along * frequency) < level;
			if (touching && inked) {
				const path = this.strands[b.strand];
				if (b.open) path.moveTo(b.lx, b.ly);
				else path.moveTo(bx + 0.01, by);
				path.lineTo(bx, by);
				b.open = true;
				b.lx = bx;
				b.ly = by;
			} else {
				b.open = false;
			}
		}
		this.batchP += p;
		this.batchN += 1;
		this.ticks += 1;
	}

	/**
	 * Extend the dry hairs near the rim. Wet ink closes them; a drying tip, rough
	 * paper and a light load open them into fine streaks of paper.
	 * @param {number} cx @param {number} cy @param {number} r @param {number} along @param {number} wet
	 */
	streak(cx, cy, r, along, wet) {
		const level = (0.1 + this.preset.grain * 0.45 + (1 - Math.min(1, wet)) * 0.7) * (1 - Math.min(1, this.flood * 2));
		for (const g of this.gaps) {
			if (noise(g.seed + along * 0.9 + this.salt) < level) {
				g.trail.push(cx + this.ax * g.u * r, cy + this.ay * g.u * r);
				if (g.trail.length > TRAIL * 2) g.trail.splice(0, 2);
			} else {
				g.trail.length = 0;
			}
		}
	}

	/**
	 * Trace both edges of the body as their own ragged ribbons, and let fibres
	 * of ink wick out of them into absorbent paper.
	 * @param {number} cx @param {number} cy @param {number} r half-width of the body here
	 */
	edge(cx, cy, r) {
		const { grain } = this.preset;
		const { ax, ay, travel, size, salt } = this;
		/** @param {number} side */
		const reach = (side) =>
			r *
			(0.96 +
				(noise((travel / size) * 2.6 + side * 41.3 + salt) - 0.5) * (0.1 + grain * 0.12) +
				(noise(travel * 0.42 + side * 13.7 + salt) - 0.5) * (0.08 + grain * 0.3));
		const left = reach(1);
		const right = reach(2);
		const lx = cx + ax * left;
		const ly = cy + ay * left;
		const rx = cx - ax * right;
		const ry = cy - ay * right;
		if (this.rim) {
			const [plx, ply, prx, pry, pcx, pcy] = this.rim;
			quad(this.core, [plx, ply, lx, ly, cx, cy, pcx, pcy]);
			quad(this.core, [prx, pry, rx, ry, cx, cy, pcx, pcy]);
		}
		this.rim = [lx, ly, rx, ry, cx, cy];

		if (this.wick <= 0.02) return;
		const chance = Math.min(0.7, this.wick * 0.5);
		for (const [side, ex, ey] of /** @type {const} */ ([
			[1, lx, ly],
			[-1, rx, ry]
		])) {
			const key = this.ticks * 1.618 + side * 7.31 + salt;
			if (hash(key) > chance) continue;
			const spread = (hash(key + 0.37) - 0.5) * 1.6;
			const ox = ax * side;
			const oy = ay * side;
			const dx = ox * Math.cos(spread) - oy * Math.sin(spread);
			const dy = ox * Math.sin(spread) + oy * Math.cos(spread);
			const length = size * (0.025 + hash(key + 0.71) * 0.09) * (0.6 + this.wick);
			const bend = (hash(key + 0.93) - 0.5) * length * 0.8;
			const sx = ex - ox * 0.6;
			const sy = ey - oy * 0.6;
			this.fringe.moveTo(sx, sy);
			this.fringe.quadraticCurveTo(
				sx + dx * length * 0.5 - dy * bend,
				sy + dy * length * 0.5 + dx * bend,
				sx + dx * length,
				sy + dy * length
			);
		}
	}

	destroy() {
		this.layer.destroy();
	}
}
