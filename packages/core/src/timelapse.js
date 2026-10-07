import { Brush } from './brush.js';
import { cancelFrame, context2d, createCanvas, nextFrame } from './canvas.js';
import { prepare, trace } from './stroke.js';
import { Surface } from './surface.js';

/**
 * Documents and timelapses.
 *
 * A Tape listens to a surface and writes down what happens to it: every stroke
 * as data (an InkStroke with timed points), every seal, and history operations.
 * That log is an InkDocument — plain JSON — which can be saved and opened again,
 * re-rendered at any resolution, or replayed stroke for stroke as a timelapse.
 *
 * @typedef {import('./stroke.js').InkStroke} InkStroke
 * @typedef {import('./seal.js').Seal} Seal
 * @typedef {{ type: 'stroke', t: number, stroke: InkStroke, record?: boolean }} StrokeEvent t: ms since recording began; record: false if the stroke made no undo point of its own
 * @typedef {{ type: 'seal', t: number, seal: Seal }} SealEvent
 * @typedef {{ type: 'remember' | 'undo' | 'redo' | 'wipe', t: number }} HistoryEvent
 * @typedef {StrokeEvent | SealEvent | HistoryEvent} InkEvent
 * @typedef {{ version: 1, width: number, height: number, events: InkEvent[] }} InkDocument width, height: the sheet's size in CSS px
 * @typedef {{ time: number, order: number, index: number, event: InkEvent }} Op index: which point of a stroke (points.length lifts the brush)
 */

/** Longest pause kept between strokes, in ms of real time. */
const IDLE = 220;
/** A timelapse always plays at least this much faster than life. */
const MIN_SPEED = 2;
/** Spacing given to points that carry no time. */
const POINT_MS = 8;

/** @param {number} n */
const tenth = (n) => Math.round(n * 10) / 10;

export class Tape {
	/** @param {{ width?: number, height?: number, events?: InkEvent[] }} [init] */
	constructor({ width = 0, height = 0, events = [] } = {}) {
		this.width = width;
		this.height = height;
		/** @type {InkEvent[]} */
		this.events = events;
		/** @type {Map<Brush, { t: number, stroke: InkStroke, record: boolean }>} */
		this.open = new Map();
		this.start = performance.now() - (events.at(-1)?.t ?? 0);
		/** Called with every event as it is recorded. @type {((event: InkEvent) => void) | null} */
		this.onevent = null;
	}

	now() {
		return tenth(performance.now() - this.start);
	}

	/** How many strokes have been recorded. */
	get strokes() {
		return this.events.reduce((count, event) => count + (event.type === 'stroke' ? 1 : 0), 0);
	}

	/**
	 * @param {Brush} brush
	 * @param {number} x @param {number} y @param {number} p
	 * @param {[number, number]} [heading]
	 */
	begin(brush, x, y, p, heading) {
		/** @type {InkStroke} */
		const stroke = {
			points: [[x, y, p, 0]],
			brush: { ...brush.preset },
			size: brush.size,
			color: brush.color,
			ink: brush.ink,
			tip: brush.tip,
			seed: brush.seed
		};
		if (heading) stroke.heading = [heading[0], heading[1]];
		this.open.set(brush, { t: this.now(), stroke, record: brush.record });
	}

	/** @param {Brush} brush @param {number} x @param {number} y @param {number} p */
	point(brush, x, y, p) {
		const open = this.open.get(brush);
		open?.stroke.points.push([x, y, p, tenth(this.now() - open.t)]);
	}

	/** @param {Brush} brush */
	end(brush) {
		const open = this.open.get(brush);
		if (!open) return;
		this.open.delete(brush);
		this.add(
			open.record ? { type: 'stroke', t: open.t, stroke: open.stroke } : { type: 'stroke', t: open.t, stroke: open.stroke, record: false }
		);
	}

	/** @param {HistoryEvent['type']} type */
	mark(type) {
		this.add({ type, t: this.now() });
	}

	/** @param {Seal} seal */
	seal(seal) {
		this.add({ type: 'seal', t: this.now(), seal: { ...seal } });
	}

	/** @param {InkEvent} event */
	add(event) {
		this.events.push(event);
		this.onevent?.(event);
	}

	clear() {
		this.events = [];
		this.open.clear();
		this.start = performance.now();
	}

	/** @returns {InkDocument} */
	toJSON() {
		return { version: 1, width: this.width, height: this.height, events: this.events };
	}

	/**
	 * A tape holding a saved document, ready to replay or to keep recording onto.
	 * @param {InkDocument} document
	 */
	static from(document) {
		if (!document || document.version !== 1 || !Array.isArray(document.events)) {
			throw new Error('Not a Sveltebrush document (expected { version: 1, events: [...] }).');
		}
		return new Tape({ width: document.width, height: document.height, events: structuredClone(document.events) });
	}
}

/**
 * Apply a non-stroke event to a surface.
 * @param {Surface} surface
 * @param {SealEvent | HistoryEvent} event
 */
const apply = (surface, event) => {
	if (event.type === 'seal') surface.seal(event.seal);
	else surface[event.type]();
};

/**
 * Paint a whole document onto a surface at once, e.g. when opening a file.
 * History is replayed too, so undo works as it did when the document was made.
 * @param {Tape | InkDocument} source
 * @param {Surface} surface
 */
export function paintDocument(source, surface) {
	const brush = new Brush(surface);
	for (const event of source.events) {
		if (event.type !== 'stroke') {
			apply(surface, event);
			continue;
		}
		if (!event.stroke.points.length) continue;
		prepare(brush, event.stroke);
		brush.record = event.record ?? true;
		trace(brush, event.stroke);
		brush.up();
	}
	brush.destroy();
	surface.render();
}

/**
 * Every point, lift and history operation in playback order.
 * @param {InkEvent[]} events
 * @returns {Op[]}
 */
function schedule(events) {
	/** @type {Op[]} */
	const ops = [];
	events.forEach((event, order) => {
		if (event.type !== 'stroke') {
			ops.push({ time: event.t, order, index: 0, event });
			return;
		}
		const { points } = event.stroke;
		if (!points.length) return;
		points.forEach((point, index) => ops.push({ time: event.t + (point[3] ?? index * POINT_MS), order, index, event }));
		const end = points[points.length - 1][3] ?? points.length * POINT_MS;
		ops.push({ time: event.t + end, order, index: points.length, event });
	});
	return ops.sort((a, b) => a.time - b.time || a.order - b.order || a.index - b.index);
}

/**
 * Map every op to a playback time: strokes keep their rhythm, idle gaps are
 * trimmed, and the whole thing is sped up to fit the target length.
 * @param {Op[]} ops
 * @param {number} target ms
 */
function timeline(ops, target) {
	/** @type {number[]} */
	const times = [];
	let clock = 0;
	let open = 0;
	let previous = ops[0]?.time ?? 0;
	for (const op of ops) {
		const gap = Math.max(0, op.time - previous);
		previous = op.time;
		clock += open > 0 ? gap : Math.min(gap, IDLE);
		times.push(clock);
		if (op.event.type === 'stroke') {
			if (op.index === 0) open++;
			else if (op.index === op.event.stroke.points.length) open = Math.max(0, open - 1);
		}
	}
	const speed = Math.max(MIN_SPEED, clock / target);
	return { times: times.map((t) => t / speed), length: clock / speed };
}

/**
 * Replay a document onto a surface (which should start blank).
 * @param {Tape | InkDocument} source
 * @param {Surface} surface
 * @param {{ duration?: number, onframe?: (progress: number) => void }} [options] duration: target length in ms
 * @returns {{ done: Promise<boolean>, stop: () => void, length: number }} done resolves true if it played to the end
 */
export function play(source, surface, { duration = 12000, onframe } = {}) {
	const ops = schedule(source.events.slice());
	const { times, length } = timeline(ops, duration);
	/** @type {Map<InkEvent, Brush>} */
	const active = new Map();
	/** @type {Brush[]} */
	const idle = [];
	let index = 0;
	let clock = 0;
	let last = 0;
	let frame = 0;
	let over = false;
	/** @type {(value: boolean) => void} */
	let settle = () => {};
	const done = new Promise((resolve) => (settle = resolve));

	/** @param {boolean} finished */
	function finish(finished) {
		if (over) return;
		over = true;
		cancelFrame(frame);
		for (const brush of [...active.values(), ...idle]) brush.destroy();
		active.clear();
		settle(finished);
	}

	/** @param {Op} op */
	function step({ event, index: at }) {
		if (event.type !== 'stroke') return apply(surface, event);
		const { stroke } = event;
		if (at === 0) {
			const brush = idle.pop() ?? new Brush(surface);
			prepare(brush, stroke);
			brush.record = event.record ?? true;
			active.set(event, brush);
		}
		const brush = active.get(event);
		if (!brush) return;
		if (at < stroke.points.length) return trace(brush, stroke, at, at + 1);
		brush.up();
		active.delete(event);
		idle.push(brush);
	}

	/** @param {number} now */
	function tick(now) {
		if (over) return;
		clock += Math.min(64, now - last);
		last = now;
		while (index < ops.length && times[index] <= clock) step(ops[index++]);
		surface.render();
		onframe?.(length ? Math.min(1, clock / length) : 1);
		if (index >= ops.length) return finish(true);
		frame = nextFrame(tick);
	}

	frame = nextFrame((now) => {
		last = now;
		tick(now);
	});
	return { done, stop: () => finish(false), length };
}

const VIDEO_TYPES = ['video/mp4;codecs=avc1.42E01F', 'video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'];

/** Best recordable video type in this browser: MP4 where supported, else WebM, else ''. */
export const videoType = () =>
	typeof MediaRecorder === 'undefined' ? '' : (VIDEO_TYPES.find((type) => MediaRecorder.isTypeSupported(type)) ?? '');

/**
 * Render a document to video in the browser. Recording runs in real time, so
 * this takes about as long as the timelapse itself (plus `hold`); keep the tab
 * in the foreground, since background tabs throttle animation frames.
 * @param {Tape | InkDocument} source
 * @param {{
 *   width?: number,
 *   height?: number,
 *   background?: string,
 *   resolution?: number,
 *   fps?: number,
 *   duration?: number,
 *   hold?: number,
 *   onprogress?: (progress: number) => void,
 *   signal?: AbortSignal
 * }} [options] width/height: sheet size in CSS px (defaults to the document's); resolution: longest video side in px; hold: ms to linger on the finished sheet
 * @returns {Promise<{ blob: Blob, extension: 'mp4' | 'webm' } | null>} null if aborted
 */
export async function renderVideo(
	source,
	{
		width = source.width,
		height = source.height,
		background = '#f1e8d6',
		resolution = 1920,
		fps = 30,
		duration = 12000,
		hold = 1500,
		onprogress,
		signal
	} = {}
) {
	const type = videoType();
	if (!type) throw new Error('This browser cannot record video.');
	if (!width || !height) throw new Error('renderVideo needs the sheet size: pass width and height.');
	const scale = Math.min(2, resolution / Math.max(width, height));
	const even = (/** @type {number} */ n) => Math.max(2, Math.round(n / 2) * 2);
	const out = document.createElement('canvas');
	out.width = even(width * scale);
	out.height = even(height * scale);
	const ctx = context2d(out);
	const sheet = new Surface(createCanvas(1, 1), { dpr: scale });
	sheet.resize(width, height);
	const view = /** @type {import('./canvas.js').AnyCanvas} */ (sheet.canvas);

	const paint = () => {
		ctx.globalCompositeOperation = 'source-over';
		ctx.fillStyle = background;
		ctx.fillRect(0, 0, out.width, out.height);
		ctx.globalCompositeOperation = 'multiply';
		ctx.drawImage(view, 0, 0, out.width, out.height);
	};
	paint();

	const recorder = new MediaRecorder(out.captureStream(fps), { mimeType: type, videoBitsPerSecond: 10_000_000 });
	/** @type {Blob[]} */
	const chunks = [];
	recorder.ondataavailable = (e) => {
		if (e.data.size) chunks.push(e.data);
	};
	const stopped = new Promise((resolve) => (recorder.onstop = resolve));
	recorder.start(250);

	const player = play(source, sheet, {
		duration,
		onframe: (progress) => {
			paint();
			onprogress?.(progress * 0.92);
		}
	});
	signal?.addEventListener('abort', player.stop);
	let finished = await player.done;

	const until = performance.now() + hold;
	while (finished && performance.now() < until) {
		if (signal?.aborted) finished = false;
		paint();
		onprogress?.(0.92 + 0.08 * (1 - (until - performance.now()) / hold));
		await new Promise((resolve) => nextFrame(resolve));
	}
	recorder.stop();
	await stopped;
	sheet.destroy();
	if (!finished) return null;
	onprogress?.(1);
	return { blob: new Blob(chunks, { type: type.split(';')[0] }), extension: type.includes('mp4') ? 'mp4' : 'webm' };
}
