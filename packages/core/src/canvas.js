/**
 * Canvas creation and frame scheduling, overridable so the engine also runs in
 * workers (OffscreenCanvas) and in Node (e.g. `@napi-rs/canvas`) for server-side
 * rendering and tests.
 *
 * @typedef {HTMLCanvasElement | OffscreenCanvas} AnyCanvas
 * @typedef {(width: number, height: number) => AnyCanvas} CanvasFactory
 */

/** @type {CanvasFactory} */
let factory = (width, height) => {
	if (typeof document !== 'undefined') {
		const canvas = document.createElement('canvas');
		canvas.width = width;
		canvas.height = height;
		return canvas;
	}
	return new OffscreenCanvas(width, height);
};

/**
 * Create a blank canvas through the current factory.
 * @param {number} [width]
 * @param {number} [height]
 * @returns {AnyCanvas}
 */
export const createCanvas = (width = 1, height = 1) => factory(Math.max(1, Math.round(width)), Math.max(1, Math.round(height)));

/**
 * Replace how canvases are created, e.g. `setCanvasFactory((w, h) => createCanvas(w, h))`
 * with `@napi-rs/canvas` in Node. Remember to also provide a global `Path2D` there.
 * @param {CanvasFactory} create
 */
export function setCanvasFactory(create) {
	factory = create;
}

/**
 * Context settings for canvases that ink is rasterised into. GPU canvases
 * anti-alias paths differently depending on how drawing commands happen to be
 * batched between reads, so a stroke shown on screen while it was drawn would
 * dry differently from the same stroke replayed. Software rendering gives the
 * same pixels however the work is split up.
 * @type {CanvasRenderingContext2DSettings}
 */
export const SOFTWARE = { willReadFrequently: true };

/**
 * The 2D context of any supported canvas.
 * @param {AnyCanvas} canvas
 * @param {CanvasRenderingContext2DSettings} [settings] only the first call for a canvas can set these
 * @returns {CanvasRenderingContext2D}
 */
export const context2d = (canvas, settings) =>
	/** @type {CanvasRenderingContext2D} */ (/** @type {HTMLCanvasElement} */ (canvas).getContext('2d', settings));

/**
 * `requestAnimationFrame` where there is one, a 16 ms timer elsewhere.
 * @param {(time: number) => void} callback
 * @returns {number}
 */
export const nextFrame = (callback) =>
	typeof requestAnimationFrame === 'function'
		? requestAnimationFrame(callback)
		: /** @type {number} */ (/** @type {unknown} */ (setTimeout(() => callback(performance.now()), 16)));

/** @param {number} id */
export const cancelFrame = (id) => {
	if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(id);
	else clearTimeout(id);
};
