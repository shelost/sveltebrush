import { Brush } from './brush.js';
import { shape } from './path.js';
import { Surface } from './surface.js';

/**
 * Paint one S-shaped sample stroke across a surface with a fully loaded brush,
 * using the same pressure profile the writer uses. Seeded, so a brush's
 * thumbnail looks the same every time.
 * @param {Surface} surface
 * @param {Partial<import('./presets.js').BrushPreset>} preset
 * @param {{ color?: string, scale?: number, seed?: number }} [options] scale: brush size relative to the surface height
 */
export function sampleStroke(surface, preset, { color, scale, seed = 7 } = {}) {
	const { width, height } = surface;
	if (!width || !height) return;
	const brush = new Brush(surface, preset, { color, record: false });
	if (scale) brush.size = height * scale;
	brush.dip(1);
	const line = Array.from({ length: 24 }, (_, i) => {
		const t = i / 23;
		return /** @type {[number, number]} */ ([width * (0.1 + 0.8 * t), height * (0.5 + Math.sin(t * Math.PI * 2) * 0.22 - (t - 0.5) * 0.1)]);
	});
	const { samples } = shape(line, brush.size, { seed });
	const [a, b] = [samples[0], samples[Math.min(3, samples.length - 1)]];
	brush.down(a.x, a.y, a.p, { heading: [b.x - a.x, b.y - a.y], seed });
	for (const point of samples) brush.to(point.x, point.y, point.p);
	brush.up();
	brush.destroy();
	surface.render();
}

/**
 * Render a brush thumbnail into a canvas sized by CSS.
 * @param {HTMLCanvasElement} canvas
 * @param {Partial<import('./presets.js').BrushPreset>} preset
 * @param {{ color?: string }} [options]
 */
export function drawPreview(canvas, preset, options = {}) {
	const surface = new Surface(canvas);
	surface.resize();
	sampleStroke(surface, preset, { ...options, scale: 0.26 });
	surface.destroy();
}
