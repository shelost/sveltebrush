import { describe, expect, it } from 'vitest';
import { BRUSHES, clamp, hangul, isHangul, layout, noise, preset, random, writable } from '../src/index.js';

describe('math', () => {
	it('seeded random is reproducible and in range', () => {
		const a = random(42);
		const b = random(42);
		const values = Array.from({ length: 100 }, () => a());
		expect(values).toEqual(Array.from({ length: 100 }, () => b()));
		expect(values.every((v) => v >= 0 && v < 1)).toBe(true);
		expect(random(43)()).not.toBe(values[0]);
	});

	it('noise is smooth and bounded', () => {
		for (let x = 0; x < 20; x += 0.37) {
			const v = noise(x);
			expect(v).toBeGreaterThanOrEqual(0);
			expect(v).toBeLessThanOrEqual(1);
			expect(Math.abs(noise(x + 0.001) - v)).toBeLessThan(0.01);
		}
		expect(clamp(5, 0, 1)).toBe(1);
	});
});

describe('presets', () => {
	it('returns independent copies', () => {
		const brush = preset('side');
		brush.size = 1;
		expect(preset('side').size).toBe(BRUSHES[1].size);
		expect(preset('unknown').id).toBe(BRUSHES[0].id);
	});
});

describe('hangul', () => {
	it('composes syllables from jamo', () => {
		expect(isHangul('한')).toBe(true);
		expect(isHangul('漢')).toBe(false);
		const strokes = hangul('한');
		expect(strokes?.length).toBeGreaterThan(4);
		for (const stroke of strokes ?? []) {
			for (const [x, y] of stroke) {
				expect(x).toBeGreaterThanOrEqual(-0.05);
				expect(x).toBeLessThanOrEqual(1.05);
				expect(y).toBeGreaterThanOrEqual(-0.05);
				expect(y).toBeLessThanOrEqual(1.05);
			}
		}
		expect(hangul('ㅎ')?.length).toBeGreaterThan(0);
		expect(hangul('A')).toBeNull();
	});

	it('knows which characters it can write', () => {
		expect(writable('永')).toBe(true);
		expect(writable('사')).toBe(true);
		expect(writable('a')).toBe(false);
	});
});

describe('layout', () => {
	it('centres a single character', () => {
		const [cell] = layout('永', { width: 400, height: 400, padding: 40 });
		expect(cell.char).toBe('永');
		expect(cell.x + cell.cell / 2).toBeCloseTo(200, 0);
		expect(cell.y + cell.cell / 2).toBeCloseTo(200, 0);
	});

	it('wraps to fit and reads columns right to left', () => {
		const cells = layout('風林火山', { width: 300, height: 900, vertical: true, padding: 20 });
		expect(cells).toHaveLength(4);
		expect(cells[1].y).toBeGreaterThan(cells[0].y);
		for (const cell of cells) {
			expect(cell.x).toBeGreaterThanOrEqual(20 - 1e-6);
			expect(cell.x + cell.cell).toBeLessThanOrEqual(280 + 1e-6);
		}
	});
});
