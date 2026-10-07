import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

/** @param {string} path */
const source = (path) => fileURLToPath(new URL(`../../packages/${path}`, import.meta.url));

export default defineConfig({
	base: process.env.BASE_PATH ?? '/',
	plugins: [react()],
	resolve: {
		// Work on the packages' source directly, with hot reload and no build step.
		alias: {
			'@sveltebrush/tldraw': source('tldraw/src/index.ts'),
			'@sveltebrush/core': source('core/src/index.js')
		},
		dedupe: ['react', 'react-dom', 'tldraw']
	},
	// tldraw alone is about 2 MB minified.
	build: { chunkSizeWarningLimit: 2500 }
});
