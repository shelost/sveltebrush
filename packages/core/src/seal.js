import { random } from './math.js';

/**
 * A red artist's seal (낙관 · 落款), described as plain data so documents and
 * timelapses can replay it exactly.
 *
 * @typedef {{
 *   text: string,
 *   x: number,
 *   y: number,
 *   size: number,
 *   seed?: number,
 *   color?: string,
 *   font?: string
 * }} Seal x, y: top-left corner and size: width, in CSS px; seed: tilt and speckle
 */

/**
 * Height of a seal: one row per character.
 * @param {string} text
 * @param {number} size
 */
export const sealHeight = (text, size) => size * Math.max(1, [...text].length) * 0.55 + size * 0.2;

/**
 * Press a seal onto a canvas: a red block with the characters cut out of it,
 * slightly tilted and speckled where the paste did not take.
 * @param {CanvasRenderingContext2D} ctx
 * @param {Seal} seal
 */
export function stamp(ctx, { text, x, y, size, seed = 1, color = '#b5281c', font = '"Gowun Batang", serif' }) {
	const rand = random(seed);
	const chars = [...text];
	const height = sealHeight(text, size);
	ctx.save();
	ctx.translate(x + size / 2, y + height / 2);
	ctx.rotate((rand() - 0.5) * 0.06);
	ctx.translate(-size / 2, -height / 2);
	ctx.globalAlpha = 0.88;
	ctx.fillStyle = color;
	ctx.beginPath();
	ctx.roundRect(0, 0, size, height, size * 0.08);
	ctx.fill();
	ctx.globalCompositeOperation = 'destination-out';
	ctx.fillStyle = '#000';
	ctx.font = `700 ${size * 0.5}px ${font}`;
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	chars.forEach((char, i) => ctx.fillText(char, size / 2, size * 0.1 + size * 0.55 * (i + 0.5)));
	for (let i = 0; i < 70; i++) {
		ctx.globalAlpha = rand() * 0.5;
		ctx.fillRect(rand() * size, rand() * height, rand() * 2.5, rand() * 2.5);
	}
	ctx.restore();
}
