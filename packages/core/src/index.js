// Engine
export { Brush, halfWidth, reachOf, MAX_PRESSURE } from './brush.js';
export { Surface, Layer } from './surface.js';
export { BRUSHES, PROPERTIES, INKS, MAX_INK, preset } from './presets.js';

// Strokes as data
export {
	renderStroke,
	drawStroke,
	paintStroke,
	getStrokeBounds,
	strokeReach,
	StrokeRenderer,
	encodePoints,
	decodePoints,
	prepare,
	trace,
	resolve
} from './stroke.js';

// Input
export { createInput, getStrokePoints } from './input.js';
export { freehand } from './freehand.js';

// Calligraphy
export { createWriter, layout } from './writer.js';
export { stamp, sealHeight } from './seal.js';
export { glyph, writable, setGlyphSource } from './glyphs.js';
export { hangul, isHangul } from './hangul.js';
export { shape } from './path.js';
export { sampleStroke, drawPreview } from './preview.js';

// Documents and timelapses
export { Tape, play, paintDocument, renderVideo, videoType } from './timelapse.js';

// Platform and utilities
export { createCanvas, setCanvasFactory } from './canvas.js';
export { clamp, lerp, smoothstep, hash, random, newSeed, noise } from './math.js';

/**
 * @typedef {import('./presets.js').BrushPreset} BrushPreset
 * @typedef {import('./presets.js').BrushSetting} BrushSetting
 * @typedef {import('./presets.js').Property} Property
 * @typedef {import('./presets.js').PropertyGroup} PropertyGroup
 * @typedef {import('./stroke.js').InkPoint} InkPoint
 * @typedef {import('./stroke.js').InkStroke} InkStroke
 * @typedef {import('./stroke.js').Bounds} Bounds
 * @typedef {import('./stroke.js').RenderOptions} RenderOptions
 * @typedef {import('./input.js').Input} Input
 * @typedef {import('./input.js').InputOptions} InputOptions
 * @typedef {import('./input.js').Sample} Sample
 * @typedef {import('./brush.js').DownOptions} DownOptions
 * @typedef {import('./surface.js').SurfaceOptions} SurfaceOptions
 * @typedef {import('./seal.js').Seal} Seal
 * @typedef {import('./writer.js').WriteOptions} WriteOptions
 * @typedef {import('./writer.js').Cell} Cell
 * @typedef {import('./glyphs.js').Glyph} Glyph
 * @typedef {import('./hangul.js').Stroke} GlyphStroke
 * @typedef {import('./timelapse.js').InkDocument} InkDocument
 * @typedef {import('./timelapse.js').InkEvent} InkEvent
 * @typedef {import('./canvas.js').AnyCanvas} AnyCanvas
 * @typedef {import('./canvas.js').CanvasFactory} CanvasFactory
 */
