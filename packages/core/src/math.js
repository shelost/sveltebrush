/** @param {number} v @param {number} lo @param {number} hi */
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** @param {number} a @param {number} b @param {number} t */
export const lerp = (a, b, t) => a + (b - a) * t;

/** @param {number} a @param {number} b @param {number} v */
export const smoothstep = (a, b, v) => {
	const t = clamp((v - a) / (b - a), 0, 1);
	return t * t * (3 - 2 * t);
};

/** Deterministic pseudo-random value in [0, 1) for any number. @param {number} n */
export const hash = (n) => {
	const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
	return s - Math.floor(s);
};

/** Seeded PRNG (mulberry32) returning floats in [0, 1). @param {number} seed */
export const random = (seed) => {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
};

/** A fresh 32-bit seed. */
export const newSeed = () => (Math.random() * 2 ** 32) >>> 0;

/** Smooth 1D value noise in [0, 1]. @param {number} x */
export const noise = (x) => {
	const i = Math.floor(x);
	const f = x - i;
	const t = f * f * (3 - 2 * f);
	return hash(i) * (1 - t) + hash(i + 1) * t;
};
