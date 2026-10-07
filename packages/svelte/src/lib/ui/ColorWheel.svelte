<script module>
	/** @typedef {{ h: number, s: number, v: number }} Hsv */
</script>

<script>
	import { untrack } from 'svelte';
	import { clamp, INKS } from '@sveltebrush/core';
	import Slider from './Slider.svelte';
	import './reset.css';

	/**
	 * Colour disc (hue around, saturation outward) with a brightness slider and
	 * traditional ink swatches.
	 * @type {{
	 *   value?: string,
	 *   swatches?: { name: string, color: string }[],
	 *   class?: string
	 * }}
	 */
	let { value = $bindable('#16110d'), swatches = INKS, class: className = '' } = $props();

	/** @param {string} hex @returns {Hsv} */
	function toHsv(hex) {
		const n = parseInt(hex.replace('#', '').padEnd(6, '0').slice(0, 6), 16) || 0;
		const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => c / 255);
		const hi = Math.max(r, g, b);
		const d = hi - Math.min(r, g, b);
		let h = 0;
		if (d) h = hi === r ? ((g - b) / d) % 6 : hi === g ? (b - r) / d + 2 : (r - g) / d + 4;
		return { h: (h * 60 + 360) % 360, s: hi ? d / hi : 0, v: hi };
	}

	/** @param {Hsv} hsv */
	function toHex({ h, s, v }) {
		const f = (/** @type {number} */ k) => {
			const t = (k + h / 60) % 6;
			return Math.round((v - v * s * Math.max(0, Math.min(t, 4 - t, 1))) * 255);
		};
		return `#${[f(5), f(3), f(1)].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
	}

	let hsv = $state(toHsv(untrack(() => value)));
	let dragging = $state(false);

	/** @param {Hsv} next */
	function pick(next) {
		hsv = next;
		value = toHex(next);
	}

	/** @param {string} color */
	function choose(color) {
		hsv = toHsv(color);
		value = color;
	}

	/** @param {PointerEvent & { currentTarget: HTMLElement }} e */
	function seek(e) {
		const rect = e.currentTarget.getBoundingClientRect();
		const r = rect.width / 2;
		const dx = e.clientX - rect.left - r;
		const dy = e.clientY - rect.top - r;
		const h = ((Math.atan2(dy, dx) * 180) / Math.PI + 90 + 360) % 360;
		pick({ ...hsv, h, s: clamp(Math.hypot(dx, dy) / r, 0, 1), v: Math.max(hsv.v, 0.15) });
	}

	/** @param {HTMLCanvasElement} node */
	function disc(node) {
		const ctx = /** @type {CanvasRenderingContext2D} */ (node.getContext('2d'));
		let size = 0;

		/** @param {number} brightness */
		function paint(brightness) {
			if (!size) return;
			const dpr = Math.min(2, devicePixelRatio || 1);
			node.width = node.height = Math.round(size * dpr);
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
			const c = size / 2;
			ctx.beginPath();
			ctx.arc(c, c, c, 0, Math.PI * 2);
			ctx.clip();
			const hue = ctx.createConicGradient(-Math.PI / 2, c, c);
			for (let i = 0; i <= 12; i++) hue.addColorStop(i / 12, `hsl(${i * 30} 100% 50%)`);
			ctx.fillStyle = hue;
			ctx.fillRect(0, 0, size, size);
			const white = ctx.createRadialGradient(c, c, 0, c, c, c);
			white.addColorStop(0, '#fff');
			white.addColorStop(1, 'rgb(255 255 255 / 0)');
			ctx.fillStyle = white;
			ctx.fillRect(0, 0, size, size);
			ctx.fillStyle = `rgb(0 0 0 / ${1 - brightness})`;
			ctx.fillRect(0, 0, size, size);
		}

		const observer = new ResizeObserver(() => {
			size = node.clientWidth;
			paint(untrack(() => hsv.v));
		});
		observer.observe(node);
		$effect(() => paint(hsv.v));
		return () => observer.disconnect();
	}

	const angle = $derived(((hsv.h - 90) * Math.PI) / 180);
</script>

<div class={['color-wheel', 'sb-ui', className]}>
	<div
		class={['disc', { dragging }]}
		role="slider"
		tabindex="0"
		aria-label="Hue and saturation"
		aria-valuemin={0}
		aria-valuemax={360}
		aria-valuenow={Math.round(hsv.h)}
		onpointerdown={(e) => {
			e.currentTarget.setPointerCapture(e.pointerId);
			dragging = true;
			seek(e);
		}}
		onpointermove={(e) => dragging && seek(e)}
		onpointerup={() => (dragging = false)}
		onpointercancel={() => (dragging = false)}
		onkeydown={(e) => {
			const turn = { ArrowLeft: -5, ArrowRight: 5, ArrowUp: 0, ArrowDown: 0 }[e.key];
			if (turn === undefined) return;
			e.preventDefault();
			const s = clamp(hsv.s + (e.key === 'ArrowUp' ? 0.05 : e.key === 'ArrowDown' ? -0.05 : 0), 0, 1);
			pick({ ...hsv, h: (hsv.h + turn + 360) % 360, s });
		}}
	>
		<canvas {@attach disc}></canvas>
		<span
			class="marker"
			style:left="{50 + Math.cos(angle) * hsv.s * 50}%"
			style:top="{50 + Math.sin(angle) * hsv.s * 50}%"
			style:background={value}
		></span>
	</div>

	<Slider bind:value={() => hsv.v, (v) => pick({ ...hsv, v })} min={0} max={1} step={0.01} label="Brightness" />

	<div class="swatches">
		{#each swatches as swatch (swatch.color)}
			<button
				type="button"
				class={{ active: swatch.color === value }}
				style:background={swatch.color}
				title={swatch.name}
				aria-label={swatch.name}
				onclick={() => choose(swatch.color)}
			></button>
		{/each}
		<output>{value}</output>
	</div>
</div>

<style>
	.color-wheel {
		display: grid;
		gap: 12px;
		font-family: Inter, system-ui, sans-serif;
		color: #2a221b;
	}

	.disc {
		position: relative;
		width: min(100%, 220px);
		aspect-ratio: 1;
		justify-self: center;
		border-radius: 50%;
		box-shadow:
			0 0 0 1px rgb(30 24 19 / 0.08),
			0 6px 18px rgb(30 20 10 / 0.15);
		cursor: crosshair;
		touch-action: none;
		outline: none;

		&:focus-visible {
			box-shadow: 0 0 0 2px rgb(181 40 28 / 0.6);
		}

		canvas {
			display: block;
			width: 100%;
			height: 100%;
			border-radius: 50%;
		}
	}

	.marker {
		position: absolute;
		width: 22px;
		height: 22px;
		translate: -50% -50%;
		border: 3px solid #fff;
		border-radius: 50%;
		box-shadow: 0 1px 6px rgb(0 0 0 / 0.35);
		pointer-events: none;
		transition: scale 0.15s ease;
	}

	.dragging .marker {
		scale: 1.2;
	}

	.swatches {
		display: flex;
		align-items: center;
		gap: 8px;

		button {
			width: 26px;
			height: 26px;
			margin: 0;
			padding: 0;
			border: none;
			border-radius: 50%;
			box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.2);
			cursor: pointer;
			transition: scale 0.15s ease;

			&:hover {
				opacity: 1;
				scale: 1.08;
			}

			&.active {
				box-shadow:
					0 0 0 2px #fbf8f2,
					0 0 0 3.5px currentColor;
			}
		}

		output {
			margin-left: auto;
			font-size: 0.72rem;
			font-variant-numeric: tabular-nums;
			text-transform: uppercase;
			opacity: 0.55;
		}
	}
</style>
