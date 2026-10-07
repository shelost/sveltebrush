# Sveltebrush

Ink-brush painting and animated East Asian calligraphy for the HTML canvas.

Bristle brushes that run dry, split into flying white (飛白) and soak into paper; an inkstone to load them; and a calligrapher that writes Chinese characters and Hangul stroke by stroke. Every stroke is plain data, so a drawing can be saved as JSON, reopened, replayed as a timelapse or exported to video, and it renders the same pixels every time.

**[Live demo](https://shelost.github.io/sveltebrush/)**

| Package                                    | What it is                                                                                                                                                                                                       |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`@sveltebrush/core`](./packages/core)     | The engine, with no framework and no dependencies: brushes, strokes as data, input smoothing, the calligrapher, documents and timelapses. Runs in browsers, workers and Node.                                    |
| [`sveltebrush`](./packages/svelte)         | Svelte 5 components: `InkCanvas`, `Inkstone`, `BrushLibrary`, `BrushStudio`, `ColorWheel`, `Slider`, five papers, and optional 3D brushes and inkstone in `sveltebrush/3d`. Re-exports everything from the core. |
| [`@sveltebrush/tldraw`](./packages/tldraw) | An ink-brush shape, tool and style panel for [tldraw](https://tldraw.dev).                                                                                                                                       |

## Install

With npm:

```sh
npm install sveltebrush            # Svelte components + engine
npm install @sveltebrush/core      # engine only, for any framework or none
npm install @sveltebrush/tldraw tldraw
```

With Yarn:

```sh
yarn add sveltebrush
yarn add @sveltebrush/core
yarn add @sveltebrush/tldraw tldraw
```

With pnpm:

```sh
pnpm add sveltebrush
pnpm add @sveltebrush/core
pnpm add @sveltebrush/tldraw tldraw
```

## Or import it straight from a CDN

The core is plain ES modules with no dependencies, so it runs from a `<script type="module">` without installing or bundling anything:

```html
<canvas id="paper" style="width: 100%; height: 100vh; touch-action: none"></canvas>

<script type="module">
  import { BRUSHES, Brush, Surface, createWriter, freehand } from 'https://cdn.jsdelivr.net/npm/@sveltebrush/core@0.1/+esm';

  const canvas = document.getElementById('paper');
  const surface = new Surface(canvas);
  surface.resize();
  new ResizeObserver(() => surface.resize()).observe(canvas);

  freehand(canvas, new Brush(surface, BRUSHES[0]), { infinite: true });
  createWriter(surface).write('永', { width: surface.width, height: surface.height });
</script>
```

[esm.sh](https://esm.sh) works too: `https://esm.sh/@sveltebrush/core@0.1`. A complete page is in [`examples/vanilla`](./examples/vanilla/index.html). The Svelte components need a Svelte compiler, so use them through a bundler such as Vite or SvelteKit.

## Svelte

```svelte
<script>
  import { BRUSHES, InkCanvas } from 'sveltebrush';
  import 'sveltebrush/paper.css';

  /** @type {ReturnType<typeof InkCanvas> | undefined} */
  let canvas = $state();
  let ink = $state(1);
</script>

<div class="sb-paper">
  <InkCanvas bind:this={canvas} bind:ink brush={BRUSHES[0]} color="#16110d" />
</div>

<button onclick={() => canvas?.write('永 바람')}>Write</button>
<button onclick={() => canvas?.undo()}>Undo</button>
<button onclick={() => canvas?.dip(1)}>Dip the brush ({Math.round(ink * 100)}%)</button>

<style>
  .sb-paper {
    height: 80vh;
  }
</style>
```

See the [`sveltebrush` README](./packages/svelte/README.md) for every prop and method, the papers (hanji, xuan, washi, sprinkled gold and practice paper), and `sveltebrush/3d`. That entry point adds a 3D brush that follows your pointer, a 3D inkstone with a palette of inks, and a red brush that flies in and writes whatever the calligrapher writes. It needs `three`, `@threlte/core` and `@threlte/extras`.

## tldraw

```tsx
import { Tldraw } from 'tldraw';
import 'tldraw/tldraw.css';
import { sveltebrushInk } from '@sveltebrush/tldraw';

export default function App() {
  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <Tldraw {...sveltebrushInk} />
    </div>
  );
}
```

This adds an **Ink brush** tool (shortcut <kbd>I</kbd>) whose strokes are real tldraw shapes: they can be selected, moved, resized, erased, undone, synced and exported to SVG. tldraw needs a licence key in production; see the [`@sveltebrush/tldraw` README](./packages/tldraw/README.md).

## Strokes are data

A stroke is everything needed to paint it:

```js
import { renderStroke } from '@sveltebrush/core';

const stroke = {
  points: [
    [40, 60, 0.5],
    [120, 64, 0.9],
    [220, 70, 0.4]
  ], // x, y, pressure (and optionally time in ms)
  brush: 'center', // a built-in preset id, or settings
  size: 28,
  color: '#16110d',
  ink: 1, // how loaded the brush was
  seed: 1234 // texture
};

const { canvas, bounds } = renderStroke(stroke, { dpr: 2 });
```

Rendering is a pure function of that data, in the spirit of [perfect-freehand](https://github.com/steveruizok/perfect-freehand). The same stroke paints the same pixels whether it is drawn live, reopened from a file, replayed in a timelapse, shown in tldraw or rendered in Node. The tests check this pixel for pixel.

## Documents and timelapses

```js
import { Tape, paintDocument, play, renderVideo } from '@sveltebrush/core';

// Record strokes, seals, undo and redo from now on.
surface.tape = new Tape({ width: surface.width, height: surface.height });

// Save, then reopen on a blank sheet, replay as a timelapse, or render a video.
const json = JSON.stringify(surface.tape);
paintDocument(Tape.from(JSON.parse(json)), blankSurface);
await play(Tape.from(JSON.parse(json)), anotherBlankSurface).done;
const video = await renderVideo(surface.tape); // { blob, extension: 'mp4' | 'webm' }
```

## Characters

Hangul is composed from jamo by the library itself. Chinese characters use stroke data from [`hanzi-writer-data`](https://github.com/chanind/hanzi-writer-data), downloaded from jsDelivr when a character is first written. Call `setGlyphSource(url)` to self-host it. That data is under the Arphic Public License; see [NOTICE.md](./NOTICE.md).

## Development

```sh
npm ci
npm run dev          # Svelte demo
npm run dev:tldraw   # tldraw demo
npm test             # headless rendering tests
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the rest.

## License

[MIT](./LICENSE) © 2026 Heewon. Third-party data notices are in [NOTICE.md](./NOTICE.md).
