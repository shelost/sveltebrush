<script>
	import { PROPERTIES } from '@sveltebrush/core';
	import InkCanvas from '../InkCanvas.svelte';
	import Slider from './Slider.svelte';
	import './reset.css';

	/**
	 * Procreate-style brush studio: attribute groups on the left, settings in the
	 * middle, and a live drawing pad that repaints a sample stroke on every change.
	 * @type {{
	 *   brush: import('@sveltebrush/core').BrushPreset,
	 *   groups?: import('@sveltebrush/core').PropertyGroup[],
	 *   onreset?: () => void,
	 *   onclose?: () => void,
	 *   class?: string
	 * }}
	 */
	let { brush = $bindable(), groups = PROPERTIES, onreset, onclose, class: className = '' } = $props();

	let active = $state(0);
	/** @type {ReturnType<typeof InkCanvas> | undefined} */
	let pad = $state();
	const group = $derived(groups[active] ?? groups[0]);

	$effect(() => {
		const current = { ...brush };
		if (!pad || !current) return;
		const frame = requestAnimationFrame(() => pad?.preview());
		return () => cancelAnimationFrame(frame);
	});
</script>

<div class={['studio', 'sb-ui', className]}>
	<header>
		<h2>{brush.name}</h2>
		<div class="actions">
			<button type="button" onclick={onreset}>Reset</button>
			<button type="button" class="done" onclick={onclose}>Done</button>
		</div>
	</header>

	<nav aria-label="Brush attributes">
		{#each groups as item, i (item.group)}
			<button type="button" class={{ active: i === active }} onclick={() => (active = i)}>
				{item.group}
			</button>
		{/each}
	</nav>

	<section class="settings">
		{#each group.items as property (property.key)}
			<Slider
				bind:value={brush[property.key]}
				min={property.min}
				max={property.max}
				step={property.step}
				label={property.label}
				hint={property.hint}
			/>
		{/each}
	</section>

	<section class="pad">
		<span class="caption">Drawing pad</span>
		<InkCanvas bind:this={pad} {brush} infinite timelapse={false} onresize={() => pad?.preview()} />
	</section>

	<p class="note">{brush.note}</p>
</div>

<style>
	.studio {
		display: grid;
		grid-template:
			'head head head' auto
			'nav settings pad' 1fr
			'nav note pad' auto / 150px minmax(220px, 1fr) minmax(240px, 1.2fr);
		gap: 14px 18px;
		min-height: 0;
		font-family: Inter, system-ui, sans-serif;
		color: #2a221b;
	}

	header {
		grid-area: head;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}

	header h2 {
		margin: 0;
		font-size: 1rem;
		font-weight: 600;
		text-align: left;
	}

	.actions {
		display: flex;
		gap: 6px;
	}

	button {
		margin: 0;
		padding: 7px 14px;
		border: 1px solid rgb(30 24 19 / 0.15);
		border-radius: 999px;
		background: transparent;
		box-shadow: none;
		color: inherit;
		font: inherit;
		font-size: 0.8rem;
		cursor: pointer;

		&:hover {
			opacity: 1;
			background: rgb(30 24 19 / 0.05);
		}
	}

	.done {
		border-color: #1e1813;
		background: #1e1813;
		color: #f4ecdd;

		&:hover {
			background: #1e1813;
		}
	}

	nav {
		grid-area: nav;
		display: grid;
		align-content: start;
		gap: 2px;

		button {
			display: flex;
			justify-content: space-between;
			border: none;
			border-radius: 10px;
			padding: 10px 12px;
			text-align: left;

			&.active {
				background: rgb(30 24 19 / 0.08);
				font-weight: 600;
			}
		}
	}

	.settings {
		grid-area: settings;
		display: grid;
		align-content: start;
		gap: 14px;
	}

	.pad {
		grid-area: pad;
		position: relative;
		min-height: 220px;
		overflow: hidden;
		border-radius: 14px;
		background: #f6efe1;
		box-shadow: inset 0 0 0 1px rgb(30 24 19 / 0.08);

		:global(.ink-canvas) {
			position: absolute;
			inset: 0;
		}
	}

	.caption {
		position: absolute;
		top: 10px;
		left: 12px;
		font-size: 0.68rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		opacity: 0.4;
		pointer-events: none;
	}

	.note {
		grid-area: note;
		margin: 0;
		font-size: 0.75rem;
		line-height: 1.5;
		opacity: 0.6;
	}

	@media (max-width: 720px) {
		.studio {
			grid-template:
				'head' auto
				'pad' 190px
				'nav' auto
				'settings' 1fr
				'note' auto / 1fr;
			gap: 12px;
		}

		.pad {
			min-height: 0;
		}

		.settings {
			overflow-y: auto;
			min-height: 0;
		}

		nav {
			display: flex;
			overflow-x: auto;
			scrollbar-width: none;

			button {
				flex: none;
				gap: 8px;
			}
		}
	}
</style>
