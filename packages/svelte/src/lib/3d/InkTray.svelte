<script>
	import { Canvas } from '@threlte/core';
	import { BRUSHES, INKS } from '@sveltebrush/core';
	import TrayScene from './TrayScene.svelte';

	/**
	 * The writing things for beside the paper, in 3D: an inkstone, a palette of inks in dishes,
	 * and the brushes on a rest. Holding the pointer over the inkstone's pool soaks the brush,
	 * faster the longer it stays, and clicking the pool loads it full (`onload` and `ondip`).
	 * Clicking a brush picks it up and clicking a dish makes its ink the colour. Fills its
	 * container; about 2:1 suits it.
	 * @type {{
	 *   brushes?: { id: string, name: string }[],
	 *   selected?: string,
	 *   ink?: number,
	 *   color?: string,
	 *   inks?: { name: string, color: string }[],
	 *   still?: boolean,
	 *   onload?: (amount: number) => void,
	 *   ondip?: () => void,
	 *   class?: string
	 * }}
	 */
	let {
		brushes = BRUSHES,
		selected = $bindable(BRUSHES[0].id),
		ink = 1,
		color = $bindable(INKS[0].color),
		inks = INKS,
		still = false,
		onload,
		ondip,
		class: className = ''
	} = $props();

	const dpr = typeof devicePixelRatio === 'number' ? Math.min(devicePixelRatio, 2) : 1;
</script>

<div class={['sb-ink-tray', className]}>
	<Canvas {dpr}>
		<TrayScene
			{brushes}
			{selected}
			{ink}
			{color}
			{inks}
			{still}
			onpick={(id) => (selected = id)}
			oncolor={(value) => (color = value)}
			onload={(amount) => onload?.(amount)}
			ondip={() => ondip?.()}
		/>
	</Canvas>

	<div class="sb-tray-controls">
		<div role="radiogroup" aria-label="Brush">
			{#each brushes as brush (brush.id)}
				<button type="button" role="radio" aria-checked={selected === brush.id} onclick={() => (selected = brush.id)}>{brush.name}</button>
			{/each}
		</div>
		<div role="radiogroup" aria-label="Ink">
			{#each inks as entry (entry.color)}
				<button type="button" role="radio" aria-checked={color === entry.color} onclick={() => (color = entry.color)}>{entry.name}</button>
			{/each}
		</div>
		<button type="button" onclick={() => ondip?.()}>Load the brush with ink</button>
	</div>
</div>

<style>
	.sb-ink-tray {
		position: relative;
		width: 100%;
		height: 100%;
	}

	/* For keyboards and screen readers; the scene is for pointers. */
	.sb-tray-controls {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
</style>
