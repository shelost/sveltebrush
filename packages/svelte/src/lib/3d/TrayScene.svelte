<script>
	import { T, useTask, useThrelte } from '@threlte/core';
	import { interactivity } from '@threlte/extras';
	import { ExtrudeGeometry, MeshBasicMaterial, Path, Shape } from 'three';
	import Brush3D, { BRUSH_LENGTH } from './Brush3D.svelte';
	import Glide from './Glide.svelte';
	import Lights from './Lights.svelte';

	/**
	 * The writing things on the table: an inkstone with its pool of ink, a row of inks in dishes,
	 * and the brushes lying on a rest. Holding the pointer over the pool soaks the brush, faster
	 * the longer it stays, and clicking the pool loads it full. Clicking a dish picks its ink;
	 * clicking a brush picks it up, and the one in hand is lifted off the rest.
	 * @type {{
	 *   brushes: { id: string, name: string }[],
	 *   selected: string,
	 *   ink: number,
	 *   color: string,
	 *   inks: { name: string, color: string }[],
	 *   still: boolean,
	 *   onpick: (id: string) => void,
	 *   oncolor: (color: string) => void,
	 *   onload: (amount: number) => void,
	 *   ondip: () => void
	 * }}
	 */
	let { brushes, selected, ink, color, inks, still, onpick, oncolor, onload, ondip } = $props();

	const { size, invalidate } = useThrelte();
	interactivity({ filter: (hits) => hits.slice(0, 1) });

	/** The slab, its pool cut into the far end, the rest the brushes lie across, and the dishes, in meters. */
	const STONE = { x: -0.25, w: 0.19, d: 0.27, h: 0.026 };
	const POOL = { z: -0.068, rx: 0.066, rz: 0.044 };
	const REST = { from: -0.02, to: 0.42, h: 0.022, z: [-0.09, 0, 0.09] };
	const DISH = { z: 0.205, from: -0.32, to: 0.4, r: 0.027, h: 0.012 };
	const LAID = 0.42;
	const HIDDEN = new MeshBasicMaterial({ visible: false });
	const TARGET = /** @type {[number, number, number]} */ ([0.04, 0.03, 0.035]);

	const slab = (() => {
		const { w, d } = STONE;
		const r = 0.03;
		const outline = new Shape();
		outline.moveTo(-w / 2 + r, -d / 2);
		outline.lineTo(w / 2 - r, -d / 2);
		outline.quadraticCurveTo(w / 2, -d / 2, w / 2, -d / 2 + r);
		outline.lineTo(w / 2, d / 2 - r);
		outline.quadraticCurveTo(w / 2, d / 2, w / 2 - r, d / 2);
		outline.lineTo(-w / 2 + r, d / 2);
		outline.quadraticCurveTo(-w / 2, d / 2, -w / 2, d / 2 - r);
		outline.lineTo(-w / 2, -d / 2 + r);
		outline.quadraticCurveTo(-w / 2, -d / 2, -w / 2 + r, -d / 2);
		const pool = new Path();
		pool.absellipse(0, -POOL.z, POOL.rx, POOL.rz, 0, Math.PI * 2, true);
		outline.holes.push(pool);
		return new ExtrudeGeometry(outline, {
			depth: STONE.h,
			bevelEnabled: true,
			bevelThickness: 0.005,
			bevelSize: 0.005,
			bevelSegments: 3,
			curveSegments: 32
		});
	})();

	$effect(() => () => {
		slab.dispose();
		HIDDEN.dispose();
	});

	let soaking = $state(false);
	/** @type {string | null} */
	let pointed = $state(null);
	/** @type {string | null} */
	let hovered = $state(null);
	let dwell = 0;
	/** Two rings run out across the pool while the brush is in it, half a beat apart. */
	let ripple = $state(0);
	let fading = $state(0);

	useTask(
		(delta) => {
			const dt = Math.min(delta, 0.064);
			if (soaking) {
				dwell += dt;
				onload((0.32 + Math.min(1, dwell / 1.2) * 0.7) * (ink > 1 ? 0.3 : 1) * dt);
				fading = Math.min(1, fading + dt * 4);
			} else {
				dwell = 0;
				fading = Math.max(0, fading - dt * 2);
			}
			if (fading > 0 && !still) {
				ripple = (ripple + dt / 1.3) % 1;
				invalidate();
			}
		},
		{ autoInvalidate: false }
	);

	const zoom = $derived(Math.min(size.current.width / 0.84, size.current.height / 0.46));

	/** @param {import('three').OrthographicCamera} camera */
	function aim(camera) {
		camera.position.set(TARGET[0], TARGET[1] + 1.15, TARGET[2] + 1);
		camera.lookAt(...TARGET);
	}

	/** @param {string} id @param {number} n */
	function pose(id, n) {
		const z = REST.z[n] ?? 0;
		const lift = selected === id ? 0.07 : pointed === id ? 0.018 : 0;
		return {
			position: /** @type {[number, number, number]} */ ([REST.from + 0.01, REST.h + 0.025 + lift, z + (selected === id ? 0.025 : 0)]),
			rotation: /** @type {[number, number, number]} */ ([0, 0, -Math.PI / 2 + (selected === id ? 0.14 : 0)])
		};
	}

	/** @param {number} n @param {number} count */
	const dishX = (n, count) => (count < 2 ? (DISH.from + DISH.to) / 2 : DISH.from + ((DISH.to - DISH.from) * n) / (count - 1));
</script>

<T.OrthographicCamera makeDefault {zoom} near={0.01} far={10} oncreate={aim} />
<Lights reach={0.6} resolution={1024} />

<T.Mesh rotation.x={-Math.PI / 2} position.x={TARGET[0]} receiveShadow>
	<T.PlaneGeometry args={[3, 3]} />
	<T.ShadowMaterial opacity={0.16} />
</T.Mesh>

<T.Group position.x={STONE.x}>
	<T.Mesh geometry={slab} rotation.x={-Math.PI / 2} position.y={0.005} castShadow receiveShadow>
		<T.MeshStandardMaterial color="#2c2a27" roughness={0.62} />
	</T.Mesh>
	<T.Mesh position={[0, STONE.h * 0.62, POOL.z]} scale={[POOL.rx, 1, POOL.rz]}>
		<T.CylinderGeometry args={[1, 1, 0.004, 48]} />
		<T.MeshPhysicalMaterial {color} roughness={0.06} clearcoat={1} clearcoatRoughness={0.04} />
	</T.Mesh>
	<T.Mesh position={[0, STONE.h + 0.0105, 0.045]} scale={[STONE.w * 0.36, 1, STONE.d * 0.24]}>
		<T.CylinderGeometry args={[1, 1, 0.004, 40]} />
		<T.MeshStandardMaterial color="#1f1d1b" roughness={0.4} />
	</T.Mesh>
	{#each [0, 0.5] as offset (offset)}
		{@const phase = (ripple + offset) % 1}
		<T.Mesh
			position={[0, STONE.h * 0.62 + 0.003, POOL.z]}
			rotation.x={-Math.PI / 2}
			scale={[POOL.rx * phase, POOL.rz * phase, 1]}
			visible={fading > 0}
		>
			<T.RingGeometry args={[0.86, 1, 48]} />
			<T.MeshBasicMaterial color="#ffffff" transparent opacity={(1 - phase) * 0.45 * fading} depthWrite={false} />
		</T.Mesh>
	{/each}
	<T.Mesh
		position={[0, STONE.h, POOL.z]}
		scale={[POOL.rx, 1, POOL.rz]}
		material={HIDDEN}
		onpointerenter={() => (soaking = true)}
		onpointerleave={() => (soaking = false)}
		onclick={ondip}
	>
		<T.CylinderGeometry args={[1, 1, 0.03, 24]} />
	</T.Mesh>
</T.Group>

{#each [0.03, 0.36] as x (x)}
	<T.Mesh position={[x, REST.h / 2, 0]} castShadow receiveShadow>
		<T.BoxGeometry args={[0.026, REST.h, 0.3]} />
		<T.MeshStandardMaterial color="#c6d0bf" roughness={0.35} />
	</T.Mesh>
{/each}

{#each brushes as brush, n (brush.id)}
	{@const at = pose(brush.id, n)}
	<Glide position={at.position} rotation={at.rotation} scale={LAID} {still} stiffness={150}>
		<Brush3D id={brush.id} ink={selected === brush.id ? ink : 0} {color} />
		<T.Mesh
			position.y={BRUSH_LENGTH / 2}
			material={HIDDEN}
			onpointerenter={() => (pointed = brush.id)}
			onpointerleave={() => pointed === brush.id && (pointed = null)}
			onclick={() => onpick(brush.id)}
		>
			<T.BoxGeometry args={[0.16, BRUSH_LENGTH, 0.16]} />
		</T.Mesh>
	</Glide>
{/each}

{#each inks as entry, n (entry.color)}
	{@const on = entry.color === color}
	<Glide
		position={[dishX(n, inks.length), on ? 0.012 : hovered === entry.color ? 0.005 : 0, DISH.z]}
		scale={on ? 1.12 : 1}
		{still}
		stiffness={160}
	>
		<T.Mesh position.y={DISH.h / 2} castShadow receiveShadow>
			<T.CylinderGeometry args={[DISH.r, DISH.r * 0.82, DISH.h, 40]} />
			<T.MeshStandardMaterial color="#f2eee5" roughness={0.3} />
		</T.Mesh>
		<T.Mesh position.y={DISH.h + 0.0006}>
			<T.CylinderGeometry args={[DISH.r * 0.74, DISH.r * 0.74, 0.002, 40]} />
			<T.MeshPhysicalMaterial color={entry.color} roughness={0.08} clearcoat={1} clearcoatRoughness={0.05} />
		</T.Mesh>
		<T.Mesh
			position.y={DISH.h}
			material={HIDDEN}
			onpointerenter={() => (hovered = entry.color)}
			onpointerleave={() => hovered === entry.color && (hovered = null)}
			onclick={() => oncolor(entry.color)}
		>
			<T.CylinderGeometry args={[DISH.r * 1.25, DISH.r * 1.25, DISH.h * 3, 16]} />
		</T.Mesh>
	</Glide>
{/each}
