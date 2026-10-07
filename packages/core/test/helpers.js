import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { createCanvas, loadImage } from '@napi-rs/canvas';

/**
 * An S-shaped stroke with a pressure swell, as [x, y, p] points.
 * @param {{ x?: number, y?: number, length?: number, count?: number }} [options]
 * @returns {[number, number, number][]}
 */
export function sCurve({ x = 0, y = 0, length = 320, count = 64 } = {}) {
	return Array.from({ length: count }, (_, i) => {
		const t = i / (count - 1);
		return [x + t * length, y + Math.sin(t * Math.PI * 2) * 42, 0.35 + 0.7 * Math.sin(t * Math.PI)];
	});
}

/** @param {any} canvas */
export const pixels = (canvas) => canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;

/** @param {any} canvas @param {number} x @param {number} y @param {number} width @param {number} height */
export const region = (canvas, x, y, width, height) => canvas.getContext('2d').getImageData(x, y, width, height).data;

/**
 * Compare two RGBA buffers.
 * @param {Uint8ClampedArray} a
 * @param {Uint8ClampedArray} b
 * @param {number} [threshold] channel difference that counts as a changed pixel
 */
export function compare(a, b, threshold = 0) {
	if (a.length !== b.length) throw new Error(`Size mismatch: ${a.length} vs ${b.length}`);
	let changed = 0;
	let max = 0;
	let total = 0;
	for (let i = 0; i < a.length; i += 4) {
		let worst = 0;
		for (let c = 0; c < 4; c++) {
			const d = Math.abs(a[i + c] - b[i + c]);
			worst = Math.max(worst, d);
			total += d;
		}
		max = Math.max(max, worst);
		if (worst > threshold) changed++;
	}
	const count = a.length / 4;
	return { changed, ratio: changed / count, max, mean: total / a.length };
}

/** How many pixels carry any ink. @param {Uint8ClampedArray} data */
export function inked(data) {
	let count = 0;
	for (let i = 3; i < data.length; i += 4) if (data[i] > 0) count++;
	return count;
}

/**
 * Compare a canvas against a stored PNG, writing it if missing (or with UPDATE_SNAPSHOTS=1).
 * @param {any} canvas
 * @param {string} file
 */
export async function matchSnapshot(canvas, file) {
	if (process.env.UPDATE_SNAPSHOTS || !existsSync(file)) {
		mkdirSync(dirname(file), { recursive: true });
		writeFileSync(file, await canvas.encode('png'));
		return null;
	}
	const image = await loadImage(readFileSync(file));
	const expected = createCanvas(image.width, image.height);
	expected.getContext('2d').drawImage(image, 0, 0);
	if (image.width !== canvas.width || image.height !== canvas.height) {
		return { changed: Infinity, ratio: 1, max: 255, mean: 255, size: [image.width, image.height] };
	}
	return compare(pixels(canvas), pixels(expected), 40);
}

/**
 * Save a canvas for manual inspection (ignored by git).
 * @param {any} canvas
 * @param {string} file
 */
export async function save(canvas, file) {
	mkdirSync(dirname(file), { recursive: true });
	writeFileSync(file, await canvas.encode('png'));
}
