<script>
	import { T, useTask, useThrelte } from '@threlte/core';
	import Brush3D, { RED_LACQUER } from './Brush3D.svelte';
	import { HELD_LENGTH, heldPose, placeHeld } from './held.js';

	/**
	 * Another hand's brush, in red lacquer, that writes whatever the auto-writer writes. It flies
	 * in when writing starts, follows the writer's tip down each stroke, lifts and glides to the
	 * next one, and flies off when it's done. `source` reports the tip in viewport px every frame,
	 * e.g. `() => canvas?.scribe()`; pass `lead` to `write` so it can arrive before the first
	 * stroke. Goes inside a `BrushStage`.
	 * @type {{
	 *   source: () => import('@sveltebrush/core').WriterTip | null | undefined,
	 *   id?: string,
	 *   color?: string,
	 *   finish?: import('./Brush3D.svelte').Finish,
	 *   still?: boolean
	 * }}
	 */
	let { source, id = 'center', color = '#16110d', finish = RED_LACQUER, still = false } = $props();

	/** How far the tip rises off the paper between strokes, in px. */
	const LIFT = 26;

	const { size, invalidate } = useThrelte();

	let shown = $state(false);
	let splay = $state(0);
	const at = { x: 0, y: 0, lift: LIFT };
	const velocity = { x: 0, y: 0 };
	const now = heldPose('center', velocity);
	/** @type {import('three').Group | undefined} */
	let hand = $state();

	/** Off the top right corner, where it comes from and goes back to. */
	const offstage = () => ({ x: size.current.width + 180, y: -220 });

	useTask(
		(delta) => {
			if (!hand) return;
			const tip = source();
			const writing = !!tip?.writing;
			if (!writing && !shown) return;
			const dt = Math.max(1e-3, Math.min(delta, 0.064));
			if (writing && !shown) {
				Object.assign(at, offstage(), { lift: LIFT });
				shown = true;
			}

			const goal =
				writing && tip
					? { x: tip.x, y: tip.y, lift: tip.down ? 0 : LIFT, splay: tip.down ? Math.min(1, 0.3 + tip.pressure * 0.6) : 0 }
					: { ...offstage(), lift: LIFT, splay: 0 };
			const rate = tip?.down ? 60 : writing ? 16 : 5;
			const follow = still ? 1 : 1 - Math.exp(-dt * rate);
			const settle = still ? 1 : Math.min(1, dt * 14);

			const x = at.x + (goal.x - at.x) * follow;
			const y = at.y + (goal.y - at.y) * follow;
			velocity.x = velocity.x * 0.6 + ((x - at.x) / dt) * 0.4;
			velocity.y = velocity.y * 0.6 + ((y - at.y) / dt) * 0.4;
			at.x = x;
			at.y = y;
			at.lift += (goal.lift - at.lift) * settle;
			splay += (goal.splay - splay) * settle;

			const pose = heldPose(id, velocity);
			now.pitch += (pose.pitch - now.pitch) * settle;
			now.lean += (pose.lean - now.lean) * settle;
			placeHeld(hand, at.x, at.y - at.lift, size.current, now);
			if (!writing && Math.hypot(goal.x - at.x, goal.y - at.y) < 40) shown = false;
			invalidate();
		},
		{ autoInvalidate: false }
	);
</script>

<T.Group bind:ref={hand} visible={shown} oncreate={(group) => void (group.rotation.order = 'ZXY')}>
	<T.Group scale={HELD_LENGTH}>
		<Brush3D {id} ink={1} {color} {splay} {finish} shadow={false} />
	</T.Group>
</T.Group>
