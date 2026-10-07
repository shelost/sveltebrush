import { clamp } from './math.js';

/**
 * Pointer samples → brush input, after perfect-freehand's `getStrokePoints`:
 * positions are streamlined (each point eases toward the pointer, which smooths
 * hand and digitiser jitter), pens keep their real pressure, and mice and
 * fingers get pressure from speed — slow is heavy, fast is light, as with a
 * real brush. Ending a quick stroke catches up with the pointer and flicks the
 * tip out along the stroke's direction.
 *
 * Output points are rounded (0.01 px, 0.001 pressure), so a saved stroke holds
 * exactly the numbers the brush painted with.
 *
 * @typedef {import('./stroke.js').InkPoint} InkPoint
 * @typedef {{ pressure?: number, time?: number, velocity?: number }} Sample pressure: 0–1 from a pen; time: event time in ms; velocity: pointer speed in px/ms, if already known
 * @typedef {{ pen?: boolean, streamline?: number, flick?: boolean }} InputOptions pen: use real pressure; streamline: 0 (raw) – 1 (heavily smoothed)
 * @typedef {{
 *   push: (x: number, y: number, sample?: Sample) => InkPoint | null,
 *   end: (size?: number) => InkPoint[],
 *   readonly velocity: number
 * }} Input
 */

/** @param {number} x @param {number} y @param {number} p @param {number} t @returns {InkPoint} */
const point = (x, y, p, t) => [+x.toFixed(2), +y.toFixed(2), +p.toFixed(3), +t.toFixed(1)];

/**
 * An incremental input processor for one stroke. Call `push` for every pointer
 * sample (including coalesced ones) and `end` on release.
 * @param {InputOptions} [options]
 * @returns {Input}
 */
export function createInput({ pen = false, streamline = 0.35, flick = true } = {}) {
	const ease = 0.15 + (1 - clamp(streamline, 0, 1)) * 0.85;
	let started = false;
	let x = 0;
	let y = 0;
	let rawX = 0;
	let rawY = 0;
	let begun = 0;
	let t = 0;
	let velocity = 0;
	let pressure = 0.55;
	let dx = 1;
	let dy = 0;
	/** @type {InkPoint | null} */
	let last = null;

	/** @param {InkPoint} next */
	const emit = (next) => {
		if (last && Math.hypot(next[0] - last[0], next[1] - last[1]) < 0.05 && Math.abs(next[2] - last[2]) < 0.01) return null;
		last = next;
		return next;
	};

	return {
		get velocity() {
			return velocity;
		},

		push(px, py, { pressure: force = 0.5, time, velocity: speed } = {}) {
			if (!started) {
				started = true;
				x = rawX = px;
				y = rawY = py;
				begun = t = time ?? 0;
				velocity = 0;
				pressure = pen ? 0.2 + force : 0.55;
				last = null;
				return emit(point(x, y, pressure, 0));
			}
			const dt = time === undefined ? 16 : Math.max(1, time - t);
			velocity = speed ?? velocity * 0.7 + (Math.hypot(px - rawX, py - rawY) / dt) * 0.3;
			const target = pen ? 0.2 + force : clamp(1.15 - velocity * 0.45, 0.3, 1.15);
			pressure += (target - pressure) * 0.25;
			rawX = px;
			rawY = py;
			t = time ?? t + dt;
			const nx = x + (px - x) * ease;
			const ny = y + (py - y) * ease;
			const moved = Math.hypot(nx - x, ny - y);
			if (moved > 0.001) {
				const hx = dx * 0.6 + ((nx - x) / moved) * 0.4;
				const hy = dy * 0.6 + ((ny - y) / moved) * 0.4;
				const len = Math.hypot(hx, hy) || 1;
				dx = hx / len;
				dy = hy / len;
			}
			x = nx;
			y = ny;
			return emit(point(x, y, pressure, t - begun));
		},

		end(size = 30) {
			if (!started) return [];
			started = false;
			/** @type {InkPoint[]} */
			const out = [];
			if (Math.hypot(rawX - x, rawY - y) > 0.5) {
				x = rawX;
				y = rawY;
				const caught = emit(point(x, y, pressure, t - begun));
				if (caught) out.push(caught);
			}
			if (flick && !pen && velocity > 0.3) {
				const reach = Math.min(velocity * 60, size * 3);
				for (let i = 1; i <= 10; i++) {
					const k = i / 10;
					out.push(point(x + dx * reach * k, y + dy * reach * k, pressure * (1 - k), t - begun + k * 40));
				}
			}
			return out;
		}
	};
}

/**
 * Process a whole recorded stroke at once — the batch form of `createInput`.
 * @param {Array<[x: number, y: number, pressure?: number, time?: number] | { x: number, y: number, pressure?: number, time?: number }>} samples
 * @param {InputOptions & { size?: number, last?: boolean }} [options] size: brush size, for the flick's reach; last: the stroke is finished
 * @returns {InkPoint[]}
 */
export function getStrokePoints(samples, { size = 30, last = true, ...options } = {}) {
	const input = createInput(options);
	/** @type {InkPoint[]} */
	const points = [];
	for (const sample of samples) {
		const [x, y, pressure, time] = Array.isArray(sample) ? sample : [sample.x, sample.y, sample.pressure, sample.time];
		const next = input.push(x, y, { pressure, time });
		if (next) points.push(next);
	}
	if (last) points.push(...input.end(size));
	return points;
}
