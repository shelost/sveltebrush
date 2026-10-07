<script>
	import { Canvas, T } from '@threlte/core';
	import Lights from './Lights.svelte';

	/**
	 * A transparent layer over the whole viewport for brushes drawn in screen px. `BrushCursor`
	 * and `ScribeBrush` go inside it. It never takes the pointer.
	 * @type {{ children: import('svelte').Snippet, class?: string }}
	 */
	let { children, class: className = '' } = $props();

	const dpr = typeof devicePixelRatio === 'number' ? Math.min(devicePixelRatio, 2) : 1;
</script>

<div class={['sb-brush-stage', className]} aria-hidden="true">
	<Canvas {dpr}>
		<T.OrthographicCamera makeDefault position.z={600} near={1} far={2000} />
		<Lights reach={1} resolution={256} />
		{@render children()}
	</Canvas>
</div>

<style>
	.sb-brush-stage {
		position: fixed;
		inset: 0;
		z-index: 10;
		pointer-events: none;
	}

	.sb-brush-stage :global(*) {
		pointer-events: none;
	}
</style>
