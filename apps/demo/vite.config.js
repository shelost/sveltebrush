import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

/** @param {string} path */
const source = (path) => fileURLToPath(new URL(`../../packages/${path}`, import.meta.url));

/** GitHub Pages serves the site from /<repository>, set by the deploy workflow. */
const base = /** @type {'' | `/${string}`} */ (process.env.BASE_PATH ?? '');

export default defineConfig({
	plugins: [
		sveltekit({
			compilerOptions: { runes: true },
			adapter: adapter({ fallback: '404.html' }),
			paths: { base }
		})
	],
	resolve: {
		// Work on the packages' source directly, with hot reload and no build step.
		alias: [
			{ find: /^sveltebrush$/, replacement: source('svelte/src/lib/index.js') },
			{ find: /^sveltebrush\/paper\.css$/, replacement: source('svelte/src/lib/ui/paper.css') },
			{ find: /^@sveltebrush\/core$/, replacement: source('core/src/index.js') }
		]
	}
});
