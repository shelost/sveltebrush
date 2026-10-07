<script>
	import { clamp } from '@sveltebrush/core';
	import './reset.css';

	/**
	 * @type {{
	 *   value?: number,
	 *   min?: number,
	 *   max?: number,
	 *   step?: number,
	 *   label?: string,
	 *   hint?: string,
	 *   orientation?: 'horizontal' | 'vertical',
	 *   format?: (value: number) => string,
	 *   class?: string
	 * }}
	 */
	let {
		value = $bindable(0),
		min = 0,
		max = 1,
		step = 0.01,
		label = '',
		hint = '',
		orientation = 'horizontal',
		format = (v) => (step < 1 && max <= 2 ? `${Math.round(((v - min) / (max - min)) * 100)}%` : `${Math.round(v)}`),
		class: className = ''
	} = $props();

	const vertical = $derived(orientation === 'vertical');
	const ratio = $derived(clamp((value - min) / (max - min), 0, 1));
	const decimals = $derived(Math.max(0, -Math.floor(Math.log10(step))));
	let dragging = $state(false);

	/** @param {number} raw */
	function commit(raw) {
		const snapped = Math.round((clamp(raw, min, max) - min) / step) * step + min;
		value = Number(snapped.toFixed(decimals));
	}

	/** @param {PointerEvent & { currentTarget: HTMLElement }} e */
	function seek(e) {
		const rect = e.currentTarget.getBoundingClientRect();
		const t = vertical ? 1 - (e.clientY - rect.top) / rect.height : (e.clientX - rect.left) / rect.width;
		commit(min + clamp(t, 0, 1) * (max - min));
	}

	/** @param {KeyboardEvent} e */
	function onkeydown(e) {
		const big = (max - min) / 10;
		const moves = {
			ArrowUp: step,
			ArrowRight: step,
			ArrowDown: -step,
			ArrowLeft: -step,
			PageUp: big,
			PageDown: -big
		};
		if (e.key in moves) {
			e.preventDefault();
			commit(value + moves[/** @type {keyof typeof moves} */ (e.key)]);
		} else if (e.key === 'Home' || e.key === 'End') {
			e.preventDefault();
			commit(e.key === 'Home' ? min : max);
		}
	}
</script>

<div class={['slider', 'sb-ui', orientation, className, { dragging }]}>
	{#if label && !vertical}
		<div class="label">
			<span>{label}</span>
			<output>{format(value)}</output>
		</div>
	{/if}
	<div
		class="track"
		role="slider"
		tabindex="0"
		aria-label={label}
		aria-orientation={orientation}
		aria-valuemin={min}
		aria-valuemax={max}
		aria-valuenow={value}
		aria-valuetext={format(value)}
		style:--ratio={ratio}
		onpointerdown={(e) => {
			e.currentTarget.setPointerCapture(e.pointerId);
			dragging = true;
			seek(e);
		}}
		onpointermove={(e) => dragging && seek(e)}
		onpointerup={() => (dragging = false)}
		onpointercancel={() => (dragging = false)}
		{onkeydown}
	>
		<div class="fill"></div>
		<div class="thumb"></div>
		{#if vertical && dragging}
			<output class="bubble">{format(value)}</output>
		{/if}
	</div>
	{#if hint && !vertical}
		<p class="hint">{hint}</p>
	{/if}
</div>

<style>
	.slider {
		--track: rgb(30 24 19 / 0.12);
		--fill: rgb(30 24 19 / 0.82);
		--thumb: #fbf8f2;
		display: grid;
		gap: 8px;
		touch-action: none;
		user-select: none;
		-webkit-user-select: none;
	}

	.label {
		display: flex;
		justify-content: space-between;
		font-size: 0.82rem;

		output {
			font-variant-numeric: tabular-nums;
			opacity: 0.6;
		}
	}

	.hint {
		margin: -2px 0 0;
		font-size: 0.72rem;
		opacity: 0.45;
	}

	.track {
		position: relative;
		border-radius: 999px;
		background: var(--track);
		cursor: pointer;
		outline: none;

		&:focus-visible {
			box-shadow: 0 0 0 2px rgb(181 40 28 / 0.6);
		}
	}

	.fill {
		position: absolute;
		border-radius: inherit;
		background: var(--fill);
	}

	.thumb {
		position: absolute;
		border-radius: 999px;
		background: var(--thumb);
		box-shadow:
			0 1px 4px rgb(0 0 0 / 0.25),
			0 0 0 0.5px rgb(0 0 0 / 0.12);
		transition: scale 0.15s ease;
	}

	.dragging .thumb {
		scale: 1.12;
	}

	.horizontal .track {
		height: 6px;
		margin: 8px 0;

		.fill {
			inset: 0 auto 0 0;
			width: calc(var(--ratio) * 100%);
		}

		.thumb {
			top: 50%;
			left: calc(var(--ratio) * 100%);
			width: 22px;
			height: 22px;
			translate: -50% -50%;
		}
	}

	.vertical {
		height: 100%;

		.track {
			width: 30px;
			height: 100%;
			background: rgb(250 246 238 / 0.7);
			box-shadow: inset 0 0 0 1px rgb(30 24 19 / 0.1);
			backdrop-filter: blur(10px);
		}

		.fill {
			inset: auto 0 0 0;
			height: calc(var(--ratio) * 100%);
			background: rgb(30 24 19 / 0.08);
		}

		.thumb {
			left: 50%;
			bottom: calc(var(--ratio) * (100% - 14px));
			width: 22px;
			height: 14px;
			translate: -50% 0;
			border-radius: 5px;
			background: #1e1813;
		}
	}

	.bubble {
		position: absolute;
		left: calc(100% + 12px);
		bottom: calc(var(--ratio) * 100%);
		translate: 0 50%;
		padding: 4px 10px;
		border-radius: 8px;
		background: #1e1813;
		color: #f4ecdd;
		font-size: 0.78rem;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
		pointer-events: none;
	}
</style>
