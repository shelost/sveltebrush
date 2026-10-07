<script module>
	/**
	 * @typedef {{ radius: number, hair: number, handle: string, node: string, cap: string }} Build
	 * @typedef {Partial<Pick<Build, 'handle' | 'node' | 'cap'>>} Finish
	 */

	const GOLD = '#b8913f';

	/**
	 * Each brush in the set, told apart the way a real set is: the hair's fullness and length,
	 * and what the handle is made of. Brushes with other ids are built like the center tip.
	 * @type {Record<string, Build>}
	 */
	const BUILDS = {
		center: { radius: 0.042, hair: 0.27, handle: '#c9a46a', node: '#9c7640', cap: '#2a1d16' },
		side: { radius: 0.058, hair: 0.3, handle: '#5e3d26', node: '#3e2717', cap: '#1a1310' },
		'flying-white': { radius: 0.048, hair: 0.22, handle: '#1d1815', node: GOLD, cap: GOLD }
	};

	/** Red lacquer with gold nodes, for a brush that isn't yours. @type {Finish} */
	export const RED_LACQUER = { handle: '#a3241b', node: GOLD, cap: '#4a1410' };

	/** The length of every brush, tip to cord; the tip is at the origin and the handle runs up +y. */
	export const BRUSH_LENGTH = 1;
</script>

<script>
	import { T, useThrelte } from '@threlte/core';
	import { BufferAttribute, Color, LatheGeometry, Vector2 } from 'three';

	/**
	 * A calligraphy brush: a tuft of hair in a lacquered ferrule on a long handle with a cord at
	 * the end. The hair takes the ink from the tip up, as far as `ink` says it's soaked, and
	 * `splay` spreads it the way pressing it to the paper does. `shadow` is whether it casts one,
	 * and `finish` recolours the handle, nodes and cap.
	 * @type {{ id: string, ink?: number, color?: string, splay?: number, shadow?: boolean, finish?: Finish }}
	 */
	let { id, ink = 0, color = '#16110d', splay = 0, shadow = true, finish = {} } = $props();

	const { invalidate } = useThrelte();

	const build = $derived({ ...(BUILDS[id] ?? BUILDS.center), ...finish });
	const DRY = new Color('#ebe0c8');
	const STEPS = 18;

	/** @param {string} color */
	const metal = (color) => (color === GOLD ? 0.8 : 0);

	/** The tuft's outline, tip to ferrule: a point that fills out to a belly and draws in again. */
	const hair = $derived.by(() => {
		const { radius, hair: length } = build;
		const points = [];
		for (let k = 0; k <= STEPS; k++) {
			const t = k / STEPS;
			const swell = Math.pow(Math.sin(Math.min(1, t / 0.62) * (Math.PI / 2)), 0.85);
			const taper = t > 0.62 ? 1 - (t - 0.62) * 0.5 : 1;
			points.push(new Vector2(Math.max(0.0008, radius * swell * taper), t * length));
		}
		const geometry = new LatheGeometry(points, 28);
		geometry.setAttribute('color', new BufferAttribute(new Float32Array(geometry.attributes.position.count * 3), 3));
		return geometry;
	});

	$effect(() => {
		const geometry = hair;
		return () => geometry.dispose();
	});

	/** Wet from the tip as far as it's soaked, fading into dry hair above. */
	$effect(() => {
		const position = hair.attributes.position;
		const colors = /** @type {BufferAttribute} */ (hair.attributes.color);
		const wet = new Color(color).multiplyScalar(0.55);
		const soaked = Math.min(0.98, 0.1 + Math.min(1, ink) * 0.8);
		const mixed = new Color();
		for (let v = 0; v < position.count; v++) {
			const t = position.getY(v) / build.hair;
			const dry = Math.min(1, Math.max(0, (t - soaked * 0.82) / 0.14));
			mixed.copy(wet).lerp(DRY, dry);
			colors.setXYZ(v, mixed.r, mixed.g, mixed.b);
		}
		colors.needsUpdate = true;
		invalidate();
	});

	const top = $derived(build.hair);
	const ferrule = 0.07;
	const handle = $derived(BRUSH_LENGTH - top - ferrule - 0.03);
	const rod = $derived(build.radius * 0.62);
</script>

<T.Group>
	<T.Mesh geometry={hair} scale={[1 + splay * 0.45, 1 - splay * 0.18, 1 + splay * 0.45]} castShadow={shadow}>
		<T.MeshStandardMaterial vertexColors roughness={0.75 - Math.min(1, ink) * 0.45} />
	</T.Mesh>

	<T.Mesh position.y={top + ferrule / 2} castShadow={shadow}>
		<T.CylinderGeometry args={[rod * 1.18, build.radius * 0.78, ferrule, 28]} />
		<T.MeshStandardMaterial color={build.cap} roughness={0.32} metalness={metal(build.cap) || 0.1} />
	</T.Mesh>

	<T.Mesh position.y={top + ferrule + handle / 2} castShadow={shadow}>
		<T.CylinderGeometry args={[rod, rod * 1.04, handle, 24]} />
		<T.MeshStandardMaterial color={build.handle} roughness={0.5} />
	</T.Mesh>

	{#each [0.34, 0.68] as at (at)}
		<T.Mesh position.y={top + ferrule + handle * at}>
			<T.CylinderGeometry args={[rod * 1.1, rod * 1.1, 0.012, 24]} />
			<T.MeshStandardMaterial color={build.node} roughness={0.45} metalness={metal(build.node)} />
		</T.Mesh>
	{/each}

	<T.Mesh position.y={top + ferrule + handle + 0.015}>
		<T.CylinderGeometry args={[rod * 0.9, rod * 1.05, 0.03, 24]} />
		<T.MeshStandardMaterial color={build.cap} roughness={0.32} metalness={metal(build.cap) || 0.1} />
	</T.Mesh>

	<T.Mesh position.y={BRUSH_LENGTH + rod * 0.9}>
		<T.TorusGeometry args={[rod * 1.1, rod * 0.18, 8, 24]} />
		<T.MeshStandardMaterial color="#9b2b1e" roughness={0.7} />
	</T.Mesh>
</T.Group>
