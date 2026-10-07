# @sveltebrush/core

The Sveltebrush engine: bristle brushes, strokes as data, input smoothing, an animated calligrapher, documents and timelapses for the HTML canvas. It has no framework and no dependencies, and runs in browsers, workers and Node.

Using Svelte? Install [`sveltebrush`](https://www.npmjs.com/package/sveltebrush), which re-exports all of this plus ready-made components. Using tldraw? See [`@sveltebrush/tldraw`](https://www.npmjs.com/package/@sveltebrush/tldraw).

## Install

```sh
npm install @sveltebrush/core
yarn add @sveltebrush/core
pnpm add @sveltebrush/core
```

Or import it from a CDN with no install and no build step:

```js
import { Brush, Surface, freehand } from 'https://cdn.jsdelivr.net/npm/@sveltebrush/core@0.1/+esm';
// or: https://esm.sh/@sveltebrush/core@0.1
```

## Quick start

```js
import { BRUSHES, Brush, Surface, createWriter, freehand } from '@sveltebrush/core';

const canvas = document.querySelector('canvas'); // give it a CSS size and `touch-action: none`
const surface = new Surface(canvas);
surface.resize();
new ResizeObserver(() => surface.resize()).observe(canvas);

const brush = new Brush(surface, BRUSHES[0]);
const stop = freehand(canvas, brush); // pointer, pen and touch input; call stop() to remove it

const writer = createWriter(surface);
await writer.write('永 바람', { width: surface.width, height: surface.height });
```

## Brushes and ink

`BRUSHES` holds three presets based on real techniques: `center` (Center Tip, 中鋒), `side` (Side Tip, 側鋒) and `flying-white` (Flying White, 飛白). `preset(id)` returns a fresh copy, and `PROPERTIES` describes every setting for building editors.

A brush holds ink like a real one. `brush.ink` (0–1.5) is what the belly holds and is spent by area; the tip dries along a stroke much faster and refills when the brush lifts, which is what breaks a stroke into flying white.

```js
brush.dip(1); // a fresh dip to an exact level
brush.load(0.05); // add a little, e.g. while hovering over an inkstone
brush.onink = (level) => meter.update(level);
brush.set({ size: 40, water: 0.3 }); // change settings between strokes
brush.color = '#1f3354'; // see INKS for traditional colours
```

Use `freehand(canvas, brush, { infinite: true })` to refill on every stroke instead.

## Strokes are data

An `InkStroke` is everything needed to paint a stroke: `points` (`[x, y, pressure, time?]`), `brush` (a preset id or settings), `size`, `color`, `ink`, `tip`, `seed` and an optional `heading`. Rendering is a pure function of it, so the same stroke paints the same pixels anywhere.

```js
import { StrokeRenderer, decodePoints, drawStroke, encodePoints, renderStroke } from '@sveltebrush/core';

const { canvas, bounds, dpr } = renderStroke(stroke, { dpr: 2 }); // its own bitmap
drawStroke(ctx, stroke, { dpr: 2 }); // or straight onto any 2D context

// While a stroke is being drawn, StrokeRenderer only paints the new points.
const renderer = new StrokeRenderer({ dpr: 2 });
renderer.update(stroke, { complete: false }); // true when something changed
renderer.paint(targetCanvas); // positioned at renderer.bounds

const packed = encodePoints(stroke.points); // compact base64 float32, e.g. for a database
```

## Input

`createInput` turns raw pointer samples into brush input, after perfect-freehand's `getStrokePoints`. It streamlines jitter, keeps real pen pressure, gives mice and fingers pressure from speed (slow is heavy, fast is light), and flicks the tip out on a quick release. `freehand` uses it for you.

```js
import { createInput, getStrokePoints } from '@sveltebrush/core';

const input = createInput({ pen: event.pointerType === 'pen', streamline: 0.35 });
const point = input.push(x, y, { pressure: event.pressure, time: event.timeStamp }); // [x, y, p, t] or null
const tail = input.end(brush.size); // points that finish the stroke

const points = getStrokePoints(samples); // the same for a whole recorded stroke
```

## Calligraphy

`createWriter(surface, { color })` returns `{ write, stop, brush }`. `write(text, options)` animates the text stroke by stroke and resolves `true` when finished, or `false` if it was interrupted. The whole write is one undo step.

| Option     | Default  | Meaning                                          |
| ---------- | -------- | ------------------------------------------------ |
| `width`    | required | Sheet width in CSS px                            |
| `height`   | required | Sheet height in CSS px                           |
| `vertical` | `false`  | Columns top to bottom, read right to left        |
| `maxCell`  | `260`    | Largest character size in px                     |
| `padding`  | `48`     | A number, or `{ top, right, bottom, left }`      |
| `speed`    | `1`      | Writing speed                                    |
| `weight`   | `1`      | Stroke weight                                    |
| `brush`    | current  | Brush settings for this write                    |
| `seal`     | none     | Text for a red seal (落款) pressed after writing |
| `lead`     | `0`      | ms to wait before the first stroke               |

`writer.tip` is live: `{ writing, down, x, y, pressure }` in sheet px. Between strokes it reports the start of the next stroke, so anything that draws a hand or a brush over the writing can move there ahead of time.

Hangul is composed from jamo by the library. Chinese characters use stroke data from `hanzi-writer-data`, fetched from jsDelivr the first time each character is written. Call `setGlyphSource(url)` to self-host it; see [NOTICE.md](./NOTICE.md) for its licence. `stamp(ctx, seal)` presses a seal anywhere.

## Documents and timelapses

A `Tape` records what happens to a surface as a JSON document: strokes, seals, undo, redo and clears.

```js
import { Tape, paintDocument, play, renderVideo, videoType } from '@sveltebrush/core';

surface.tape = new Tape({ width: surface.width, height: surface.height });
// …draw…
const json = JSON.stringify(surface.tape);

paintDocument(Tape.from(JSON.parse(json)), blankSurface); // reopen, with undo history
const player = play(JSON.parse(json), blankSurface, { duration: 8000 }); // timelapse; player.stop()
const video = await renderVideo(surface.tape, { resolution: 1920 }); // { blob, extension } or null
videoType(); // the best format this browser can record
```

## Node, workers and tests

Point the engine at any canvas implementation, for example [`@napi-rs/canvas`](https://github.com/Brooooooklyn/canvas) for server-side rendering:

```js
import { Path2D, createCanvas } from '@napi-rs/canvas';
import { renderStroke, setCanvasFactory } from '@sveltebrush/core';

globalThis.Path2D ??= Path2D;
setCanvasFactory((width, height) => createCanvas(width, height));

const { canvas } = renderStroke(stroke, { dpr: 2 });
await canvas.encode('png');
```

In workers the default factory uses `OffscreenCanvas`.

## License

[MIT](./LICENSE). Third-party data notices are in [NOTICE.md](./NOTICE.md).
