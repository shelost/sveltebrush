import type { ReactNode } from 'react';
import {
	DefaultKeyboardShortcutsDialog,
	DefaultKeyboardShortcutsDialogContent,
	DefaultStylePanel,
	DefaultStylePanelContent,
	DefaultToolbar,
	DefaultToolbarContent,
	StylePanelButtonPicker,
	StylePanelSection,
	type StyleValuesForUi,
	type TLComponents,
	type TLUiKeyboardShortcutsDialogProps,
	type TLUiOverrides,
	type TLUiStylePanelProps,
	TldrawUiMenuItem,
	useIsToolSelected,
	useStylePanelContext,
	useTools,
	useTranslation
} from 'tldraw';
import { INK_TOOL_ID, InkShapeTool } from './InkShapeTool.js';
import { InkShapeUtil } from './InkShapeUtil.js';
import { INK_BRUSH_NAMES, InkBrushStyle, InkLoadStyle, type TLInkBrushStyle, type TLInkLoadStyle } from './styles.js';

/** An 18px icon in the shape tldraw expects for custom (JSX) icons. */
function icon(children: ReactNode) {
	return (
		<div style={{ width: 18, height: 18, display: 'grid', placeItems: 'center' }}>
			<svg
				width="18"
				height="18"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth={1.7}
				strokeLinecap="round"
				strokeLinejoin="round"
				aria-hidden="true"
			>
				{children}
			</svg>
		</div>
	);
}

const DROP = 'M12 3.5c-3 4.6-5.5 7.6-5.5 10.7a5.5 5.5 0 0 0 11 0c0-3.1-2.5-6.1-5.5-10.7z';

export const INK_ICONS = {
	tool: icon(
		<>
			<path d="M20.5 3.5 13.6 10.4" />
			<path d="m11.8 9.6 2.6 2.6" />
			<path d="M12.6 11.4c-2.6-.6-5.2.8-6.3 3.8-.6 1.8-1.6 3.1-3.3 4.3 3.7.3 6.9-1 8.5-3.6 1-1.6 1.5-3 1.1-4.5z" fill="currentColor" />
		</>
	),
	center: icon(<path d="M5.5 18.5C8 11 16 13 18.5 5.5" strokeWidth={3.4} />),
	side: icon(<path d="M3.5 15.5 13.5 4.5l7 3.5-10 11z" fill="currentColor" stroke="none" />),
	'flying-white': icon(
		<g strokeWidth={1.4}>
			<path d="M4.5 16C9 11 13 12 19.5 5.5" strokeDasharray="7 2.5" />
			<path d="M5 19c4.5-4.5 9-3.5 15-9.5" strokeDasharray="4 3" />
			<path d="M4 13C8 8 11.5 9 17 3.5" strokeDasharray="9 3" />
		</g>
	),
	dry: icon(<path d={DROP} />),
	loaded: icon(
		<>
			<path d={DROP} />
			<path d="M6.6 13.6h10.8a5.4 5.4 0 0 1-10.8 0z" fill="currentColor" stroke="none" />
		</>
	),
	flooded: icon(<path d={DROP} fill="currentColor" />)
};

const BRUSH_ITEMS: StyleValuesForUi<TLInkBrushStyle> = InkBrushStyle.values.map((value) => ({ value, icon: INK_ICONS[value] }));
const INK_ITEMS: StyleValuesForUi<TLInkLoadStyle> = InkLoadStyle.values.map((value) => ({ value, icon: INK_ICONS[value] }));

const TRANSLATIONS: Record<string, string> = {
	'tool.ink': 'Ink brush',
	'style-panel.sveltebrush-brush': 'Brush',
	'style-panel.sveltebrush-ink': 'Ink',
	...Object.fromEntries(InkBrushStyle.values.map((value) => [`sveltebrush-brush-style.${value}`, INK_BRUSH_NAMES[value]])),
	'sveltebrush-ink-style.dry': 'Dry',
	'sveltebrush-ink-style.loaded': 'Loaded',
	'sveltebrush-ink-style.flooded': 'Flooded'
};

/** Adds the ink tool (shortcut `i`) and its labels to tldraw's UI. */
export const inkOverrides: TLUiOverrides = {
	tools(editor, tools) {
		tools[INK_TOOL_ID] = {
			id: INK_TOOL_ID,
			icon: INK_ICONS.tool,
			label: 'tool.ink',
			kbd: 'i',
			onSelect() {
				editor.setCurrentTool(INK_TOOL_ID);
			}
		};
		return tools;
	},
	translations: { en: TRANSLATIONS }
};

/** The default toolbar with the ink brush first. */
export function InkToolbar() {
	const tools = useTools();
	const tool = tools[INK_TOOL_ID];
	const isSelected = useIsToolSelected(tool);
	return (
		<DefaultToolbar>
			{tool && <TldrawUiMenuItem {...tool} isSelected={isSelected} />}
			<DefaultToolbarContent />
		</DefaultToolbar>
	);
}

/** Brush and ink pickers; they show while the ink tool or ink shapes are selected. */
export function InkStylePickers() {
	const { styles } = useStylePanelContext();
	const msg = useTranslation();
	const brush = styles.get(InkBrushStyle);
	const ink = styles.get(InkLoadStyle);
	if (brush === undefined && ink === undefined) return null;
	return (
		<StylePanelSection>
			{brush !== undefined && (
				<StylePanelButtonPicker
					title={msg('style-panel.sveltebrush-brush')}
					uiType="sveltebrush-brush"
					style={InkBrushStyle}
					items={BRUSH_ITEMS}
					value={brush}
				/>
			)}
			{ink !== undefined && (
				<StylePanelButtonPicker
					title={msg('style-panel.sveltebrush-ink')}
					uiType="sveltebrush-ink"
					style={InkLoadStyle}
					items={INK_ITEMS}
					value={ink}
				/>
			)}
		</StylePanelSection>
	);
}

/** The default style panel followed by the ink pickers. */
export function InkStylePanel(props: TLUiStylePanelProps) {
	return (
		<DefaultStylePanel {...props}>
			<DefaultStylePanelContent />
			<InkStylePickers />
		</DefaultStylePanel>
	);
}

/** The default shortcuts dialog, listing the ink brush too. */
export function InkKeyboardShortcutsDialog(props: TLUiKeyboardShortcutsDialogProps) {
	const tools = useTools();
	const tool = tools[INK_TOOL_ID];
	return (
		<DefaultKeyboardShortcutsDialog {...props}>
			{tool && <TldrawUiMenuItem {...tool} />}
			<DefaultKeyboardShortcutsDialogContent />
		</DefaultKeyboardShortcutsDialog>
	);
}

export const inkComponents: TLComponents = {
	Toolbar: InkToolbar,
	StylePanel: InkStylePanel,
	KeyboardShortcutsDialog: InkKeyboardShortcutsDialog
};

/**
 * Everything at once: `<Tldraw {...sveltebrushInk} />`. To combine with your own
 * customisations, pass the parts separately and merge `overrides` and `components`.
 */
export const sveltebrushInk = {
	shapeUtils: [InkShapeUtil],
	tools: [InkShapeTool],
	overrides: inkOverrides,
	components: inkComponents
};
