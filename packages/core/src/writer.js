import { Brush } from './brush.js';
import { cancelFrame, nextFrame } from './canvas.js';
import { glyph, writable } from './glyphs.js';
import { newSeed } from './math.js';
import { shape } from './path.js';
import { BRUSHES } from './presets.js';
import { sealHeight } from './seal.js';

/**
 * @typedef {{ char: string, x: number, y: number, cell: number }} Cell
 * @typedef {number | { top?: number, right?: number, bottom?: number, left?: number }} Padding
 * @typedef {{
 *   width: number,
 *   height: number,
 *   vertical?: boolean,
 *   maxCell?: number,
 *   padding?: Padding,
 *   speed?: number,
 *   weight?: number,
 *   brush?: Partial<import('./presets.js').BrushPreset>,
 *   seal?: string
 * }} WriteOptions
 */

const ADVANCE = 1.04;
const LEADING = 1.22;
/** Placeholder cell reserved after the text for the seal. */
const SEAL = '\u3000';

/**
 * Grid placement for text: rows left→right, or columns top→bottom read right→left.
 * Picks the largest cell (≤ maxCell) that fits everything.
 * @param {string} text
 * @param {{ width: number, height: number, vertical?: boolean, maxCell?: number, padding?: Padding }} box
 * @returns {Cell[]}
 */
export function layout(text, { width, height, vertical = false, maxCell = 260, padding = 48 }) {
	const edge = typeof padding === 'number' ? {} : padding;
	const base = typeof padding === 'number' ? padding : 48;
	const { top = base, right = base, bottom = base, left = base } = edge;
	const lines = text.split('\n').map((line) => [...line]);
	const along = vertical ? height - top - bottom : width - left - right;
	const across = vertical ? width - left - right : height - top - bottom;

	let cell = maxCell;
	let per = 1;
	/** @type {string[][]} */
	let rows = [];
	for (; cell > 8; cell *= 0.94) {
		per = Math.max(1, Math.floor((along + cell * (ADVANCE - 1)) / (cell * ADVANCE)));
		rows = lines.flatMap((line) => {
			/** @type {string[][]} */
			const wrapped = [[]];
			for (const char of line) {
				let row = wrapped[wrapped.length - 1];
				if (row.length === per) wrapped.push((row = []));
				if (!(row.length === 0 && wrapped.length > 1 && char !== SEAL && /\s/.test(char))) row.push(char);
			}
			return wrapped;
		});
		if (cell <= along && rows.length * cell * LEADING - cell * (LEADING - 1) <= across) break;
	}

	const longest = Math.max(1, ...rows.map((row) => row.length));
	const alongExtent = longest * cell * ADVANCE - cell * (ADVANCE - 1);
	const acrossExtent = rows.length * cell * LEADING - cell * (LEADING - 1);

	return rows.flatMap((row, r) =>
		row.map((char, c) =>
			vertical
				? {
						char,
						x: left + (width - left - right + acrossExtent) / 2 - cell - r * cell * LEADING,
						y: top + (height - top - bottom - alongExtent) / 2 + c * cell * ADVANCE,
						cell
					}
				: {
						char,
						x: left + (width - left - right - alongExtent) / 2 + c * cell * ADVANCE,
						y: top + (height - top - bottom - acrossExtent) / 2 + r * cell * LEADING,
						cell
					}
		)
	);
}

/**
 * Brush width as a fraction of the cell: dense characters get a finer brush.
 * @param {number} count strokes in the character
 * @param {'han' | 'hangul'} script
 */
const weightFor = (count, script) =>
	script === 'hangul' ? Math.min(0.125, Math.max(0.075, 0.14 - count * 0.004)) : Math.min(0.13, Math.max(0.06, 0.15 - count * 0.0045));

/**
 * Geometric jamo strokes are ruler-straight; a hand lifts horizontals slightly to
 * the right and bows every straight line a little.
 * @param {import('./hangul.js').Stroke} stroke
 * @returns {import('./hangul.js').Stroke}
 */
function humanize(stroke) {
	const lifted = stroke.map(([u, v]) => /** @type {[number, number]} */ ([u, v - (u - stroke[0][0]) * 0.06]));
	if (lifted.length !== 2) return lifted;
	const [[ax, ay], [bx, by]] = lifted;
	const len = Math.hypot(bx - ax, by - ay) || 1;
	const bow = (Math.random() - 0.3) * 0.025;
	return [
		[ax, ay],
		[(ax + bx) / 2 - ((by - ay) / len) * bow, (ay + by) / 2 + ((bx - ax) / len) * bow],
		[bx, by]
	];
}

/**
 * Map unit strokes into a cell with a little hand tremor and tilt, so no two
 * renderings of the same character are identical.
 * @param {import('./hangul.js').Stroke[]} strokes
 * @param {Cell} cell
 */
function placeStrokes(strokes, { x, y, cell }) {
	const tilt = (Math.random() - 0.5) * 0.05;
	const cos = Math.cos(tilt);
	const sin = Math.sin(tilt);
	return strokes.map((stroke) =>
		stroke.map(([u, v]) => {
			const du = u - 0.5 + (Math.random() - 0.5) * 0.012;
			const dv = v - 0.5 + (Math.random() - 0.5) * 0.012;
			return /** @type {[number, number]} */ ([x + cell * (0.5 + du * cos - dv * sin), y + cell * (0.5 + du * sin + dv * cos)]);
		})
	);
}

/** @param {number} t */
const ease = (t) => 0.5 * t + 0.5 * (0.5 - Math.cos(Math.PI * t) / 2);

/**
 * The seal for the cell reserved after the text: top-centred when it sits below
 * a column or on its own line, otherwise bottom-left beside the last character.
 * @param {string} text
 * @param {Cell} slot
 * @param {boolean} under
 * @returns {import('./seal.js').Seal}
 */
function sealFor(text, slot, under) {
	const size = slot.cell * 0.34;
	const height = sealHeight(text, size);
	return {
		text,
		size,
		x: under ? slot.x + (slot.cell - size) / 2 : slot.x + slot.cell * 0.08,
		y: under ? slot.y + slot.cell * 0.08 : slot.y + slot.cell - height,
		seed: newSeed()
	};
}

/**
 * Animated calligrapher. Owns a brush and writes text onto a surface stroke by
 * stroke, re-dipping before every character. A whole write is one undo step.
 * @param {import('./surface.js').Surface} surface
 * @param {{ color?: string }} [options]
 */
export function createWriter(surface, { color = '#16110d' } = {}) {
	const brush = new Brush(surface, undefined, { color, record: false });
	let run = 0;
	let frame = 0;
	/** @type {((done: boolean) => void) | null} */
	let settle = null;

	function stop() {
		run++;
		cancelFrame(frame);
		brush.up();
		settle?.(false);
		settle = null;
	}

	/**
	 * @param {string} text
	 * @param {WriteOptions} options
	 * @returns {Promise<boolean>} true if it finished, false if interrupted
	 */
	async function write(text, options) {
		stop();
		const id = run;
		const { speed = 1, weight = 1, seal = '', vertical = false } = options;
		if (options.brush) brush.set(options.brush);
		const placed = layout(seal ? text.trimEnd() + SEAL : text, options);
		const anchor = seal ? placed.at(-1) : undefined;
		const before = placed.at(-2);
		const under = vertical || (!!anchor && !!before && anchor.y !== before.y);
		const cells = placed.filter((cell) => writable(cell.char));
		const glyphs = await Promise.all(cells.map((cell) => glyph(cell.char)));
		if (id !== run) return false;

		const heft = 0.85 * weight * Math.sqrt(brush.preset.size / BRUSHES[0].size);
		const jobs = cells.flatMap((cell, c) => {
			const g = glyphs[c];
			if (!g) return [];
			const size = cell.cell * weightFor(g.strokes.length, g.script) * heft;
			const strokes = g.script === 'hangul' ? g.strokes.map(humanize) : g.strokes;
			return placeStrokes(strokes, cell).map((stroke, s, all) => ({
				...shape(stroke, size),
				size,
				dip: s === 0,
				gap: s === all.length - 1 ? 340 : 110
			}));
		});
		surface.remember();

		return new Promise((done) => {
			const resolve = (/** @type {boolean} */ value) => {
				settle = null;
				done(value);
			};
			settle = resolve;
			let index = 0;
			let sample = 0;
			let elapsed = 0;
			let pause = 0;
			let last = performance.now();

			const tick = (/** @type {number} */ now) => {
				if (id !== run) return resolve(false);
				const dt = Math.min(48, now - last) * speed;
				last = now;

				if (pause > 0) pause -= dt;
				else {
					const job = jobs[index];
					if (!job) {
						if (anchor) surface.seal(sealFor(seal, anchor, under));
						return resolve(true);
					}
					if (sample === 0) {
						const [a, b] = [job.samples[0], job.samples[Math.min(3, job.samples.length - 1)]];
						brush.size = job.size;
						if (job.dip) brush.dip(1.1);
						brush.down(a.x, a.y, a.p, { heading: [b.x - a.x, b.y - a.y] });
						sample = 1;
						elapsed = 0;
					}
					elapsed += dt;
					const duration = 120 + job.length / 0.75;
					const reach = job.length * ease(Math.min(1, elapsed / duration));
					while (sample < job.samples.length && job.samples[sample].d <= reach) {
						const point = job.samples[sample++];
						brush.to(point.x, point.y, point.p);
					}
					if (sample >= job.samples.length) {
						brush.up();
						index++;
						sample = 0;
						pause = job.gap;
					}
				}
				frame = nextFrame(tick);
			};
			frame = nextFrame(tick);
		});
	}

	return { write, stop, brush };
}
