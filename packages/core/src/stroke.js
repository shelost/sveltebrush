import { Brush, reachOf } from './brush.js';
import { context2d, createCanvas } from './canvas.js';
import { BRUSHES, preset } from './presets.js';
import { Surface } from './surface.js';

/**
 * Strokes as data.
 *
 * An InkStroke is everything needed to paint one stroke: its points, the brush
 * settings, the colour, how much ink the brush held and the texture seed. Like
 * perfect-freehand's `getStroke`, rendering is a pure function of that data, so
 * the same stroke paints the same pixels anywhere — a canvas, a worker, Node, a
 * tldraw shape or a timelapse — at any resolution.
 *
 * @typedef {import('./presets.js').BrushPreset} BrushPreset
 * @typedef {import('./canvas.js').AnyCanvas} AnyCanvas
 * @typedef {[x: number, y: number, pressure: number, time?: number]} InkPoint time: ms since the stroke began
 * @typedef {{
 *   points: InkPoint[],
 *   brush?: string | Partial<BrushPreset>,
 *   size?: number,
 *   color?: string,
 *   ink?: number,
 *   tip?: number,
 *   seed?: number,
 *   heading?: [number, number]
 * }} InkStroke brush: a built-in preset id or settings; size: overrides the brush's size; ink: belly load at the start (0–1.5); tip: tip wetness at the start (defaults to a fresh dip)
 * @typedef {{ x: number, y: number, width: number, height: number }} Bounds
 * @typedef {{ dpr?: number, maxPixels?: number }} RenderOptions dpr: pixels per unit; maxPixels: cap on the bitmap's area (dpr is lowered to fit)
 */

const MAX_SIDE = 8192;

/**
 * A stroke's settings with defaults filled in.
 * @param {InkStroke} stroke
 */
export function resolve(stroke) {
	const brush = typeof stroke.brush === 'string' ? preset(stroke.brush) : { ...BRUSHES[0], ...stroke.brush };
	return { brush, size: stroke.size ?? brush.size, color: stroke.color ?? '#16110d', ink: stroke.ink ?? 1, seed: stroke.seed ?? 0 };
}

/**
 * How far ink can reach from a stroke's centreline: splayed bristles, ragged edges and wicking fibres.
 * @param {InkStroke} stroke
 */
export function strokeReach(stroke) {
	const { brush, size } = resolve(stroke);
	return reachOf(brush, size);
}

/**
 * The area a stroke can paint, in the stroke's units.
 * @param {InkStroke} stroke
 * @returns {Bounds}
 */
export function getStrokeBounds(stroke) {
	const { points } = stroke;
	if (!points.length) return { x: 0, y: 0, width: 0, height: 0 };
	let [minX, minY, maxX, maxY] = [Infinity, Infinity, -Infinity, -Infinity];
	for (const [x, y] of points) {
		minX = Math.min(minX, x);
		minY = Math.min(minY, y);
		maxX = Math.max(maxX, x);
		maxY = Math.max(maxY, y);
	}
	const reach = strokeReach(stroke);
	return { x: minX - reach, y: minY - reach, width: maxX - minX + reach * 2, height: maxY - minY + reach * 2 };
}

/**
 * Load a brush the way a stroke began: its settings, colour, ink and tip.
 * @param {Brush} brush
 * @param {InkStroke} stroke
 */
export function prepare(brush, stroke) {
	const { brush: settings, size, color, ink } = resolve(stroke);
	brush.set(settings);
	brush.size = size;
	brush.color = color;
	brush.dip(ink);
	if (stroke.tip !== undefined) brush.tip = stroke.tip;
}

/**
 * Feed points `from`…`to` (exclusive) of a stroke to a brush prepared for it.
 * @param {Brush} brush
 * @param {InkStroke} stroke
 * @param {number} [from]
 * @param {number} [to]
 */
export function trace(brush, stroke, from = 0, to = stroke.points.length) {
	const { points } = stroke;
	for (let i = from; i < to; i++) {
		const [x, y, p] = points[i];
		if (i === 0) brush.down(x, y, p, { seed: stroke.seed ?? 0, heading: stroke.heading });
		else brush.to(x, y, p);
	}
}

/**
 * Paint a stroke straight onto a surface, e.g. when opening a saved drawing.
 * @param {Surface} surface
 * @param {InkStroke} stroke
 * @param {{ record?: boolean }} [options] record: make an undo point first
 */
export function paintStroke(surface, stroke, { record = false } = {}) {
	const brush = new Brush(surface, undefined, { record });
	prepare(brush, stroke);
	trace(brush, stroke);
	brush.up();
	brush.destroy();
}

/** @param {InkPoint | undefined} a @param {InkPoint | undefined} b */
const samePoint = (a, b) => !!a && !!b && a[0] === b[0] && a[1] === b[1] && a[2] === b[2];

/** Everything about a stroke except its points. @param {InkStroke} stroke */
const identity = (stroke) => JSON.stringify([resolve(stroke), stroke.tip, stroke.heading]);

/**
 * Renders one stroke into its own bitmap, and keeps it up to date as the stroke
 * grows: new points are painted onto the existing bitmap, which matches a full
 * re-render pixel for pixel. The bitmap covers the stroke's bounds (with room to
 * grow while it is being drawn) and is aligned to whole device pixels.
 */
export class StrokeRenderer {
	/** @param {RenderOptions} [options] */
	constructor({ dpr = 1, maxPixels = 16_777_216 } = {}) {
		this.dpr = dpr;
		this.maxPixels = maxPixels;
		/** @type {Surface | null} */
		this.surface = null;
		/** @type {Brush | null} */
		this.brush = null;
		/** Pixels per unit actually used, after the size cap. */
		this.scale = dpr;
		/** The region the bitmap covers, in stroke units. @type {Bounds} */
		this.bounds = { x: 0, y: 0, width: 0, height: 0 };
		this.key = '';
		this.count = 0;
		/** @type {InkPoint | undefined} */
		this.last = undefined;
		this.complete = false;
		this.reach = 0;
	}

	/**
	 * Bring the bitmap up to date with a stroke.
	 * @param {InkStroke} stroke
	 * @param {{ complete?: boolean, dpr?: number }} [options] complete: lift the brush after the last point (false while drawing)
	 * @returns {boolean} whether the bitmap changed
	 */
	update(stroke, { complete = true, dpr = this.dpr } = {}) {
		const { points } = stroke;
		const key = `${identity(stroke)}|${dpr}`;
		const same = key === this.key && points.length >= this.count && samePoint(points[this.count - 1], this.last);
		if (same && points.length === this.count && complete === this.complete) return false;
		if (same && !this.complete && this.brush && this.fits(points, this.count)) {
			trace(this.brush, stroke, this.count);
			if (complete) this.brush.up();
		} else {
			this.start(stroke, complete, dpr);
		}
		this.key = key;
		this.dpr = dpr;
		this.count = points.length;
		this.last = points[points.length - 1];
		this.complete = complete;
		return true;
	}

	/**
	 * Re-render from scratch into a freshly sized bitmap.
	 * @param {InkStroke} stroke
	 * @param {boolean} complete
	 * @param {number} dpr
	 */
	start(stroke, complete, dpr) {
		this.destroy();
		if (!stroke.points.length) {
			this.bounds = { x: 0, y: 0, width: 0, height: 0 };
			return;
		}
		this.reach = strokeReach(stroke);
		const area = getStrokeBounds(stroke);
		const slack = complete ? 0 : Math.max(64, Math.max(area.width, area.height) * 0.5);
		const width = area.width + slack * 2;
		const height = area.height + slack * 2;
		const scale = Math.min(dpr, Math.sqrt(this.maxPixels / (width * height)), MAX_SIDE / width, MAX_SIDE / height);
		const left = Math.floor((area.x - slack) * scale);
		const top = Math.floor((area.y - slack) * scale);
		const right = Math.ceil((area.x + area.width + slack) * scale);
		const bottom = Math.ceil((area.y + area.height + slack) * scale);
		this.scale = scale;
		this.bounds = { x: left / scale, y: top / scale, width: (right - left) / scale, height: (bottom - top) / scale };
		this.surface = new Surface(null, { dpr: scale, origin: { x: this.bounds.x, y: this.bounds.y } });
		this.surface.resize(this.bounds.width, this.bounds.height);
		this.brush = new Brush(this.surface, undefined, { record: false });
		prepare(this.brush, stroke);
		trace(this.brush, stroke);
		if (complete) this.brush.up();
	}

	/**
	 * Whether points from `from` on stay inside the bitmap.
	 * @param {InkPoint[]} points
	 * @param {number} from
	 */
	fits(points, from) {
		const { x, y, width, height } = this.bounds;
		const r = this.reach;
		for (let i = from; i < points.length; i++) {
			const [px, py] = points[i];
			if (px - r < x || py - r < y || px + r > x + width || py + r > y + height) return false;
		}
		return true;
	}

	/** The bitmap: dried ink, or wet and dried ink composited while drawing. */
	get canvas() {
		if (!this.surface) return null;
		if (!this.brush?.active) return this.surface.dried;
		const out = createCanvas(this.surface.pixelWidth, this.surface.pixelHeight);
		this.surface.paint(context2d(out));
		return out;
	}

	/**
	 * Copy the current bitmap into a canvas, resizing it to match.
	 * @param {AnyCanvas} canvas
	 */
	paint(canvas) {
		const { surface } = this;
		if (!surface) {
			canvas.width = 1;
			canvas.height = 1;
			return;
		}
		if (canvas.width !== surface.pixelWidth) canvas.width = surface.pixelWidth;
		if (canvas.height !== surface.pixelHeight) canvas.height = surface.pixelHeight;
		surface.paint(context2d(canvas));
	}

	/**
	 * Free the bitmaps once they have been copied out with `paint`, but remember
	 * the stroke, so `update` still reports whether it changed. A changed stroke
	 * is then rendered from scratch.
	 */
	release() {
		this.brush?.destroy();
		this.surface?.destroy();
		this.brush = null;
		this.surface = null;
	}

	destroy() {
		this.release();
		this.key = '';
		this.count = 0;
		this.last = undefined;
		this.complete = false;
	}
}

/**
 * Render a stroke into a new bitmap.
 * @param {InkStroke} stroke
 * @param {RenderOptions} [options]
 * @returns {{ canvas: AnyCanvas, bounds: Bounds, dpr: number }} bounds: where the bitmap belongs, in stroke units; dpr: its pixels per unit
 */
export function renderStroke(stroke, options) {
	const renderer = new StrokeRenderer(options);
	renderer.update(stroke);
	return { canvas: renderer.canvas ?? createCanvas(1, 1), bounds: renderer.bounds, dpr: renderer.scale };
}

/**
 * Draw a stroke onto any 2D context, in that context's current coordinates.
 * @param {CanvasRenderingContext2D} ctx
 * @param {InkStroke} stroke
 * @param {RenderOptions & { blend?: GlobalCompositeOperation }} [options] dpr: match the context's pixel density for crisp output
 * @returns {Bounds}
 */
export function drawStroke(ctx, stroke, { blend = 'multiply', ...options } = {}) {
	const { canvas, bounds } = renderStroke(stroke, options);
	if (bounds.width && bounds.height) {
		ctx.save();
		ctx.globalCompositeOperation = blend;
		ctx.drawImage(canvas, bounds.x, bounds.y, bounds.width, bounds.height);
		ctx.restore();
	}
	return bounds;
}

/** @param {Uint8Array} bytes */
const toBase64 = (bytes) => {
	let binary = '';
	for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
	return btoa(binary);
};

/** @param {string} text */
const fromBase64 = (text) => Uint8Array.from(atob(text), (char) => char.charCodeAt(0));

/**
 * Pack points into a compact base64 string of little-endian float32s.
 * @param {InkPoint[]} points
 * @param {2 | 3 | 4} [dims] values kept per point: x, y (+ pressure) (+ time)
 */
export function encodePoints(points, dims = 3) {
	const view = new DataView(new ArrayBuffer(points.length * dims * 4));
	points.forEach((point, i) => {
		for (let d = 0; d < dims; d++) view.setFloat32((i * dims + d) * 4, point[d] ?? (d === 2 ? 0.5 : 0), true);
	});
	return toBase64(new Uint8Array(view.buffer));
}

/**
 * Unpack points made by `encodePoints`.
 * @param {string} text
 * @param {2 | 3 | 4} [dims]
 * @returns {InkPoint[]}
 */
export function decodePoints(text, dims = 3) {
	if (!text) return [];
	const bytes = fromBase64(text);
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	const count = Math.floor(bytes.byteLength / (dims * 4));
	return Array.from({ length: count }, (_, i) => {
		const at = (/** @type {number} */ d) => view.getFloat32((i * dims + d) * 4, true);
		/** @type {InkPoint} */
		const point = [at(0), at(1), dims > 2 ? at(2) : 0.5];
		if (dims > 3) point.push(at(3));
		return point;
	});
}
