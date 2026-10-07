import { createInput } from './input.js';

/**
 * Pointer input → brush on a canvas element. Every coalesced pointer sample is
 * used, so fast strokes keep their shape, and each passes through `createInput`
 * for streamlining and pressure.
 * @param {HTMLCanvasElement} canvas
 * @param {import('./brush.js').Brush} brush
 * @param {{ infinite?: boolean, streamline?: number }} [options] infinite: refill on every stroke (for preview pads)
 * @returns {() => void} cleanup
 */
export function freehand(canvas, brush, { infinite = false, streamline = 0.35 } = {}) {
	let pointer = -1;
	/** @type {import('./input.js').Input | null} */
	let input = null;

	/** @param {PointerEvent} e */
	function down(e) {
		if (pointer !== -1 || e.button > 0) return;
		pointer = e.pointerId;
		canvas.setPointerCapture(pointer);
		input = createInput({ pen: e.pointerType === 'pen', streamline });
		if (infinite) brush.dip(1);
		const rect = canvas.getBoundingClientRect();
		const point = input.push(e.clientX - rect.left, e.clientY - rect.top, { pressure: e.pressure, time: e.timeStamp });
		if (point) brush.down(point[0], point[1], point[2]);
	}

	/** @param {PointerEvent} e */
	function move(e) {
		if (e.pointerId !== pointer || !input) return;
		const rect = canvas.getBoundingClientRect();
		const events = e.getCoalescedEvents?.() ?? [];
		for (const event of events.length ? events : [e]) {
			const point = input.push(event.clientX - rect.left, event.clientY - rect.top, {
				pressure: event.pressure,
				time: event.timeStamp
			});
			if (point) brush.to(point[0], point[1], point[2]);
		}
	}

	/** @param {PointerEvent} e */
	function up(e) {
		if (e.pointerId !== pointer || !input) return;
		pointer = -1;
		for (const point of input.end(brush.size)) brush.to(point[0], point[1], point[2]);
		input = null;
		brush.up();
	}

	canvas.addEventListener('pointerdown', down);
	canvas.addEventListener('pointermove', move);
	canvas.addEventListener('pointerup', up);
	canvas.addEventListener('pointercancel', up);
	return () => {
		canvas.removeEventListener('pointerdown', down);
		canvas.removeEventListener('pointermove', move);
		canvas.removeEventListener('pointerup', up);
		canvas.removeEventListener('pointercancel', up);
	};
}
