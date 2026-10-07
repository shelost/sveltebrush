import { describe, expect, it } from 'vitest';
import { createInput, getStrokePoints } from '../src/index.js';

/** A horizontal line with alternating vertical jitter. */
const jittery = (count = 40, step = 4, jitter = 3) =>
	Array.from(
		{ length: count },
		(_, i) => /** @type {[number, number, number, number]} */ ([i * step, (i % 2 ? 1 : -1) * jitter, 0.5, i * 8])
	);

describe('createInput', () => {
	it('streamlining smooths jitter', () => {
		const spread = (/** @type {number} */ streamline) => {
			const points = getStrokePoints(jittery(), { streamline, last: false });
			const ys = points.slice(10).map((p) => p[1]);
			return Math.max(...ys) - Math.min(...ys);
		};
		expect(spread(0.8)).toBeLessThan(spread(0) * 0.5);
	});

	it('mice press harder when slow than when fast', () => {
		const pressureAt = (/** @type {number} */ speed) => {
			const input = createInput({ streamline: 0 });
			let last = input.push(0, 0, { time: 0 });
			for (let i = 1; i < 30; i++) last = input.push(i * speed * 8, 0, { time: i * 8 }) ?? last;
			return last?.[2] ?? 0;
		};
		expect(pressureAt(0.1)).toBeGreaterThan(pressureAt(2) + 0.3);
	});

	it('pens use real pressure', () => {
		const input = createInput({ pen: true, streamline: 0 });
		input.push(0, 0, { pressure: 0.9, time: 0 });
		let point = null;
		for (let i = 1; i < 30; i++) point = input.push(i * 2, 0, { pressure: 0.9, time: i * 8 });
		expect(point?.[2]).toBeCloseTo(1.1, 1);
	});

	it('accepts a known velocity instead of timestamps', () => {
		const input = createInput({ streamline: 0 });
		input.push(0, 0);
		let point = null;
		for (let i = 1; i < 30; i++) point = input.push(i * 2, 0, { velocity: 2 });
		expect(point?.[2]).toBeCloseTo(0.3, 1);
	});

	it('catches up with the pointer and flicks on a fast release', () => {
		const input = createInput({ streamline: 0.9 });
		input.push(0, 0, { time: 0 });
		for (let i = 1; i <= 10; i++) input.push(i * 20, 0, { time: i * 8 });
		const tail = input.end(30);
		expect(tail[0][0]).toBe(200);
		expect(tail.length).toBe(11);
		expect(tail.at(-1)?.[0]).toBeGreaterThan(200);
		expect(tail.at(-1)?.[2]).toBe(0);
	});

	it('rounds output so saved strokes hold exactly what was painted', () => {
		const points = getStrokePoints([
			[0.123456, 1.987654, 0.5, 0],
			[10.55555, 3.33333, 0.5, 12.3456]
		]);
		for (const [x, y, p, t] of points) {
			expect(x).toBe(+x.toFixed(2));
			expect(y).toBe(+y.toFixed(2));
			expect(p).toBe(+p.toFixed(3));
			expect(t).toBe(+(t ?? 0).toFixed(1));
		}
	});

	it('batch and incremental processing agree', () => {
		const samples = jittery();
		const input = createInput();
		const live = samples.flatMap(([x, y, , time]) => {
			const point = input.push(x, y, { time });
			return point ? [point] : [];
		});
		live.push(...input.end());
		expect(getStrokePoints(samples)).toEqual(live);
	});
});
