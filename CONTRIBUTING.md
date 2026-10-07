# Contributing

Thanks for helping. Bug reports, brush ideas and pull requests are all welcome.

## Setup

You need Node 22.17 or newer.

```sh
git clone https://github.com/shelost/sveltebrush.git
cd sveltebrush
npm ci
npm run dev
```

## Layout

| Path               | What it is                                                          |
| ------------------ | ------------------------------------------------------------------- |
| `packages/core`    | `@sveltebrush/core`: the engine, in JavaScript with JSDoc types     |
| `packages/svelte`  | `sveltebrush`: Svelte 5 components                                  |
| `packages/tldraw`  | `@sveltebrush/tldraw`: the tldraw shape, tool and UI, in TypeScript |
| `apps/demo`        | The SvelteKit demo site, deployed to GitHub Pages                   |
| `apps/tldraw-demo` | A Vite and React app with the tldraw integration                    |
| `examples/vanilla` | A single HTML page that imports the core from a CDN                 |

The demos import the packages' source directly, so changes hot-reload without a build.

## Scripts

| Command                                    | What it does                                           |
| ------------------------------------------ | ------------------------------------------------------ |
| `npm run dev`                              | The Svelte demo at http://localhost:5173               |
| `npm run dev:tldraw`                       | The tldraw demo                                        |
| `npm test`                                 | Unit and image tests                                   |
| `npm run test:update -w @sveltebrush/core` | Regenerate the golden images after a deliberate change |
| `npm run check`                            | Type-check every package and app                       |
| `npm run lint`, `npm run format`           | Check or apply Prettier formatting                     |
| `npm run build`                            | Build the three packages, with type declarations       |
| `npm run build:site`                       | Build both demos                                       |

Pull requests run lint, build, check, test and the site build in CI.

## Rendering must be deterministic

Saved drawings, timelapses, the tldraw shapes and the image tests all depend on a stroke painting the same pixels every time. The tests check this, and keeping it true comes down to three rules:

1. Everything that affects a stroke's pixels must be part of its `InkStroke` (see `Tape.begin`). Never depend on frame timing, `Math.random` or what the brush painted before. Use the stroke's `seed` with `random`, `hash` and `noise` from `math.js`.
2. Rasterise ink into canvases whose context was created with `SOFTWARE` from `canvas.js`. GPU canvases anti-alias differently depending on how drawing commands are batched, so a stroke drawn live would not match its replay.
3. Every pixel drawn onto a `Layer` must lie inside a `layer.touch()` box. Compositing only copies that box.

If you change how strokes look on purpose, regenerate the golden images and check the new PNGs in `packages/core/test/__snapshots__` before committing them.

## Svelte

Components use Svelte 5 runes (`$state`, `$derived`, `$props`, `onclick`). Run the autofixer on any component you change:

```sh
npx -y @sveltejs/mcp svelte-autofixer "$PWD/packages/svelte/src/lib/InkCanvas.svelte"
```

## Changesets and releases

If a pull request changes a published package, run `npx changeset` and describe the change for users. The three packages share one version.

Merging to `main` opens or updates a "release packages" pull request. Merging that publishes to npm. This needs an `NPM_TOKEN` repository secret with publish rights on the `@sveltebrush` scope and the `sveltebrush` package.

The demo deploys to GitHub Pages on every push to `main`. In the repository settings, set Pages to deploy from GitHub Actions. To include the tldraw demo, add a `TLDRAW_LICENSE_KEY` secret.
