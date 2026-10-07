# @sveltebrush/tldraw

An ink-brush tool for [tldraw](https://tldraw.dev), powered by [`@sveltebrush/core`](https://www.npmjs.com/package/@sveltebrush/core). Strokes paint with real bristle texture, ink load and flying white, and are ordinary tldraw shapes. They can be selected, moved, resized, erased, undone, persisted, synced and exported to SVG.

## Install

```sh
npm install @sveltebrush/tldraw tldraw
yarn add @sveltebrush/tldraw tldraw
pnpm add @sveltebrush/tldraw tldraw
```

Requires tldraw 5 with React 18 or 19.

## Usage

```tsx
import { Tldraw } from 'tldraw';
import 'tldraw/tldraw.css';
import { sveltebrushInk } from '@sveltebrush/tldraw';

export default function App() {
  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <Tldraw {...sveltebrushInk} licenseKey={import.meta.env.VITE_TLDRAW_LICENSE_KEY} />
    </div>
  );
}
```

`sveltebrushInk` is `{ shapeUtils, tools, overrides, components }`. It adds:

- an **Ink brush** tool, first in the toolbar, with the shortcut <kbd>I</kbd>;
- **Brush** (Center Tip, Side Tip, Flying White) and **Ink** (Dry, Loaded, Flooded) pickers in the style panel, next to tldraw's own colour and size;
- the tool in the keyboard shortcuts dialog.

Strokes follow tldraw's colours in light and dark mode, and re-render sharply as you zoom.

### Licence key

tldraw needs a licence key in production builds. Without one, the editor goes blank after a few seconds. Development builds work without a key. Get a key from [tldraw.dev](https://tldraw.dev) and pass it as `licenseKey`.

## Combining with your own setup

Each piece is exported, so you can merge it with your own shapes, tools and UI:

```tsx
import { InkShapeTool, InkShapeUtil, InkStylePickers, inkComponents, inkOverrides } from '@sveltebrush/tldraw';

<Tldraw
  shapeUtils={[InkShapeUtil, ...myShapes]}
  tools={[InkShapeTool, ...myTools]}
  overrides={[inkOverrides, myOverrides]}
  components={{ ...inkComponents, ...myComponents }}
/>;
```

- `InkToolbar`, `InkStylePanel` and `InkKeyboardShortcutsDialog` are tldraw's defaults with the ink additions. `InkStylePickers` is just the two pickers, for use inside your own `DefaultStylePanel`.
- `InkBrushStyle` and `InkLoadStyle` are tldraw style props, so `editor.setStyleForNextShapes(InkBrushStyle, 'side')` works.
- Tune input smoothing and the longest stroke with `InkShapeUtil.configure({ streamline: 0.5, maxPoints: 4000 })`.

## Shape data

Ink shapes have the type `sveltebrush-ink`. The points are stored compactly with `encodePoints`. `getInkStroke(shape, color)` turns a shape into a core `InkStroke` in the shape's own coordinates, so the same pixels can be rendered anywhere else, for example in Node. Add `@sveltebrush/core` to your dependencies for this:

```ts
import { getInkColor, getInkStroke } from '@sveltebrush/tldraw';
import { renderStroke } from '@sveltebrush/core';

const { canvas, bounds } = renderStroke(getInkStroke(shape, getInkColor(editor, shape.props.color)), { dpr: 2 });
```

## License

[MIT](./LICENSE). Chinese character data used by the core's calligrapher is under the Arphic Public License; see the [notices](https://github.com/shelost/sveltebrush/blob/main/NOTICE.md).
