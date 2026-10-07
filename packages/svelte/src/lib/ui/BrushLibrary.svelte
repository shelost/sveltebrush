<script>
	import { drawPreview } from '@sveltebrush/core';
	import './reset.css';

	/**
	 * Procreate-style brush list with live-rendered stroke previews. Tap a brush to
	 * select it; tap the selected brush again to open it in the studio.
	 * @type {{
	 *   brushes: import('@sveltebrush/core').BrushPreset[],
	 *   selected?: string,
	 *   onedit?: (id: string) => void,
	 *   class?: string
	 * }}
	 */
	let { brushes, selected = $bindable(brushes[0]?.id), onedit, class: className = '' } = $props();

	/** @param {import('@sveltebrush/core').BrushPreset} brush */
	const thumbnail = (brush) => (/** @type {HTMLCanvasElement} */ node) => {
		drawPreview(node, { ...brush });
	};
</script>

<div class={['library', 'sb-ui', className]}>
	<header>
		<h2>Brush Library</h2>
	</header>
	<ul>
		{#each brushes as brush (brush.id)}
			<li>
				<button
					type="button"
					class={{ active: brush.id === selected }}
					aria-pressed={brush.id === selected}
					onclick={() => (brush.id === selected ? onedit?.(brush.id) : (selected = brush.id))}
				>
					<span class="text">
						<strong>{brush.name}</strong>
					</span>
					<canvas {@attach thumbnail(brush)}></canvas>
					{#if brush.id === selected}
						<span class="edit">Edit</span>
					{/if}
				</button>
			</li>
		{/each}
	</ul>
</div>

<style>
	.library {
		display: grid;
		gap: 10px;
		font-family: Inter, system-ui, sans-serif;
		color: #2a221b;
	}

	header {
		padding: 0 4px;

		h2 {
			margin: 0;
			font-size: 0.95rem;
			font-weight: 600;
			text-align: left;
		}
	}

	ul {
		display: grid;
		gap: 6px;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	button {
		position: relative;
		display: grid;
		grid-template-columns: 110px 1fr;
		align-items: center;
		width: 100%;
		margin: 0;
		padding: 8px 10px;
		border: none;
		border-radius: 12px;
		background: transparent;
		box-shadow: none;
		color: inherit;
		text-align: left;
		cursor: pointer;
		transition: background 0.15s ease;

		&:hover {
			background: rgb(30 24 19 / 0.05);
			opacity: 1;
		}

		&.active {
			background: #1e1813;
			color: #f4ecdd;

			canvas {
				filter: invert(0.92) sepia(0.2);
			}
		}
	}

	.text strong {
		font-size: 0.85rem;
		font-weight: 600;
	}

	canvas {
		width: 100%;
		height: 56px;
		pointer-events: none;
	}

	.edit {
		position: absolute;
		top: 6px;
		right: 10px;
		font-size: 0.65rem;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		opacity: 0.55;
	}
</style>
