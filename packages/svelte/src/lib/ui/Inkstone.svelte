<script>
	import { clamp, MAX_INK } from '@sveltebrush/core';
	import './reset.css';

	/**
	 * Inkstone (벼루 · 硯) drawn on a canvas: a carved slab with an ink pool (연지)
	 * at the top and a grinding flat (연당) below. Hover the brush over the pool to
	 * soak it; the longer it rests there the faster it drinks, up to an overload
	 * that floods the paper. The meter beside it can be dragged to set the level.
	 * @type {{
	 *   level?: number,
	 *   max?: number,
	 *   color?: string,
	 *   onload?: (amount: number) => void,
	 *   onset?: (level: number) => void,
	 *   class?: string
	 * }}
	 */
	let { level = 0, max = MAX_INK, color = '#16110d', onload, onset, class: className = '' } = $props();

	let soaking = $state(false);
	let dragging = $state(false);

	const ratio = $derived(clamp(level / max, 0, 1));
	const status = $derived(level < 0.06 ? 'empty' : level < 0.3 ? 'low' : level > 1 ? 'flooded' : 'ready');
	const caption = $derived(
		soaking ? 'Soaking…' : { empty: 'Hover over the ink', low: 'Running dry', ready: 'Loaded', flooded: 'Overloaded' }[status]
	);

	/** @param {string} value @param {number} k 0 = unchanged, 1 = black */
	function shade(value, k) {
		const probe = /** @type {CanvasRenderingContext2D} */ (document.createElement('canvas').getContext('2d'));
		probe.fillStyle = value;
		const hex = String(probe.fillStyle);
		const n = hex.startsWith('#') ? parseInt(hex.slice(1), 16) : 0x16110d;
		const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(v * (1 - k)));
		return `rgb(${c[0]} ${c[1]} ${c[2]})`;
	}

	/** @param {number} w @param {number} h */
	function geometry(w, h) {
		const m = w * 0.085;
		const field = { x: m, y: m, w: w - 2 * m, h: h - 2 * m, r: w * 0.1 };
		const side = field.y + field.h * 0.25;
		const bank = field.y + field.h * 0.4;
		const control = (8 * bank - 2 * side) / 6;
		const { x, y, w: fw, r } = field;
		/** @param {Path2D} path */
		const curve = (path) => path.bezierCurveTo(x + fw * 0.76, control, x + fw * 0.24, control, x, side);
		const pool = new Path2D();
		pool.moveTo(x, side);
		pool.lineTo(x, y + r);
		pool.arcTo(x, y, x + r, y, r);
		pool.lineTo(x + fw - r, y);
		pool.arcTo(x + fw, y, x + fw, y + r, r);
		pool.lineTo(x + fw, side);
		curve(pool);
		pool.closePath();
		const edge = new Path2D();
		edge.moveTo(x + fw, side);
		curve(edge);
		const well = new Path2D();
		well.roundRect(field.x, field.y, field.w, field.h, field.r);
		return { field, pool, edge, well, bank };
	}

	/**
	 * Carved inner shadow: everything outside `path` casts onto its inside.
	 * @param {CanvasRenderingContext2D} ctx @param {Path2D} path @param {number} w @param {number} h @param {number} dpr
	 */
	function recess(ctx, path, w, h, dpr, depth = 1) {
		ctx.save();
		ctx.clip(path);
		const ring = new Path2D();
		ring.rect(-w, -h, w * 3, h * 3);
		ring.addPath(path);
		ctx.shadowColor = `rgb(0 0 0 / ${0.75 * depth})`;
		ctx.shadowBlur = 7 * dpr * depth;
		ctx.shadowOffsetY = 2.5 * dpr * depth;
		ctx.fillStyle = '#000';
		ctx.fill(ring, 'evenodd');
		ctx.restore();
	}

	/** @param {HTMLCanvasElement} node */
	function stone(node) {
		const ctx = /** @type {CanvasRenderingContext2D} */ (node.getContext('2d'));
		const base = document.createElement('canvas');
		const wet = document.createElement('canvas');
		const baseCtx = /** @type {CanvasRenderingContext2D} */ (base.getContext('2d'));
		const wetCtx = /** @type {CanvasRenderingContext2D} */ (wet.getContext('2d'));
		const still = matchMedia('(prefers-reduced-motion: reduce)');

		let w = 0;
		let h = 0;
		let dpr = 1;
		let shape = geometry(1, 1);
		let ink = '';
		let stain = '';
		let frame = 0;
		let last = 0;
		let time = 0;
		let damp = 0;
		let dwell = 0;
		let travelled = 0;
		let spawn = 0;
		const tip = { x: 0, y: 0, vx: 0, vy: 0, t: 0, over: false, pool: false, splay: 0 };
		/** @type {{ x: number, y: number, r: number, life: number }[]} */
		const ripples = [];

		function paintBase() {
			base.width = Math.round(w * dpr);
			base.height = Math.round(h * dpr);
			const c = baseCtx;
			c.setTransform(dpr, 0, 0, dpr, 0, 0);
			const slab = c.createLinearGradient(0, 0, w * 0.6, h);
			slab.addColorStop(0, '#55514c');
			slab.addColorStop(0.45, '#2f2d2a');
			slab.addColorStop(1, '#1b1a18');
			c.fillStyle = slab;
			c.fillRect(0, 0, w, h);
			for (let i = 0; i < w * h * 0.06; i++) {
				c.fillStyle = Math.random() < 0.5 ? `rgb(255 255 255 / ${Math.random() * 0.07})` : `rgb(0 0 0 / ${Math.random() * 0.25})`;
				c.fillRect(Math.random() * w, Math.random() * h, 0.6, 0.6);
			}
			c.strokeStyle = 'rgb(255 255 255 / 0.05)';
			c.lineWidth = 0.6;
			for (let i = 0; i < 3; i++) {
				c.beginPath();
				c.moveTo(Math.random() * w, 0);
				c.bezierCurveTo(Math.random() * w, h * 0.3, Math.random() * w, h * 0.7, Math.random() * w, h);
				c.stroke();
			}

			const { field, pool, edge, well, bank } = shape;
			const floor = c.createLinearGradient(0, field.y, 0, field.y + field.h);
			floor.addColorStop(0, '#24221f');
			floor.addColorStop(1, '#302d2a');
			c.fillStyle = floor;
			c.fill(well);
			const sheen = c.createRadialGradient(w * 0.42, bank + field.h * 0.25, 0, w * 0.5, bank + field.h * 0.3, field.w * 0.75);
			sheen.addColorStop(0, 'rgb(255 255 255 / 0.07)');
			sheen.addColorStop(1, 'rgb(255 255 255 / 0)');
			c.fillStyle = sheen;
			c.fill(well);
			recess(c, well, w, h, dpr);
			c.strokeStyle = 'rgb(255 255 255 / 0.1)';
			c.lineWidth = 1;
			c.beginPath();
			c.roundRect(field.x - 0.5, field.y - 0.5, field.w + 1, field.h + 1, field.r + 0.5);
			c.stroke();

			const liquid = c.createLinearGradient(0, field.y, 0, bank);
			liquid.addColorStop(0, shade(color, 0.82));
			liquid.addColorStop(1, shade(color, 0.6));
			c.fillStyle = liquid;
			c.fill(pool);
			recess(c, pool, w, h, dpr, 0.8);
			c.save();
			c.translate(0, 1);
			c.strokeStyle = 'rgb(255 255 255 / 0.16)';
			c.lineWidth = 1.2;
			c.stroke(edge);
			c.restore();
			c.strokeStyle = 'rgb(0 0 0 / 0.5)';
			c.lineWidth = 1;
			c.stroke(edge);

			wet.width = base.width;
			wet.height = base.height;
			wetCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
		}

		function fit() {
			w = node.clientWidth;
			h = node.clientHeight;
			if (!w || !h) return;
			dpr = Math.min(2, devicePixelRatio || 1);
			node.width = Math.round(w * dpr);
			node.height = Math.round(h * dpr);
			shape = geometry(w, h);
			paintBase();
			draw();
		}

		function drawBrush() {
			const L = w * 0.26;
			const thick = w * 0.085;
			const dir = { x: 0.52, y: -0.85 };
			const speed = Math.hypot(tip.vx, tip.vy);
			const drag = Math.min(1, speed / (w * 3)) * L * 0.4;
			const tx = speed ? (-tip.vx / speed) * drag : 0;
			const ty = speed ? (-tip.vy / speed) * drag : 0;
			const contact = { x: tip.x + tx, y: tip.y + ty };
			const root = { x: tip.x + dir.x * L, y: tip.y + dir.y * L };
			const nx = -dir.y;
			const ny = dir.x;
			const spread = thick * (0.5 + tip.splay * 0.18);

			ctx.save();
			ctx.lineCap = 'round';
			ctx.strokeStyle = 'rgb(0 0 0 / 0.28)';
			ctx.lineWidth = thick * 1.1;
			ctx.beginPath();
			ctx.moveTo(contact.x + w * 0.05, contact.y + w * 0.09);
			ctx.lineTo(root.x + dir.x * L * 5 + w * 0.12, root.y + dir.y * L * 5 + w * 0.2);
			ctx.stroke();
			ctx.restore();

			if (tip.pool) {
				ctx.fillStyle = 'rgb(0 0 0 / 0.45)';
				ctx.beginPath();
				ctx.ellipse(contact.x, contact.y, spread * 1.5, spread * 1.2, 0, 0, Math.PI * 2);
				ctx.fill();
				ctx.strokeStyle = 'rgb(255 255 255 / 0.3)';
				ctx.lineWidth = 0.8;
				ctx.beginPath();
				ctx.ellipse(contact.x, contact.y, spread * 1.9, spread * 1.5, 0, 0, Math.PI * 2);
				ctx.stroke();
			}

			const mid = { x: (contact.x + root.x) / 2 + tx * 0.5, y: (contact.y + root.y) / 2 + ty * 0.5 };
			const hair = new Path2D();
			hair.moveTo(contact.x, contact.y);
			hair.quadraticCurveTo(mid.x + nx * spread * 1.3, mid.y + ny * spread * 1.3, root.x + nx * spread, root.y + ny * spread);
			hair.lineTo(root.x - nx * spread, root.y - ny * spread);
			hair.quadraticCurveTo(mid.x - nx * spread * 1.3, mid.y - ny * spread * 1.3, contact.x, contact.y);
			const soaked = clamp(0.12 + Math.min(1, level) * 0.78, 0, 0.98);
			const fur = ctx.createLinearGradient(contact.x, contact.y, root.x, root.y);
			fur.addColorStop(0, ink);
			fur.addColorStop(soaked * 0.85, ink);
			fur.addColorStop(Math.min(0.99, soaked + 0.08), '#d9ccb2');
			fur.addColorStop(1, '#efe5d1');
			ctx.fillStyle = fur;
			ctx.fill(hair);
			ctx.save();
			ctx.clip(hair);
			ctx.strokeStyle = 'rgb(255 255 255 / 0.12)';
			ctx.lineWidth = 0.5;
			for (let i = -2; i <= 2; i++) {
				ctx.beginPath();
				ctx.moveTo(contact.x, contact.y);
				ctx.quadraticCurveTo(
					mid.x + nx * spread * i * 0.4,
					mid.y + ny * spread * i * 0.4,
					root.x + nx * spread * i * 0.4,
					root.y + ny * spread * i * 0.4
				);
				ctx.stroke();
			}
			if (level > 0.2) {
				ctx.fillStyle = 'rgb(255 255 255 / 0.18)';
				ctx.beginPath();
				ctx.ellipse(
					contact.x + (root.x - contact.x) * 0.3 - nx,
					contact.y + (root.y - contact.y) * 0.3 - ny,
					spread * 0.25,
					L * 0.18,
					Math.atan2(dir.y, dir.x) + Math.PI / 2,
					0,
					Math.PI * 2
				);
				ctx.fill();
			}
			ctx.restore();

			const ferrule = { x: root.x + dir.x * w * 0.07, y: root.y + dir.y * w * 0.07 };
			const end = { x: root.x + dir.x * L * 6, y: root.y + dir.y * L * 6 };
			/** @param {number} width @param {string[]} stops */
			const across = (width, stops) => {
				const g = ctx.createLinearGradient(root.x + nx * width, root.y + ny * width, root.x - nx * width, root.y - ny * width);
				stops.forEach((stop, i) => g.addColorStop(i / (stops.length - 1), stop));
				return g;
			};
			ctx.lineCap = 'butt';
			ctx.strokeStyle = across(thick * 0.5, ['#7c5f3a', '#e0c08a', '#a9844f', '#6e5232']);
			ctx.lineWidth = thick * 0.92;
			ctx.beginPath();
			ctx.moveTo(ferrule.x, ferrule.y);
			ctx.lineTo(end.x, end.y);
			ctx.stroke();
			ctx.strokeStyle = 'rgb(60 40 20 / 0.55)';
			ctx.lineWidth = thick * 0.95;
			for (const at of [L * 1.3, L * 2.6]) {
				ctx.beginPath();
				ctx.moveTo(ferrule.x + dir.x * at, ferrule.y + dir.y * at);
				ctx.lineTo(ferrule.x + dir.x * (at + 0.9), ferrule.y + dir.y * (at + 0.9));
				ctx.stroke();
			}
			ctx.strokeStyle = across(thick * 0.55, ['#1a1512', '#5b4c3e', '#2a221c', '#120e0c']);
			ctx.lineWidth = thick * 1.05;
			ctx.beginPath();
			ctx.moveTo(root.x - dir.x * 0.5, root.y - dir.y * 0.5);
			ctx.lineTo(ferrule.x, ferrule.y);
			ctx.stroke();
		}

		function draw() {
			if (!w) return;
			ctx.setTransform(1, 0, 0, 1, 0, 0);
			ctx.clearRect(0, 0, node.width, node.height);
			ctx.drawImage(base, 0, 0);
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
			if (damp > 0.01) {
				ctx.save();
				ctx.clip(shape.well);
				ctx.drawImage(wet, 0, 0, w, h);
				ctx.restore();
			}

			const { field, pool } = shape;
			ctx.save();
			ctx.clip(pool);
			const drift = still.matches ? 0 : Math.sin(time * 0.6) * field.w * 0.06;
			const glint = ctx.createRadialGradient(
				field.x + field.w * 0.3 + drift,
				field.y + field.h * 0.07,
				0,
				field.x + field.w * 0.3 + drift,
				field.y + field.h * 0.07,
				field.w * 0.45
			);
			glint.addColorStop(0, 'rgb(255 255 255 / 0.2)');
			glint.addColorStop(1, 'rgb(255 255 255 / 0)');
			ctx.fillStyle = glint;
			ctx.fill(pool);
			for (const ripple of ripples) {
				const a = ripple.life;
				ctx.lineWidth = 1;
				ctx.strokeStyle = `rgb(255 255 255 / ${0.32 * a})`;
				ctx.beginPath();
				ctx.ellipse(ripple.x, ripple.y, ripple.r, ripple.r * 0.82, 0, 0, Math.PI * 2);
				ctx.stroke();
				ctx.strokeStyle = `rgb(0 0 0 / ${0.4 * a})`;
				ctx.beginPath();
				ctx.ellipse(ripple.x, ripple.y + 1, Math.max(0, ripple.r - 1.2), Math.max(0, ripple.r - 1.2) * 0.82, 0, 0, Math.PI * 2);
				ctx.stroke();
			}
			ctx.restore();

			if (tip.over) drawBrush();
		}

		/** @param {number} now */
		function loop(now) {
			frame = 0;
			const dt = Math.min(0.064, (now - last) / 1000 || 0.016);
			last = now;
			time += dt;

			if (tip.over) {
				dwell = tip.pool ? dwell + dt : 0;
				const speed = Math.hypot(tip.vx, tip.vy);
				let rate = 0;
				if (tip.pool) rate = (0.32 + Math.min(1, dwell / 1.2) * 0.7 + Math.min(0.4, speed / (w * 4))) * (level > 1 ? 0.3 : 1);
				else if (damp > 0.2) rate = 0.04;
				if (rate) onload?.(rate * dt);
				tip.splay += ((tip.pool ? 1 : 0.4) - tip.splay) * Math.min(1, dt * 8);
				spawn -= dt;
				if (tip.pool && (spawn <= 0 || travelled > w * 0.07)) {
					ripples.push({ x: tip.x, y: tip.y, r: 1, life: 1 });
					spawn = 0.22;
					travelled = 0;
				}
				if (!tip.pool && speed > 4 && level > 0.15) {
					const blot = wetCtx.createRadialGradient(tip.x, tip.y, 0, tip.x, tip.y, w * 0.05);
					blot.addColorStop(0, stain.replace(')', ` / ${0.05 + Math.min(0.12, level * 0.08)})`));
					blot.addColorStop(1, 'rgb(0 0 0 / 0)');
					wetCtx.fillStyle = blot;
					wetCtx.fillRect(tip.x - w * 0.05, tip.y - w * 0.05, w * 0.1, w * 0.1);
					damp = 1;
				}
				tip.vx *= Math.pow(0.02, dt);
				tip.vy *= Math.pow(0.02, dt);
			}

			for (let i = ripples.length - 1; i >= 0; i--) {
				const ripple = ripples[i];
				ripple.r += dt * w * 0.28;
				ripple.life -= dt / 1.3;
				if (ripple.life <= 0) ripples.splice(i, 1);
			}
			if (damp > 0.01) {
				wetCtx.save();
				wetCtx.globalCompositeOperation = 'destination-out';
				wetCtx.fillStyle = `rgb(0 0 0 / ${dt * 0.18})`;
				wetCtx.fillRect(0, 0, w, h);
				wetCtx.restore();
				damp -= dt * 0.12;
			}

			draw();
			if (tip.over || ripples.length || damp > 0.01) frame = requestAnimationFrame(loop);
		}

		const wake = () => {
			if (!frame) {
				last = performance.now();
				frame = requestAnimationFrame(loop);
			}
		};

		/** @param {PointerEvent} e */
		function move(e) {
			const rect = node.getBoundingClientRect();
			const x = e.clientX - rect.left;
			const y = e.clientY - rect.top;
			const inside = x >= 0 && y >= 0 && x <= rect.width && y <= rect.height;
			if (!inside) return leave();
			if (tip.over) {
				const dt = Math.max(8, e.timeStamp - tip.t);
				tip.vx = tip.vx * 0.6 + ((x - tip.x) / dt) * 1000 * 0.4;
				tip.vy = tip.vy * 0.6 + ((y - tip.y) / dt) * 1000 * 0.4;
				travelled += Math.hypot(x - tip.x, y - tip.y);
			}
			tip.t = e.timeStamp;
			tip.x = x;
			tip.y = y;
			const pool = ctx.isPointInPath(shape.pool, x * dpr, y * dpr);
			if (pool && !tip.pool) ripples.push({ x, y, r: 1, life: 1 });
			tip.pool = pool;
			tip.over = true;
			soaking = pool;
			wake();
		}

		function leave() {
			tip.over = false;
			tip.pool = false;
			soaking = false;
			dwell = 0;
			wake();
		}

		/** @param {PointerEvent} e */
		function lift(e) {
			if (e.pointerType !== 'mouse') leave();
		}

		node.addEventListener('pointermove', move);
		node.addEventListener('pointerdown', move);
		node.addEventListener('pointerleave', leave);
		node.addEventListener('pointerup', lift);
		node.addEventListener('pointercancel', leave);
		const observer = new ResizeObserver(fit);
		observer.observe(node);

		$effect(() => {
			ink = shade(color, 0.6);
			stain = shade(color, 0.5);
			if (w) paintBase();
			draw();
		});

		return () => {
			cancelAnimationFrame(frame);
			observer.disconnect();
			node.removeEventListener('pointermove', move);
			node.removeEventListener('pointerdown', move);
			node.removeEventListener('pointerleave', leave);
			node.removeEventListener('pointerup', lift);
			node.removeEventListener('pointercancel', leave);
		};
	}

	/** @param {PointerEvent & { currentTarget: HTMLElement }} e */
	function seek(e) {
		const rect = e.currentTarget.getBoundingClientRect();
		onset?.(clamp(1 - (e.clientY - rect.top) / rect.height, 0, 1) * max);
	}

	/** @param {KeyboardEvent} e */
	function onkeydown(e) {
		const moves = { ArrowUp: 0.05, ArrowRight: 0.05, ArrowDown: -0.05, ArrowLeft: -0.05 };
		if (e.key in moves) {
			e.preventDefault();
			onset?.(clamp(level + moves[/** @type {keyof typeof moves} */ (e.key)] * max, 0, max));
		}
	}
</script>

<div class={['inkstone', 'sb-ui', status, className, { soaking, dragging }]}>
	<canvas class="stone" {@attach stone} aria-hidden="true"></canvas>

	<div
		class="meter"
		role="slider"
		tabindex="0"
		aria-label="Ink on brush"
		aria-orientation="vertical"
		aria-valuemin={0}
		aria-valuemax={max}
		aria-valuenow={level}
		aria-valuetext="{Math.round(level * 100)}%"
		style:--ratio={ratio}
		onpointerdown={(e) => {
			seek(e);
			dragging = true;
			e.currentTarget.setPointerCapture(e.pointerId);
		}}
		onpointermove={(e) => dragging && seek(e)}
		onpointerup={() => (dragging = false)}
		onpointercancel={() => (dragging = false)}
		{onkeydown}
	>
		<div class="flood" style:height="{(1 - 1 / max) * 100}%"></div>
		<div class="fill" style:background={color}></div>
		<div class="tick" style:bottom="{(1 / max) * 100}%"></div>
		<div class="handle"></div>
	</div>

	<div class="readout">
		<strong>{Math.round(level * 100)}%</strong>
		<span>{caption}</span>
	</div>
</div>

<style>
	.inkstone {
		display: grid;
		grid-template-columns: auto auto;
		grid-template-rows: auto auto;
		gap: 8px 10px;
		font-family: Inter, system-ui, sans-serif;
		color: #2a221b;
		user-select: none;
		-webkit-user-select: none;
	}

	.stone {
		display: block;
		width: var(--size, 96px);
		aspect-ratio: 1 / 1.36;
		border-radius: calc(var(--size, 96px) * 0.16);
		box-shadow:
			inset 0 1px 0 rgb(255 255 255 / 0.12),
			0 1px 1px rgb(0 0 0 / 0.25),
			0 12px 28px rgb(30 20 10 / 0.32);
		cursor: none;
		touch-action: none;
		-webkit-touch-callout: none;
	}

	.meter {
		position: relative;
		width: 14px;
		border-radius: 999px;
		background: rgb(30 24 19 / 0.1);
		box-shadow: inset 0 0 0 1px rgb(30 24 19 / 0.12);
		cursor: ns-resize;
		touch-action: none;
		outline: none;

		&:focus-visible {
			box-shadow: 0 0 0 2px rgb(181 40 28 / 0.6);
		}
	}

	.flood {
		position: absolute;
		inset: 0 0 auto;
		border-radius: 999px 999px 0 0;
		background: repeating-linear-gradient(-45deg, rgb(30 24 19 / 0.07) 0 3px, transparent 3px 6px);
	}

	.fill {
		position: absolute;
		inset: auto 0 0;
		height: calc(var(--ratio) * 100%);
		border-radius: 999px;
		box-shadow: inset 2px 0 3px rgb(255 255 255 / 0.18);
		transition: height 0.12s linear;
	}

	.dragging .fill {
		transition: none;
	}

	.tick {
		position: absolute;
		left: -3px;
		right: -3px;
		height: 1.5px;
		background: #b5281c;
	}

	.handle {
		position: absolute;
		left: 50%;
		bottom: calc(var(--ratio) * 100%);
		width: 22px;
		height: 8px;
		translate: -50% 50%;
		border-radius: 999px;
		background: #fbf8f2;
		box-shadow:
			0 1px 4px rgb(0 0 0 / 0.3),
			0 0 0 0.5px rgb(0 0 0 / 0.15);
		opacity: 0;
		transition:
			opacity 0.2s ease,
			scale 0.15s ease;
	}

	.meter:hover .handle,
	.meter:focus-visible .handle,
	.dragging .handle {
		opacity: 1;
	}

	.dragging .handle {
		scale: 1.15;
	}

	.readout {
		grid-column: 1 / -1;
		display: grid;
		font-size: 0.7rem;
		line-height: 1.3;

		strong {
			font-size: 0.85rem;
			font-weight: 600;
			font-variant-numeric: tabular-nums;
		}

		span {
			opacity: 0.55;
		}
	}

	.empty .readout span,
	.low .readout span {
		color: #b5281c;
		opacity: 0.9;
	}

	.empty .stone {
		animation: beckon 1.8s ease-in-out infinite;
	}

	@keyframes beckon {
		50% {
			box-shadow:
				inset 0 1px 0 rgb(255 255 255 / 0.12),
				0 0 0 4px rgb(181 40 28 / 0.3),
				0 12px 28px rgb(30 20 10 / 0.32);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.empty .stone {
			animation: none;
		}
	}
</style>
