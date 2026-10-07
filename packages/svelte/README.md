# sveltebrush

Svelte 5 components for ink-brush painting and animated East Asian calligraphy, built on [`@sveltebrush/core`](https://www.npmjs.com/package/@sveltebrush/core). Everything from the core is re-exported, so one import covers both.

## Install

```sh
npm install sveltebrush
yarn add sveltebrush
pnpm add sveltebrush
```

Requires Svelte 5.

## Usage

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

`InkCanvas` fills its parent, so give the parent a size. `sveltebrush/paper.css` provides the `.sb-paper` hanji paper background.

## `InkCanvas`

### Props

| Prop         | Default          | Meaning                                                        |
| ------------ | ---------------- | -------------------------------------------------------------- |
| `brush`      | `BRUSHES[0]`     | Brush settings for the hand brush and the writer               |
| `color`      | `'#16110d'`      | Ink colour                                                     |
| `ink`        | `1`              | Bindable. Ink on the hand brush, 0–1.5; updates as it is spent |
| `history`    | `{ undo, redo }` | Bindable. How many undo and redo steps are available           |
| `strokes`    | `0`              | Bindable. Strokes recorded so far                              |
| `playing`    | `false`          | Bindable. Whether a timelapse is playing                       |
| `infinite`   | `false`          | Refill the brush on every stroke                               |
| `timelapse`  | `true`           | Record a document, which saving, playback and video need       |
| `streamline` | `0.35`           | Input smoothing, 0 (raw) – 1                                   |
| `onstroke`   | none             | Called with each finished stroke as data                       |
| `onresize`   | none             | Called with `{ width, height }` when the sheet changes size    |
| `class`      | none             | Extra classes for the canvas                                   |

### Methods

Call these on the instance from `bind:this`.

| Method                  | What it does                                                     |
| ----------------------- | ---------------------------------------------------------------- |
| `write(text, options?)` | Animate text onto the paper; resolves `true` when finished       |
| `stop()`                | Stop writing                                                     |
| `clear()`               | Clear the paper (undoable)                                       |
| `undo()`, `redo()`      | Step through history                                             |
| `dip(level)`            | Set the hand brush's ink to an exact level                       |
| `load(amount)`          | Add ink to the hand brush                                        |
| `save()`                | The drawing as a JSON-serialisable document                      |
| `open(document)`        | Replace the drawing with a saved document and keep drawing on it |
| `play(options?)`        | Replay the drawing as a timelapse; touching the canvas stops it  |
| `stopPlayback()`        | Stop the timelapse                                               |
| `timelapse(options?)`   | Render the timelapse to `{ blob, extension }` (MP4 or WebM)      |
| `toBlob(options?)`      | Export a PNG, optionally on a `background` colour                |
| `preview()`             | Paint one sample stroke with the current brush, for preview pads |

`write` takes the core writer's options except `width` and `height`: `vertical`, `maxCell`, `padding`, `speed`, `weight`, `brush` and `seal`.

## Other components

| Component      | Props                                                                                                                |
| -------------- | -------------------------------------------------------------------------------------------------------------------- |
| `Inkstone`     | `level`, `max`, `color`, `onload(amount)` while the pointer hovers the ink, `onset(level)` when the meter is dragged |
| `BrushLibrary` | `brushes`, bindable `selected` id, `onedit(id)` when the selected brush is clicked again                             |
| `BrushStudio`  | Bindable `brush`, `groups` (defaults to `PROPERTIES`), `onreset`, `onclose`                                          |
| `ColorWheel`   | Bindable `value`, `swatches` (defaults to `INKS`)                                                                    |
| `Slider`       | Bindable `value`, `min`, `max`, `step`, `label`, `hint`, `orientation`, `format`                                     |

Connect an `Inkstone` to a canvas like this:

```svelte
<Inkstone level={ink} {color} onload={(amount) => canvas?.load(amount)} onset={(level) => canvas?.dip(level)} />
```

The [demo app](https://github.com/shelost/sveltebrush/tree/main/apps/demo) puts all of them together.

## License

[MIT](./LICENSE). Chinese character data is fetched at runtime under the Arphic Public License; see the [notices](https://github.com/shelost/sveltebrush/blob/main/NOTICE.md).
