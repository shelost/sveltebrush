<script>
	import { T, useTask, useThrelte } from '@threlte/core';
	import Brush3D from './Brush3D.svelte';
	import { HELD_LENGTH, heldPose, placeHeld } from './held.js';

	/**
	 * The brush in your hand, standing in for the pointer wherever `over` says there's something
	 * to write on or dip into. Its tip is the pointer; it leans the way a held brush does, swings
	 * after the hand when it moves, and its hair spreads while it's pressed down. Goes inside a
	 * `BrushStage`; hide the system cursor over the same elements.
	 * @type {{ id: string, ink: number, color: string, still?: boolean, over: (target: Element) => boolean }}
	 */
	let { id, ink, color, still = false, over } = $props();

	const { size, invalidate } = useThrelte();

	let shown = $state(false);
	const at = { x: 0, y: 0, t: 0 };
	const velocity = { x: 0, y: 0 };
	let down = false;
	const now = heldPose('center', velocity);
	let splay = $state(0);
	let moved = false;
	/** @type {import('three').Group | undefined} */
	let hand = $state();

	/** @param {PointerEvent} event */
	function move(event) {
		const inside = event.target instanceof Element && over(event.target);
		if (inside !== shown) shown = inside;
		if (!inside) return;
		const dt = Math.max(8, event.timeStamp - at.t) / 1000;
		velocity.x = velocity.x * 0.6 + ((event.clientX - at.x) / dt) * 0.4;
		velocity.y = velocity.y * 0.6 + ((event.clientY - at.y) / dt) * 0.4;
		Object.assign(at, { x: event.clientX, y: event.clientY, t: event.timeStamp });
		moved = true;
	}

	/** @param {PointerEvent} event */
	function press(event) {
		move(event);
		down = true;
	}

	/** A finger leaves nothing to hover, so the brush goes with it. @param {PointerEvent} event */
	function release(event) {
		down = false;
		if (event.pointerType === 'touch') shown = false;
	}

	useTask(
		(delta) => {
			if (!hand || !shown) return;
			const dt = Math.min(delta, 0.064);
			const ease = still ? 1 : Math.min(1, dt * 12);
			const goal = { ...heldPose(id, velocity), splay: down ? 1 : 0 };
			const settling = Math.abs(goal.pitch - now.pitch) + Math.abs(goal.lean - now.lean) + Math.abs(goal.splay - splay) > 0.002;
			if (!settling && !moved) return;
			now.pitch += (goal.pitch - now.pitch) * ease;
			now.lean += (goal.lean - now.lean) * ease;
			splay += (goal.splay - splay) * ease;
			velocity.x *= Math.pow(0.02, dt);
			velocity.y *= Math.pow(0.02, dt);
			placeHeld(hand, at.x, at.y, size.current, now);
			moved = false;
			invalidate();
		},
		{ autoInvalidate: false }
	);
</script>

<svelte:window onpointermove={move} onpointerdown={press} onpointerup={release} onpointercancel={release} />

<T.Group bind:ref={hand} visible={shown} oncreate={(group) => void (group.rotation.order = 'ZXY')}>
	<T.Group scale={HELD_LENGTH}>
		<Brush3D {id} {ink} {color} {splay} shadow={false} />
	</T.Group>
</T.Group>
