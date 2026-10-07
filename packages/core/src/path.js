/**
 * Turns a sparse centerline into a dense, smoothed path with a calligraphic
 * pressure profile: a pressed entry, a lighter body, weight on the turns, and an
 * ending that presses, tapers (left-falling 撇), flicks out (right-falling 捺),
 * or, on some long verticals, thins to a needle point (懸針).
 */

import { clamp, lerp, newSeed, noise, random, smoothstep } from './math.js';

/** @typedef {{ x: number, y: number, p: number, d: number }} Sample */

/** @param {[number, number][]} points @param {number} spacing */
function resample(points, spacing) {
	/** @type {[number, number][]} */
	const out = [points[0]];
	let carry = 0;
	for (let i = 1; i < points.length; i++) {
		const [ax, ay] = points[i - 1];
		const [bx, by] = points[i];
		const len = Math.hypot(bx - ax, by - ay);
		let t = spacing - carry;
		while (t <= len) {
			out.push([ax + ((bx - ax) * t) / len, ay + ((by - ay) * t) / len]);
			t += spacing;
		}
		carry = len - (t - spacing);
	}
	const last = points[points.length - 1];
	if (out.length < 2 || Math.hypot(out[out.length - 1][0] - last[0], out[out.length - 1][1] - last[1]) > spacing * 0.3) {
		out.push(last);
	}
	return out;
}

/**
 * Symmetric moving average that shrinks near the ends, so endpoints stay put.
 * @param {[number, number][]} points @param {number} radius @param {number} [passes]
 */
function smooth(points, radius, passes = 2) {
	let current = points;
	for (let pass = 0; pass < passes; pass++) {
		current = current.map((_, i) => {
			const r = Math.min(radius, i, current.length - 1 - i);
			let x = 0;
			let y = 0;
			for (let j = i - r; j <= i + r; j++) {
				x += current[j][0];
				y += current[j][1];
			}
			return /** @type {[number, number]} */ ([x / (2 * r + 1), y / (2 * r + 1)]);
		});
	}
	return current;
}

/** @param {[number, number][]} points @param {number} i @param {number} k */
function turning(points, i, k) {
	const a = points[Math.max(0, i - k)];
	const b = points[i];
	const c = points[Math.min(points.length - 1, i + k)];
	const ux = b[0] - a[0];
	const uy = b[1] - a[1];
	const vx = c[0] - b[0];
	const vy = c[1] - b[1];
	const lu = Math.hypot(ux, uy);
	const lv = Math.hypot(vx, vy);
	if (lu < 1e-6 || lv < 1e-6) return 0;
	return Math.acos(clamp((ux * vx + uy * vy) / (lu * lv), -1, 1));
}

/** @param {[number, number][]} points @param {number} from fraction of length to measure the exit over */
function exitDirection(points, from) {
	const end = points[points.length - 1];
	const start = points[Math.floor((points.length - 1) * from)];
	const dx = end[0] - start[0];
	const dy = end[1] - start[1];
	const len = Math.hypot(dx, dy) || 1;
	return [dx / len, dy / len];
}

/**
 * @param {[number, number][]} stroke centerline in pixels
 * @param {number} size brush width in pixels
 * @param {{ seed?: number }} [options] seed: fixes the pressure wobble and ending choice
 * @returns {{ samples: Sample[], length: number }}
 */
export function shape(stroke, size, { seed = newSeed() } = {}) {
	const rand = random(seed);
	const [sx, sy] = stroke[0];
	let rough = 0;
	for (let i = 1; i < stroke.length; i++) {
		rough += Math.hypot(stroke[i][0] - stroke[i - 1][0], stroke[i][1] - stroke[i - 1][1]);
	}
	const hook = Math.min(size * 0.3, rough * 0.12);
	const entry = /** @type {[number, number]} */ ([sx - hook * 0.75, sy - hook]);
	const wobble = rand() * 100;
	const spacing = 1.5;
	const dense = smooth(resample([entry, ...stroke], spacing), Math.max(1, Math.round((size * 0.35) / spacing)));

	const distances = [0];
	for (let i = 1; i < dense.length; i++) {
		distances.push(distances[i - 1] + Math.hypot(dense[i][0] - dense[i - 1][0], dense[i][1] - dense[i - 1][1]));
	}
	const length = distances[distances.length - 1];
	const [ex, ey] = exitDirection(dense, 0.8);
	const needle = ey > 0.92 && length > size * 7 && rand() < 0.55;
	const ending =
		length < size * 1.4 ? 'dot' : ex < -0.35 && ey > 0.2 ? 'taper' : ex > 0.35 && ey > 0.35 ? 'flick' : needle ? 'needle' : 'press';
	const body = 0.82 - 0.14 * Math.min(1, length / (size * 10));
	const k = Math.max(2, Math.round((size * 0.8) / spacing));

	const samples = dense.map(([x, y], i) => {
		const d = distances[i];
		const e = length - d;
		let p;
		if (ending === 'dot') {
			p = 0.35 + 0.8 * Math.pow(Math.sin(Math.PI * Math.min(1, d / length)), 0.6);
		} else {
			p = d < size * 0.5 ? lerp(0.55, 1.1, d / (size * 0.5)) : lerp(1.1, body, smoothstep(size * 0.5, size * 2, d));
			p *= 0.86 + 0.28 * noise(wobble + d / (size * 3));
			p += 0.3 * smoothstep(0.5, 1.4, turning(dense, i, k));
			if (ending === 'press') {
				p = Math.max(p, lerp(body, 1.02, smoothstep(size * 1.6, size * 0.5, e)));
				if (e < size * 0.4) p *= 0.55 + 0.45 * (e / (size * 0.4));
			} else if (ending === 'taper' || ending === 'needle') {
				const tail = ending === 'taper' ? Math.min(length * 0.45, size * 6) : Math.min(length * 0.3, size * 3.5);
				if (e < tail) p *= 0.04 + 0.96 * Math.pow(e / tail, 0.8);
			} else {
				const tail = Math.min(length * 0.3, size * 3);
				if (e < tail * 2.2 && e >= tail) p *= 1 + 0.3 * smoothstep(tail * 2.2, tail, e);
				if (e < tail) p *= 1.3 * (0.03 + 0.97 * Math.pow(e / tail, 1.2));
			}
		}
		return { x, y, p: clamp(p, 0.02, 1.4), d };
	});

	return { samples, length };
}
