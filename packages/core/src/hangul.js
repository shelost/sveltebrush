/**
 * Hangul stroke data. Rather than storing 11,172 syllables, we store each jamo once
 * (as ordered centerline strokes in a unit box) and compose syllables by layout.
 * Coordinates are [x, y] in 0–1, y pointing down.
 */

/** @typedef {[number, number][]} Stroke */

/** @param {number} x0 @param {number} x1 @param {number} y @returns {Stroke} */
const H = (x0, x1, y) => [
	[x0, y],
	[x1, y]
];
/** @param {number} x @param {number} [y0] @param {number} [y1] @returns {Stroke} */
const V = (x, y0 = 0.02, y1 = 0.98) => [
	[x, y0],
	[x, y1]
];

/**
 * Ring starting at the top and turning counter-clockwise, overlapping slightly to close.
 * @param {number} cx @param {number} cy @param {number} rx @param {number} ry @param {number} [n]
 */
const ring = (cx, cy, rx, ry, n = 28) =>
	/** @type {Stroke} */ (
		Array.from({ length: n + 1 }, (_, i) => {
			const a = -Math.PI / 2 - (i / n) * (Math.PI * 2 + 0.25);
			return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)];
		})
	);

/** @param {Stroke[]} strokes @param {number} y0 @param {number} y1 */
const squash = (strokes, y0, y1) => strokes.map((s) => /** @type {Stroke} */ (s.map(([x, y]) => [x, y0 + y * (y1 - y0)])));

/** @type {Record<string, Stroke[]>} */
const BASE = {
	ㄱ: [
		[
			[0.12, 0.16],
			[0.84, 0.16],
			[0.8, 0.55],
			[0.64, 0.9]
		]
	],
	ㄴ: [
		[
			[0.16, 0.1],
			[0.16, 0.84],
			[0.9, 0.84]
		]
	],
	ㄷ: [
		H(0.16, 0.84, 0.14),
		[
			[0.16, 0.14],
			[0.16, 0.84],
			[0.9, 0.84]
		]
	],
	ㄹ: [
		[
			[0.14, 0.12],
			[0.84, 0.12],
			[0.84, 0.47]
		],
		H(0.16, 0.84, 0.47),
		[
			[0.16, 0.47],
			[0.16, 0.88],
			[0.9, 0.88]
		]
	],
	ㅁ: [
		V(0.16, 0.14, 0.86),
		[
			[0.16, 0.14],
			[0.84, 0.14],
			[0.84, 0.86]
		],
		H(0.16, 0.84, 0.86)
	],
	ㅂ: [V(0.18, 0.1, 0.88), V(0.82, 0.1, 0.88), H(0.18, 0.82, 0.48), H(0.18, 0.82, 0.88)],
	ㅅ: [
		[
			[0.5, 0.1],
			[0.44, 0.5],
			[0.1, 0.9]
		],
		[
			[0.48, 0.42],
			[0.7, 0.68],
			[0.92, 0.88]
		]
	],
	ㅇ: [ring(0.5, 0.5, 0.36, 0.38)],
	ㅈ: [
		[
			[0.14, 0.16],
			[0.8, 0.16],
			[0.5, 0.55],
			[0.1, 0.9]
		],
		[
			[0.5, 0.52],
			[0.72, 0.72],
			[0.92, 0.88]
		]
	],
	ㅋ: [],
	ㅌ: [
		H(0.16, 0.84, 0.12),
		H(0.16, 0.82, 0.48),
		[
			[0.16, 0.12],
			[0.16, 0.86],
			[0.9, 0.86]
		]
	],
	ㅍ: [H(0.1, 0.9, 0.15), V(0.34, 0.15, 0.84), V(0.66, 0.15, 0.84), H(0.06, 0.94, 0.85)],
	ㅎ: [
		[
			[0.44, 0.0],
			[0.56, 0.1]
		],
		H(0.14, 0.86, 0.24),
		ring(0.5, 0.64, 0.28, 0.26)
	]
};
BASE.ㅊ = [
	[
		[0.44, 0.0],
		[0.56, 0.1]
	],
	...squash(BASE.ㅈ, 0.16, 1)
];
BASE.ㅋ = [...BASE.ㄱ, H(0.14, 0.8, 0.5)];

/** Doubled consonants and final clusters, written as two side-by-side parts. */
const PAIRS = {
	ㄲ: 'ㄱㄱ',
	ㄸ: 'ㄷㄷ',
	ㅃ: 'ㅂㅂ',
	ㅆ: 'ㅅㅅ',
	ㅉ: 'ㅈㅈ',
	ㄳ: 'ㄱㅅ',
	ㄵ: 'ㄴㅈ',
	ㄶ: 'ㄴㅎ',
	ㄺ: 'ㄹㄱ',
	ㄻ: 'ㄹㅁ',
	ㄼ: 'ㄹㅂ',
	ㄽ: 'ㄹㅅ',
	ㄾ: 'ㄹㅌ',
	ㄿ: 'ㄹㅍ',
	ㅀ: 'ㄹㅎ',
	ㅄ: 'ㅂㅅ'
};

/** @type {Record<string, Stroke[]>} */
const VOWELS = {
	ㅏ: [V(0.35), H(0.35, 0.8, 0.46)],
	ㅐ: [V(0.3), H(0.3, 0.62, 0.46), V(0.72)],
	ㅑ: [V(0.35), H(0.35, 0.8, 0.36), H(0.35, 0.8, 0.6)],
	ㅒ: [V(0.3), H(0.3, 0.62, 0.36), H(0.3, 0.62, 0.6), V(0.72)],
	ㅓ: [H(0.2, 0.62, 0.46), V(0.62)],
	ㅔ: [H(0.1, 0.46, 0.46), V(0.46), V(0.8)],
	ㅕ: [H(0.2, 0.62, 0.36), H(0.2, 0.62, 0.6), V(0.62)],
	ㅖ: [H(0.1, 0.46, 0.36), H(0.1, 0.46, 0.6), V(0.46), V(0.8)],
	ㅣ: [V(0.5)],
	ㅗ: [V(0.5, 0.12, 0.55), H(0.02, 0.98, 0.55)],
	ㅛ: [V(0.34, 0.12, 0.55), V(0.66, 0.12, 0.55), H(0.02, 0.98, 0.55)],
	ㅜ: [H(0.02, 0.98, 0.35), V(0.5, 0.35, 0.9)],
	ㅠ: [H(0.02, 0.98, 0.35), V(0.34, 0.35, 0.88), V(0.66, 0.35, 0.88)],
	ㅡ: [H(0.02, 0.98, 0.5)]
};

/** Compound vowels: a horizontal part below the initial, a vertical part to the right. */
const COMPOUND = {
	ㅘ: ['ㅗ', 'ㅏ'],
	ㅙ: ['ㅗ', 'ㅐ'],
	ㅚ: ['ㅗ', 'ㅣ'],
	ㅝ: ['ㅜ', 'ㅓ'],
	ㅞ: ['ㅜ', 'ㅔ'],
	ㅟ: ['ㅜ', 'ㅣ'],
	ㅢ: ['ㅡ', 'ㅣ']
};

const INITIALS = [...'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'];
const MEDIALS = [...'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ'];
const FINALS = ['', ...'ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ'];
const HORIZONTAL = new Set([...'ㅗㅛㅜㅠㅡ']);

/** @typedef {readonly [number, number, number, number]} Box x, y, w, h */

/** Where each jamo sits, by vowel shape and whether there is a final consonant. */
const LAYOUT = /** @type {const} */ ({
	vertical: {
		open: { L: [0.04, 0.1, 0.56, 0.8], V: [0.58, 0, 0.38, 1] },
		closed: { L: [0.04, 0.04, 0.56, 0.5], V: [0.58, 0, 0.38, 0.62], T: [0.14, 0.66, 0.7, 0.32] }
	},
	horizontal: {
		open: { L: [0.16, 0.02, 0.68, 0.5], V: [0, 0.5, 1, 0.44] },
		closed: { L: [0.18, 0, 0.64, 0.36], V: [0, 0.34, 1, 0.32], T: [0.18, 0.68, 0.64, 0.32] }
	},
	mixed: {
		open: { L: [0.04, 0.02, 0.54, 0.46], H: [0, 0.46, 0.66, 0.44], V: [0.6, 0, 0.36, 1] },
		closed: {
			L: [0.04, 0, 0.52, 0.34],
			H: [0, 0.32, 0.64, 0.3],
			V: [0.6, 0, 0.36, 0.66],
			T: [0.14, 0.68, 0.68, 0.3]
		}
	}
});

/** @param {Stroke[]} strokes @param {Box} box */
const place = (strokes, [bx, by, bw, bh]) => strokes.map((s) => /** @type {Stroke} */ (s.map(([x, y]) => [bx + x * bw, by + y * bh])));

/** @param {string} jamo @param {Box} box */
function consonant(jamo, box) {
	const parts = [...(PAIRS[/** @type {keyof typeof PAIRS} */ (jamo)] ?? jamo)];
	const [bx, by, bw, bh] = box;
	const w = bw / parts.length;
	return parts.flatMap((part, i) =>
		place(BASE[part] ?? [], [bx + i * w + (parts.length > 1 ? w * 0.04 : 0), by, w * (parts.length > 1 ? 0.92 : 1), bh])
	);
}

/** @param {string} jamo */
const shapeOf = (jamo) => (jamo in COMPOUND ? 'mixed' : HORIZONTAL.has(jamo) ? 'horizontal' : 'vertical');

/** @param {string} jamo @param {{ V: Box, H?: Box }} boxes */
function vowel(jamo, boxes) {
	const pair = COMPOUND[/** @type {keyof typeof COMPOUND} */ (jamo)];
	if (!pair) return place(VOWELS[jamo], boxes.V);
	return [...place(VOWELS[pair[0]], /** @type {Box} */ (boxes.H)), ...place(VOWELS[pair[1]], boxes.V)];
}

/** @param {string} char */
export const isHangul = (char) => {
	const code = char.codePointAt(0) ?? 0;
	return (code >= 0xac00 && code <= 0xd7a3) || (code >= 0x3131 && code <= 0x3163);
};

/**
 * Centerline strokes for a Hangul syllable or standalone jamo, in stroke order.
 * @param {string} char
 * @returns {Stroke[] | null}
 */
export function hangul(char) {
	const code = char.codePointAt(0) ?? 0;
	if (code >= 0xac00 && code <= 0xd7a3) {
		const index = code - 0xac00;
		const initial = INITIALS[Math.floor(index / 588)];
		const medial = MEDIALS[Math.floor((index % 588) / 28)];
		const final = FINALS[index % 28];
		const boxes = LAYOUT[shapeOf(medial)][final ? 'closed' : 'open'];
		return [...consonant(initial, boxes.L), ...vowel(medial, boxes), ...(final && 'T' in boxes ? consonant(final, boxes.T) : [])];
	}
	if (char in VOWELS || char in COMPOUND) {
		const shape = shapeOf(char);
		if (shape === 'horizontal') return vowel(char, { V: [0.05, 0.2, 0.9, 0.6] });
		if (shape === 'vertical') return vowel(char, { V: [0.2, 0.05, 0.6, 0.9] });
		return vowel(char, { H: [0.02, 0.3, 0.64, 0.5], V: [0.6, 0.02, 0.36, 0.96] });
	}
	if (char in BASE || char in PAIRS) return consonant(char, [0.1, 0.1, 0.8, 0.8]);
	return null;
}
