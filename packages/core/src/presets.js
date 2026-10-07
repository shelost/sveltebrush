/**
 * @typedef {{
 *   id: string,
 *   name: string,
 *   native: string,
 *   note: string,
 *   size: number,
 *   bristles: number,
 *   stiffness: number,
 *   tip: number,
 *   tilt: number,
 *   angle: number,
 *   flow: number,
 *   dryness: number,
 *   split: number,
 *   water: number,
 *   bleed: number,
 *   grain: number
 * }} BrushPreset
 */

/** A brush can hold more than a "full" load; the excess floods the paper and bleeds. */
export const MAX_INK = 1.5;

/** Traditional ink colours. */
export const INKS = [
	{ name: 'Pine soot', color: '#16110d' },
	{ name: 'Lamp black', color: '#22262b' },
	{ name: 'Indigo', color: '#1f3354' },
	{ name: 'Vermilion', color: '#b5281c' },
	{ name: 'Ochre', color: '#9a6a2a' },
	{ name: 'Malachite', color: '#2f5d4a' }
];

/** @type {BrushPreset[]} */
export const BRUSHES = [
	{
		id: 'center',
		name: 'Center Tip',
		native: '중봉 · 中鋒',
		note: 'Upright wolf-hair brush with the tip hidden inside the stroke. Round, even, alive — the basis of regular script.',
		size: 30,
		bristles: 64,
		stiffness: 0.55,
		tip: 0.65,
		tilt: 0,
		angle: -45,
		flow: 0.5,
		dryness: 0.4,
		split: 0.2,
		water: 0.08,
		bleed: 0.3,
		grain: 0.3
	},
	{
		id: 'side',
		name: 'Side Tip',
		native: '측봉 · 側鋒',
		note: 'Brush laid over so the belly drags sideways. Broad, flat sweeps with one razor edge — thick or thin by direction.',
		size: 46,
		bristles: 80,
		stiffness: 0.4,
		tip: 0.3,
		tilt: 0.95,
		angle: -35,
		flow: 0.6,
		dryness: 0.55,
		split: 0.35,
		water: 0.15,
		bleed: 0.25,
		grain: 0.5
	},
	{
		id: 'flying-white',
		name: 'Flying White',
		native: '비백 · 飛白',
		note: 'Stiff brush, little ink, fast hand. The bristles part and the paper flashes white through the stroke.',
		size: 38,
		bristles: 96,
		stiffness: 0.8,
		tip: 0.4,
		tilt: 0.2,
		angle: -30,
		flow: 0.35,
		dryness: 0.7,
		split: 0.8,
		water: 0,
		bleed: 0.05,
		grain: 0.75
	}
];

/**
 * @typedef {{ [K in keyof BrushPreset]: BrushPreset[K] extends number ? K : never }[keyof BrushPreset]} BrushSetting a numeric brush property
 * @typedef {{ key: BrushSetting, label: string, min: number, max: number, step: number, hint?: string }} Property
 * @typedef {{ group: string, items: Property[] }} PropertyGroup
 */

/** Studio schema, grouped the way a calligrapher thinks about a brush. @type {PropertyGroup[]} */
export const PROPERTIES = [
	{
		group: 'Bristles',
		items: [
			{ key: 'size', label: 'Size', min: 4, max: 140, step: 1 },
			{ key: 'bristles', label: 'Hair count', min: 16, max: 140, step: 1 },
			{ key: 'stiffness', label: 'Stiffness', min: 0, max: 1, step: 0.01, hint: 'Goat hair ← → wolf hair' },
			{ key: 'tip', label: 'Tip point', min: 0, max: 1, step: 0.01, hint: 'How sharply the bristles gather' }
		]
	},
	{
		group: 'Hold',
		items: [
			{ key: 'tilt', label: 'Side tip', min: 0, max: 1, step: 0.01, hint: 'Upright ← → laid over' },
			{ key: 'angle', label: 'Brush angle', min: -90, max: 90, step: 1 }
		]
	},
	{
		group: 'Ink',
		items: [
			{ key: 'flow', label: 'Ink use', min: 0.05, max: 1.5, step: 0.01 },
			{ key: 'water', label: 'Water', min: 0, max: 1, step: 0.01, hint: 'Thick ink ← → diluted wash' },
			{ key: 'dryness', label: 'Tip dries', min: 0, max: 2, step: 0.01 },
			{ key: 'split', label: 'Flying white', min: 0, max: 1, step: 0.01, hint: 'How readily the hairs part' }
		]
	},
	{
		group: 'Paper',
		items: [
			{ key: 'bleed', label: 'Bleed', min: 0, max: 1, step: 0.01, hint: 'Sized paper ← → raw xuan' },
			{ key: 'grain', label: 'Edge grain', min: 0, max: 1, step: 0.01 }
		]
	}
];

/**
 * A fresh copy of a built-in brush (the first one if the id is unknown).
 * @param {string} id
 * @returns {BrushPreset}
 */
export const preset = (id) => structuredClone(BRUSHES.find((brush) => brush.id === id) ?? BRUSHES[0]);
