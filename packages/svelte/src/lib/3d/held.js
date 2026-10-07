/** How long a held brush is on screen, tip to cord, in px. */
export const HELD_LENGTH = 150;

/** How a brush is held: handle towards you, leaning right, or flatter for a side-tip brush. */
const HELD = { pitch: 0.55, lean: -0.42, side: -0.78 };

/** @param {number} v */
const swing = (v) => Math.max(-0.4, Math.min(0.4, v));

/**
 * The pose a hand holds brush `id` in while moving at `velocity` px/s: it swings after the hand.
 * @param {string} id
 * @param {{ x: number, y: number }} velocity
 */
export const heldPose = (id, velocity) => ({
	pitch: HELD.pitch + swing(velocity.y * 0.0003),
	lean: (id === 'side' ? HELD.side : HELD.lean) + swing(-velocity.x * 0.00035)
});

/**
 * Put a held brush's tip at viewport px (x, y) on a `BrushStage`, whose camera is centred.
 * @param {import('three').Group} group
 * @param {number} x
 * @param {number} y
 * @param {{ width: number, height: number }} size the stage's size
 * @param {{ pitch: number, lean: number }} pose
 */
export function placeHeld(group, x, y, size, pose) {
	group.position.set(x - size.width / 2, size.height / 2 - y, 0);
	group.rotation.set(pose.pitch, 0, pose.lean);
}
