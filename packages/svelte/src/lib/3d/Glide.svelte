<script>
	import { T, useTask, useThrelte } from '@threlte/core';

	/**
	 * A group that springs to wherever it's put instead of jumping there. Its position, turn and
	 * size each follow a critically damped spring, so it sets off gently and settles without
	 * overshooting. The turn is applied yaw first, then pitch, then roll. It starts where it's
	 * first put.
	 * @type {{
	 *   position: [number, number, number],
	 *   rotation?: [number, number, number],
	 *   scale?: number,
	 *   stiffness?: number,
	 *   still?: boolean,
	 *   children: import('svelte').Snippet
	 * }}
	 */
	let { position, rotation = [0, 0, 0], scale = 1, stiffness = 110, still = false, children } = $props();

	const STEP = 1 / 120;

	const { invalidate } = useThrelte();

	/** @type {import('three').Group | undefined} */
	let group = $state();
	const speed = new Float64Array(7);
	const now = new Float64Array(7);

	/** @param {import('three').Group} ref */
	function place(ref) {
		ref.rotation.order = 'YXZ';
		ref.position.set(...position);
		ref.rotation.set(...rotation);
		ref.scale.setScalar(scale);
	}

	useTask(
		(delta) => {
			if (!group) return;
			const goal = [...position, ...rotation, scale];
			const { position: at, rotation: turn } = group;
			now.set([at.x, at.y, at.z, turn.x, turn.y, turn.z, group.scale.x]);
			let moving = false;
			for (let k = 0; k < 7; k++) {
				if (Math.abs(goal[k] - now[k]) > 1e-5 || Math.abs(speed[k]) > 1e-4) moving = true;
			}
			if (!moving) return;
			if (still) {
				now.set(goal);
				speed.fill(0);
			} else {
				const damping = 2 * Math.sqrt(stiffness);
				for (let left = Math.min(delta, 0.1); left > 0; left -= STEP) {
					const dt = Math.min(STEP, left);
					for (let k = 0; k < 7; k++) {
						speed[k] += (stiffness * (goal[k] - now[k]) - damping * speed[k]) * dt;
						now[k] += speed[k] * dt;
					}
				}
			}
			at.set(now[0], now[1], now[2]);
			turn.set(now[3], now[4], now[5]);
			group.scale.setScalar(now[6]);
			invalidate();
		},
		{ autoInvalidate: false }
	);
</script>

<T.Group bind:ref={group} oncreate={place}>
	{@render children()}
</T.Group>
