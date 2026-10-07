import { BRUSHES } from '@sveltebrush/core';
import { StyleProp, T, type TLDefaultSizeStyle } from 'tldraw';

/** Which brush paints the stroke: the built-in Sveltebrush presets. */
export const InkBrushStyle = StyleProp.defineEnum('sveltebrush:brush', {
	defaultValue: 'center',
	values: ['center', 'side', 'flying-white']
});

/** @public */
export type TLInkBrushStyle = T.TypeOf<typeof InkBrushStyle>;

/** How much ink the brush holds when the stroke starts: a dry brush breaks into flying white sooner. */
export const InkLoadStyle = StyleProp.defineEnum('sveltebrush:ink', {
	defaultValue: 'loaded',
	values: ['dry', 'loaded', 'flooded']
});

/** @public */
export type TLInkLoadStyle = T.TypeOf<typeof InkLoadStyle>;

/** Brush size for each tldraw size, in page units. */
export const INK_SIZES: Record<TLDefaultSizeStyle, number> = { s: 10, m: 18, l: 30, xl: 48 };

/** Belly load for each ink style. */
export const INK_LEVELS: Record<TLInkLoadStyle, number> = { dry: 0.45, loaded: 1, flooded: 1.45 };

/** Display names, used for tooltips in the style panel. */
export const INK_BRUSH_NAMES = Object.fromEntries(BRUSHES.map((brush) => [brush.id, brush.name])) as Record<TLInkBrushStyle, string>;
