import { Path2D, createCanvas } from '@napi-rs/canvas';
import { setCanvasFactory } from '../src/canvas.js';

// Run the engine headless: Skia canvases from @napi-rs/canvas stand in for the DOM.
globalThis.Path2D ??= /** @type {any} */ (Path2D);
setCanvasFactory((width, height) => /** @type {any} */ (createCanvas(width, height)));
