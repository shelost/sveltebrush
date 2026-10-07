import { hangul, isHangul } from './hangul.js';

/** @typedef {import('./hangul.js').Stroke} Stroke */
/** @typedef {{ char: string, strokes: Stroke[], script: 'han' | 'hangul' }} Glyph */

const HAN = /\p{Script=Han}/u;

/**
 * Where Han stroke data is fetched from: one `<char>.json` per character with
 * Make Me a Hanzi medians (hanzi-writer-data, Arphic Public License).
 */
let source = 'https://cdn.jsdelivr.net/npm/hanzi-writer-data@2.0/';

/** @type {Map<string, Promise<Glyph | null>>} */
const cache = new Map();

/**
 * Fetch Han stroke data from somewhere else, e.g. a self-hosted copy of
 * `hanzi-writer-data` for offline use or a strict CSP.
 * @param {string} url base URL ending in a slash
 */
export function setGlyphSource(url) {
	source = url;
	cache.clear();
}

/** @param {string} char @returns {Promise<Glyph | null>} */
async function hanzi(char) {
	try {
		const response = await fetch(source + encodeURIComponent(char) + '.json');
		if (!response.ok) return null;
		/** @type {{ medians: [number, number][][] }} */
		const data = await response.json();
		const strokes = data.medians.map((median) => /** @type {Stroke} */ (median.map(([x, y]) => [x / 1024, (900 - y) / 1024])));
		return { char, strokes, script: 'han' };
	} catch {
		return null;
	}
}

/** @param {string} char */
export const writable = (char) => isHangul(char) || HAN.test(char);

/**
 * Ordered centerline strokes for one character, or null if we have no data for it.
 * @param {string} char
 * @returns {Promise<Glyph | null>}
 */
export function glyph(char) {
	let pending = cache.get(char);
	if (!pending) {
		if (isHangul(char)) {
			const strokes = hangul(char);
			pending = Promise.resolve(strokes && { char, strokes, script: /** @type {const} */ ('hangul') });
		} else if (HAN.test(char)) {
			pending = hanzi(char);
		} else {
			pending = Promise.resolve(null);
		}
		cache.set(char, pending);
	}
	return pending;
}
