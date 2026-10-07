import { fileURLToPath } from 'node:url';
import { createCanvas } from '@napi-rs/canvas';
import { describe, expect, it } from 'vitest';
import {
	BRUSHES,
	Brush,
	StrokeRenderer,
	Surface,
	Tape,
	decodePoints,
	encodePoints,
	getStrokeBounds,
	paintDocument,
	play,
	renderStroke
} from '../src/index.js';
import { compare, inked, matchSnapshot, pixels, region, sCurve } from './helpers.js';

const SNAPSHOTS = fileURLToPath(new URL('./__snapshots__/', import.meta.url));

/** @param {Partial<import('../src/index.js').InkStroke>} [extra] @returns {import('../src/index.js').InkStroke} */
const stroke = (extra = {}) => ({
	points: sCurve({ x: 70, y: 110 }),
	brush: 'center',
	size: 32,
	color: '#16110d',
	ink: 1,
	seed: 1234,
	...extra
});

/** A sheet with a visible canvas, so wet strokes can be seen before they dry. */
const sheet = (width = 420, height = 200, dpr = 1) => {
	const surface = new Surface(/** @type {any} */ (createCanvas(1, 1)), { dpr });
	surface.resize(width, height);
	return surface;
};

/** @param {Surface} surface */
const screen = (surface) => {
	surface.render();
	return pixels(surface.canvas);
};

describe('point encoding', () => {
	it('round-trips through base64 float32', () => {
		const points = /** @type {import('../src/index.js').InkPoint[]} */ (sCurve().map(([x, y, p], i) => [x, y, p, i * 8.5]));
		const decoded = decodePoints(encodePoints(points, 4), 4);
		expect(decoded).toHaveLength(points.length);
		decoded.forEach((point, i) => point.forEach((value, d) => expect(value).toBeCloseTo(points[i][d] ?? 0, 3)));
		expect(decodePoints(encodePoints(points), 3)[5]).toHaveLength(3);
		expect(decodePoints('')).toEqual([]);
	});
});

describe('renderStroke', () => {
	it('is deterministic', () => {
		const a = renderStroke(stroke());
		const b = renderStroke(stroke());
		expect(a.bounds).toEqual(b.bounds);
		expect(compare(pixels(a.canvas), pixels(b.canvas)).changed).toBe(0);
		expect(inked(pixels(a.canvas))).toBeGreaterThan(5000);
	});

	it('changes texture with the seed, not the shape', () => {
		const a = pixels(renderStroke(stroke()).canvas);
		const b = pixels(renderStroke(stroke({ seed: 99 })).canvas);
		const { ratio } = compare(a, b, 60);
		expect(ratio).toBeGreaterThan(0.002);
		expect(Math.abs(inked(a) - inked(b)) / inked(a)).toBeLessThan(0.1);
	});

	it('keeps all ink inside the bounds, even for wet, laid-over, flooded brushes', () => {
		for (const brush of [...BRUSHES, { ...BRUSHES[1], bleed: 1, water: 1, tilt: 1, grain: 1 }]) {
			const { canvas } = renderStroke(stroke({ brush, size: 64, ink: 1.5 }));
			const { width, height } = canvas;
			const edges = [
				region(canvas, 0, 0, width, 1),
				region(canvas, 0, height - 1, width, 1),
				region(canvas, 0, 0, 1, height),
				region(canvas, width - 1, 0, 1, height)
			];
			for (const edge of edges) expect(inked(edge)).toBe(0);
		}
	});

	it('scales with dpr', () => {
		const one = renderStroke(stroke(), { dpr: 1 });
		const two = renderStroke(stroke(), { dpr: 2 });
		expect(Math.abs(two.canvas.width - one.canvas.width * 2)).toBeLessThanOrEqual(2);
		expect(Math.abs(two.bounds.width - one.bounds.width)).toBeLessThanOrEqual(2);
	});

	it('limits the bitmap size', () => {
		const huge = renderStroke(stroke({ points: sCurve({ length: 20000 }) }), { dpr: 2, maxPixels: 4_000_000 });
		expect(huge.canvas.width * huge.canvas.height).toBeLessThanOrEqual(4_100_000);
		expect(huge.dpr).toBeLessThan(2);
	});

	it('matches the stored golden images', async () => {
		for (const brush of BRUSHES) {
			const { canvas } = renderStroke(stroke({ brush: brush.id }), { dpr: 1 });
			const result = await matchSnapshot(canvas, `${SNAPSHOTS}${brush.id}.png`);
			if (result) expect(result.ratio, `${brush.id}: ${JSON.stringify(result)}`).toBeLessThan(0.02);
		}
	});
});

describe('StrokeRenderer', () => {
	it('drawing incrementally matches rendering at once', () => {
		const full = stroke();
		const renderer = new StrokeRenderer();
		for (let n = 1; n <= full.points.length; n += 3) renderer.update({ ...full, points: full.points.slice(0, n) }, { complete: false });
		renderer.update(full, { complete: true });
		const once = renderStroke(full);
		const live = /** @type {any} */ (renderer.canvas);
		const dx = Math.round(once.bounds.x - renderer.bounds.x);
		const dy = Math.round(once.bounds.y - renderer.bounds.y);
		expect(dx).toBeGreaterThanOrEqual(0);
		const result = compare(region(live, dx, dy, once.canvas.width, once.canvas.height), pixels(once.canvas), 2);
		expect(result.ratio).toBeLessThan(0.0005);
	});

	it('skips work when nothing changed', () => {
		const renderer = new StrokeRenderer();
		expect(renderer.update(stroke())).toBe(true);
		expect(renderer.update(stroke())).toBe(false);
		expect(renderer.update(stroke({ color: '#b5281c' }))).toBe(true);
	});
});

describe('surfaces', () => {
	it('a stroke looks the same wet and dry (nothing changes on lift)', () => {
		const surface = sheet();
		const brush = new Brush(surface, BRUSHES[2]);
		const points = sCurve({ x: 40, y: 100 });
		brush.down(points[0][0], points[0][1], points[0][2], { seed: 5 });
		for (const [x, y, p] of points.slice(1)) brush.to(x, y, p);
		const wet = screen(surface);
		brush.up();
		expect(compare(wet, screen(surface)).changed).toBe(0);
	});

	it('pixels depend only on the points, not on how they were batched', () => {
		const points = sCurve({ x: 40, y: 100 });
		const paint = (/** @type {number} */ every) => {
			const surface = sheet();
			const brush = new Brush(surface);
			brush.down(points[0][0], points[0][1], points[0][2], { seed: 9 });
			points.slice(1).forEach(([x, y, p], i) => {
				brush.to(x, y, p);
				if (i % every === 0) brush.flush();
			});
			brush.up();
			return screen(surface);
		};
		expect(compare(paint(1), paint(7)).changed).toBe(0);
	});

	it('a recorded drawing replays pixel for pixel, through JSON', async () => {
		const live = sheet();
		live.tape = new Tape({ width: 420, height: 200 });
		const brush = new Brush(live, BRUSHES[0]);
		const strokes = [sCurve({ x: 30, y: 60, length: 300 }), sCurve({ x: 60, y: 130, length: 280, count: 40 })];
		for (const points of strokes) {
			brush.down(points[0][0], points[0][1], points[0][2]);
			for (const [x, y, p] of points.slice(1)) brush.to(x, y, p);
			brush.up();
		}
		live.seal({ text: '永', x: 360, y: 120, size: 30, seed: 3 });
		live.remember();
		brush.down(10, 10, 0.8);
		brush.to(200, 20, 0.6);
		brush.up();
		live.undo();
		const expected = screen(live);

		const document = JSON.parse(JSON.stringify(live.tape));
		expect(document.version).toBe(1);
		expect(document.events.map((/** @type {any} */ e) => e.type)).toEqual(['stroke', 'stroke', 'seal', 'remember', 'stroke', 'undo']);

		const replay = sheet();
		paintDocument(Tape.from(document), replay);
		expect(compare(expected, screen(replay)).changed).toBe(0);

		const played = sheet();
		const player = play(document, played, { duration: 50 });
		expect(await player.done).toBe(true);
		expect(compare(expected, screen(played)).changed).toBe(0);
	});

	it('a stroke paints the same whatever the brush painted before', () => {
		const points = sCurve({ x: 60, y: 100, length: 280 });
		const paint = (/** @type {boolean} */ used) => {
			const surface = sheet();
			const brush = new Brush(surface);
			if (used) {
				brush.down(380, 180, 0.8);
				brush.to(300, 20, 0.6);
				brush.up();
				surface.wipe();
			}
			brush.dip(1);
			brush.down(points[0][0], points[0][1], points[0][2], { seed: 21 });
			for (const [x, y, p] of points.slice(1)) brush.to(x, y, p);
			brush.up();
			return screen(surface);
		};
		expect(compare(paint(true), paint(false)).changed).toBe(0);
	});

	it('showing a stroke while it is drawn does not change how it dries', () => {
		const points = sCurve({ x: 40, y: 100 });
		const paint = (/** @type {boolean} */ shown) => {
			const surface = sheet();
			const brush = new Brush(surface, BRUSHES[1]);
			brush.down(points[0][0], points[0][1], points[0][2], { seed: 13 });
			for (const [x, y, p] of points.slice(1)) {
				brush.to(x, y, p);
				if (shown) surface.render();
			}
			brush.up();
			return screen(surface);
		};
		expect(compare(paint(true), paint(false)).changed).toBe(0);
	});

	it('a drawing made by several brushes taking turns replays exactly', async () => {
		const live = sheet();
		live.tape = new Tape({ width: 420, height: 200 });
		const hand = new Brush(live, BRUSHES[0]);
		const scribe = new Brush(live, BRUSHES[2], { record: false });
		/** @param {Brush} brush @param {[number, number, number][]} points @param {[number, number]} [heading] */
		const line = (brush, points, heading) => {
			brush.down(points[0][0], points[0][1], points[0][2], { heading });
			for (const [x, y, p] of points.slice(1)) brush.to(x, y, p);
			brush.up();
		};
		line(hand, sCurve({ x: 30, y: 70, length: 250, count: 40 }));
		line(
			scribe,
			[
				[300, 30, 0.5],
				[306, 100, 0.9],
				[310, 170, 0.4]
			],
			[0, 1]
		);
		line(hand, sCurve({ x: 330, y: 140, length: -280, count: 40 }));
		live.remember();
		line(
			scribe,
			[
				[60, 20, 0.6],
				[200, 30, 0.8]
			],
			[1, 0]
		);
		live.undo();
		line(hand, [
			[40, 180, 0.7],
			[120, 120, 0.9],
			[200, 60, 0.5]
		]);
		const expected = screen(live);
		const document = JSON.parse(JSON.stringify(live.tape));

		const replay = sheet();
		paintDocument(Tape.from(document), replay);
		expect(compare(expected, screen(replay)).changed).toBe(0);

		const played = sheet();
		expect(await play(document, played, { duration: 50 }).done).toBe(true);
		expect(compare(expected, screen(played)).changed).toBe(0);
	});

	it('a stroke renders the same on its own as on a sheet', () => {
		const surface = sheet(480, 240);
		const ink = stroke();
		const brush = new Brush(surface, undefined, { record: false });
		brush.set(BRUSHES[0]);
		brush.size = 32;
		brush.dip(1);
		brush.down(ink.points[0][0], ink.points[0][1], ink.points[0][2], { seed: 1234 });
		for (const [x, y, p] of ink.points.slice(1)) brush.to(x, y, p);
		brush.up();
		surface.render();
		const alone = renderStroke(ink);
		const { x, y } = alone.bounds;
		const on = region(surface.canvas, Math.round(x), Math.round(y), alone.canvas.width, alone.canvas.height);
		expect(compare(on, pixels(alone.canvas), 2).ratio).toBeLessThan(0.0005);
	});

	it('bounds are snapped to whole device pixels', () => {
		const bounds = getStrokeBounds(stroke());
		const renderer = new StrokeRenderer({ dpr: 1.5 });
		renderer.update(stroke());
		expect(renderer.bounds.x * 1.5).toBeCloseTo(Math.round(renderer.bounds.x * 1.5), 6);
		expect(renderer.bounds.x).toBeLessThanOrEqual(bounds.x);
		expect(renderer.bounds.x + renderer.bounds.width).toBeGreaterThanOrEqual(bounds.x + bounds.width);
	});
});
