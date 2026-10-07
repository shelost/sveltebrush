import { SOFTWARE, cancelFrame, context2d, createCanvas, nextFrame } from './canvas.js';
import { random } from './math.js';
import { stamp } from './seal.js';

/**
 * A sheet of paper. Ink that has soaked in lives on an offscreen "dried" canvas;
 * each brush paints its current stroke opaquely onto its own wet layer, which is
 * shown at the stroke's density and merged when the brush lifts. Painting
 * opaquely is what keeps overlapping bristles and segments from stacking into
 * visible seams. The wet layer is displayed and dried through the same
 * composite, so a stroke never changes when the brush lifts.
 *
 * @typedef {import('./canvas.js').AnyCanvas} AnyCanvas
 * @typedef {{ record?: boolean }} CommitOptions record: push an undo point first
 * @typedef {{ x: number, y: number }} Point
 * @typedef {[left: number, top: number, right: number, bottom: number]} PixelBox device pixels; empty when right <= left
 * @typedef {{
 *   maxDpr?: number,
 *   dpr?: number,
 *   origin?: Point,
 *   onchange?: () => void
 * }} SurfaceOptions dpr: fixed pixel ratio; origin: the point (CSS px) at the sheet's top-left corner
 */

const HISTORY = 12;

/** @param {AnyCanvas} source */
const copy = (source) => {
	const canvas = createCanvas(source.width, source.height);
	context2d(canvas).drawImage(source, 0, 0);
	return canvas;
};

/** @type {AnyCanvas | null} */
let toothTile = null;

/** Tileable paper tooth: sparse specks and short fibres where ink fails to take. Seeded, so every sheet has the same paper. */
const tooth = () => {
	if (toothTile) return toothTile;
	toothTile = createCanvas(256, 256);
	const ctx = context2d(toothTile, SOFTWARE);
	const rand = random(0x7007);
	ctx.fillStyle = '#000';
	for (let i = 0; i < 1600; i++) {
		ctx.globalAlpha = 0.4 + rand() * 0.6;
		const size = rand() < 0.85 ? 1 : 2;
		ctx.fillRect(Math.floor(rand() * 256), Math.floor(rand() * 256), size, size);
	}
	ctx.strokeStyle = '#000';
	ctx.lineCap = 'round';
	for (let i = 0; i < 160; i++) {
		const x = rand() * 256;
		const y = rand() * 256;
		const angle = (rand() - 0.5) * 0.8;
		const length = 6 + rand() * 18;
		ctx.globalAlpha = 0.25 + rand() * 0.5;
		ctx.lineWidth = 0.6 + rand() * 0.8;
		ctx.beginPath();
		ctx.moveTo(x, y);
		ctx.quadraticCurveTo(x + length / 2, y + (rand() - 0.5) * 4, x + Math.cos(angle) * length, y + Math.sin(angle) * length);
		ctx.stroke();
	}
	return toothTile;
};

export class Layer {
	/** @param {Surface} surface */
	constructor(surface) {
		this.surface = surface;
		this.canvas = createCanvas(1, 1);
		this.ctx = context2d(this.canvas, SOFTWARE);
		this.opacity = 1;
		/** How much paper grain eats this stroke, 0–1. */
		this.tooth = 0;
		this.active = false;
		/** The pixels that may hold ink; only these are laid down and cleared. @type {PixelBox} */
		this.box = [0, 0, 0, 0];
		this.fit();
	}

	fit() {
		const { pixelWidth, pixelHeight } = this.surface;
		this.canvas.width = pixelWidth;
		this.canvas.height = pixelHeight;
		this.box = [0, 0, 0, 0];
		this.surface.place(this.ctx);
	}

	/**
	 * Note that ink may have landed inside a rectangle of sheet coordinates.
	 * Ink drawn outside every touched rectangle is never shown.
	 * @param {number} x0 @param {number} y0 @param {number} x1 @param {number} y1
	 */
	touch(x0, y0, x1, y1) {
		const { dpr, origin } = this.surface;
		const left = Math.max(0, Math.floor((x0 - origin.x) * dpr));
		const top = Math.max(0, Math.floor((y0 - origin.y) * dpr));
		const right = Math.min(this.canvas.width, Math.ceil((x1 - origin.x) * dpr));
		const bottom = Math.min(this.canvas.height, Math.ceil((y1 - origin.y) * dpr));
		if (right <= left || bottom <= top) return;
		const box = this.box;
		this.box =
			box[2] <= box[0]
				? [left, top, right, bottom]
				: [Math.min(box[0], left), Math.min(box[1], top), Math.max(box[2], right), Math.max(box[3], bottom)];
	}

	/** @param {number} opacity @param {number} [tooth] */
	begin(opacity, tooth = 0) {
		this.active = true;
		this.opacity = opacity;
		this.tooth = tooth;
	}

	/**
	 * Merge into the paper.
	 * @param {CommitOptions} [options]
	 */
	commit(options) {
		this.surface.commit(this, options);
		this.active = false;
		this.clear();
	}

	clear() {
		const [left, top, right, bottom] = this.box;
		if (right > left) {
			this.ctx.save();
			this.ctx.setTransform(1, 0, 0, 1, 0, 0);
			this.ctx.clearRect(left, top, right - left, bottom - top);
			this.ctx.restore();
		}
		this.box = [0, 0, 0, 0];
	}

	destroy() {
		this.surface.layers.delete(this);
	}
}

export class Surface {
	/**
	 * @param {AnyCanvas | null} canvas visible canvas (an element is sized from its CSS box), or null for an offscreen sheet
	 * @param {SurfaceOptions} [options]
	 */
	constructor(canvas, { maxDpr = 2, dpr, origin = { x: 0, y: 0 }, onchange } = {}) {
		this.canvas = canvas;
		this.ctx = canvas ? context2d(canvas) : null;
		this.dried = createCanvas(1, 1);
		this.paper = context2d(this.dried);
		/** Scratch sheet, sized to the ink being laid down, where paper tooth is cut out of it. */
		this.scratch = createCanvas(1, 1);
		this.scratchCtx = context2d(this.scratch, SOFTWARE);
		/** @type {CanvasPattern | null} */
		this.pattern = null;
		/** @type {Set<Layer>} */
		this.layers = new Set();
		/** @type {AnyCanvas[]} */
		this.past = [];
		/** @type {AnyCanvas[]} */
		this.future = [];
		this.width = 0;
		this.height = 0;
		this.pixelWidth = 1;
		this.pixelHeight = 1;
		this.maxDpr = maxDpr;
		this.fixedDpr = dpr;
		this.dpr = 1;
		this.origin = { x: origin.x, y: origin.y };
		this.frame = 0;
		this.onchange = onchange;
		/** Records strokes and history for documents and timelapses. @type {import('./timelapse.js').Tape | null} */
		this.tape = null;
	}

	/**
	 * Size the sheet in CSS px (an element canvas defaults to its CSS box), keeping dried ink.
	 * @param {number} [width]
	 * @param {number} [height]
	 */
	resize(width, height) {
		const element = this.canvas && 'clientWidth' in this.canvas ? this.canvas : null;
		width ??= element?.clientWidth ?? 0;
		height ??= element?.clientHeight ?? 0;
		const dpr = this.fixedDpr ?? Math.min(this.maxDpr, globalThis.devicePixelRatio || 1);
		if (!width || !height || (width === this.width && height === this.height && dpr === this.dpr)) return;
		const previous = this.width ? copy(this.dried) : null;
		const [oldWidth, oldHeight] = [this.width, this.height];
		this.width = width;
		this.height = height;
		this.dpr = dpr;
		this.pixelWidth = Math.max(1, Math.round(width * dpr));
		this.pixelHeight = Math.max(1, Math.round(height * dpr));
		for (const canvas of [this.canvas, this.dried]) {
			if (!canvas) continue;
			canvas.width = this.pixelWidth;
			canvas.height = this.pixelHeight;
		}
		if (previous) this.paper.drawImage(previous, 0, 0, oldWidth * dpr, oldHeight * dpr);
		this.place(this.paper);
		for (const layer of this.layers) layer.fit();
		this.render();
	}

	/**
	 * Give a context of this sheet's size the sheet's coordinate system: CSS px, offset by `origin`.
	 * @param {CanvasRenderingContext2D} ctx
	 */
	place(ctx) {
		const { dpr, origin } = this;
		ctx.setTransform(dpr, 0, 0, dpr, -origin.x * dpr, -origin.y * dpr);
	}

	layer() {
		const layer = new Layer(this);
		this.layers.add(layer);
		return layer;
	}

	invalidate() {
		if (!this.ctx || this.frame) return;
		this.frame = nextFrame(() => {
			this.frame = 0;
			this.render();
		});
	}

	render() {
		if (this.ctx) this.paint(this.ctx);
	}

	/**
	 * Draw the sheet — dried ink plus any wet strokes — onto a context of the same pixel size.
	 * @param {CanvasRenderingContext2D} target
	 */
	paint(target) {
		target.save();
		target.setTransform(1, 0, 0, 1, 0, 0);
		target.globalCompositeOperation = 'source-over';
		target.globalAlpha = 1;
		target.clearRect(0, 0, target.canvas.width, target.canvas.height);
		target.drawImage(this.dried, 0, 0);
		for (const layer of this.layers) if (layer.active) this.composite(target, layer);
		target.restore();
	}

	/**
	 * Lay a wet layer onto a target (the screen or the paper) at its density,
	 * with the paper's tooth cut out. Only the layer's box is copied, so a small
	 * stroke on a large sheet stays cheap to show. The tooth is anchored to sheet
	 * coordinates, so it lands on the same spots whatever the sheet's origin.
	 * Expects an identity transform on `target`.
	 * @param {CanvasRenderingContext2D} target
	 * @param {Layer} layer
	 */
	composite(target, layer) {
		const [left, top, right, bottom] = layer.box;
		const width = right - left;
		const height = bottom - top;
		if (width <= 0 || height <= 0) return;
		const { scratch, scratchCtx: ctx } = this;
		if (scratch.width !== width || scratch.height !== height) {
			scratch.width = width;
			scratch.height = height;
		} else {
			ctx.clearRect(0, 0, width, height);
		}
		ctx.drawImage(layer.canvas, left, top, width, height, 0, 0, width, height);
		if (layer.tooth > 0.01) {
			const x = left + Math.round(this.origin.x * this.dpr);
			const y = top + Math.round(this.origin.y * this.dpr);
			this.pattern ??= ctx.createPattern(tooth(), 'repeat');
			ctx.save();
			ctx.setTransform(1, 0, 0, 1, -x, -y);
			ctx.globalCompositeOperation = 'destination-out';
			ctx.globalAlpha = Math.min(1, layer.tooth);
			if (this.pattern) ctx.fillStyle = this.pattern;
			ctx.fillRect(x, y, width, height);
			ctx.restore();
		}
		target.globalCompositeOperation = 'multiply';
		target.globalAlpha = layer.opacity;
		target.drawImage(scratch, 0, 0, width, height, left, top, width, height);
	}

	/**
	 * @param {Layer} layer
	 * @param {CommitOptions} [options]
	 */
	commit(layer, { record = true } = {}) {
		if (record) this.push();
		this.paper.save();
		this.paper.setTransform(1, 0, 0, 1, 0, 0);
		this.composite(this.paper, layer);
		this.paper.restore();
		this.invalidate();
	}

	/**
	 * Press a seal onto the paper. Recorded, so documents and timelapses replay it.
	 * @param {import('./seal.js').Seal} seal
	 */
	seal(seal) {
		this.tape?.seal(seal);
		this.paper.save();
		stamp(this.paper, seal);
		this.paper.restore();
		this.invalidate();
	}

	/**
	 * Draw straight onto the paper in sheet coordinates. Not recorded: use strokes
	 * or `seal` for anything that should be saved or replayed.
	 * @param {(ctx: CanvasRenderingContext2D) => void} paint
	 */
	draw(paint) {
		this.paper.save();
		paint(this.paper);
		this.paper.restore();
		this.invalidate();
	}

	/** Push an undo point. Call once before a group of strokes that should undo together. */
	remember() {
		this.tape?.mark('remember');
		this.push();
	}

	push() {
		this.past.push(copy(this.dried));
		if (this.past.length > HISTORY) this.past.shift();
		this.future = [];
		this.onchange?.();
	}

	/** @param {AnyCanvas} state */
	restore(state) {
		this.paper.save();
		this.paper.setTransform(1, 0, 0, 1, 0, 0);
		this.paper.clearRect(0, 0, this.dried.width, this.dried.height);
		this.paper.drawImage(state, 0, 0, this.dried.width, this.dried.height);
		this.paper.restore();
		this.invalidate();
		this.onchange?.();
	}

	undo() {
		const state = this.past.pop();
		if (!state) return;
		this.tape?.mark('undo');
		this.future.push(copy(this.dried));
		this.restore(state);
	}

	redo() {
		const state = this.future.pop();
		if (!state) return;
		this.tape?.mark('redo');
		this.past.push(copy(this.dried));
		this.restore(state);
	}

	clear() {
		this.remember();
		this.wipe();
	}

	/** Clear without an undo point. */
	wipe() {
		this.tape?.mark('wipe');
		this.paper.save();
		this.paper.setTransform(1, 0, 0, 1, 0, 0);
		this.paper.clearRect(0, 0, this.dried.width, this.dried.height);
		this.paper.restore();
		this.invalidate();
	}

	/** Forget all undo and redo states. */
	forget() {
		this.past = [];
		this.future = [];
		this.onchange?.();
	}

	/**
	 * The dried ink as a new canvas, optionally laid on a paper colour.
	 * @param {string} [background]
	 */
	flatten(background) {
		const out = createCanvas(this.dried.width, this.dried.height);
		const ctx = context2d(out);
		if (background) {
			ctx.fillStyle = background;
			ctx.fillRect(0, 0, out.width, out.height);
			ctx.globalCompositeOperation = 'multiply';
		}
		ctx.drawImage(this.dried, 0, 0);
		return out;
	}

	/**
	 * Export the sheet as an image.
	 * @param {{ background?: string, type?: string }} [options]
	 * @returns {Promise<Blob | null>}
	 */
	toBlob({ background, type = 'image/png' } = {}) {
		const out = this.flatten(background);
		if ('convertToBlob' in out) return out.convertToBlob({ type });
		return new Promise((resolve) => out.toBlob(resolve, type));
	}

	destroy() {
		cancelFrame(this.frame);
		this.frame = 0;
		this.layers.clear();
	}
}
