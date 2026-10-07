/**
 * @typedef {{ id: string, name: string, native: string, color: string, description: string }} Paper
 * color: the paper's base tone, for exports and anything drawn to match it.
 */

/** Papers styled by `sveltebrush/paper.css`. Hanji is the default `.sb-paper`. @type {Paper[]} */
export const PAPERS = [
	{ id: 'hanji', name: 'Hanji', native: '한지 · 韓紙', color: '#f1e8d6', description: 'Warm mulberry paper with long fibres' },
	{ id: 'xuan', name: 'Xuan', native: '선지 · 宣紙', color: '#f6f3ea', description: 'Bright rice paper with soft, cloudy fibre' },
	{ id: 'washi', name: 'Washi', native: '화지 · 和紙', color: '#eee8da', description: 'Kozo paper with visible strands' },
	{ id: 'gold', name: 'Sprinkled gold', native: '쇄금지 · 灑金紙', color: '#ead9b2', description: 'Tan paper flecked with gold leaf' },
	{ id: 'practice', name: 'Practice', native: '습자지 · 習字紙', color: '#e7e3d9', description: 'Thin, grey practice paper' }
];

/**
 * The classes that put a paper behind an element.
 * @param {string} id
 */
export const paperClass = (id) => (id === 'hanji' || !PAPERS.some((paper) => paper.id === id) ? 'sb-paper' : `sb-paper sb-paper-${id}`);
