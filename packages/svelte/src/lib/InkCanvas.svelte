<script module>
	/**
	 * @typedef {import('@sveltebrush/core').BrushPreset} BrushPreset
	 * @typedef {import('@sveltebrush/core').InkDocument} InkDocument
	 * @typedef {import('@sveltebrush/core').InkStroke} InkStroke
	 * @typedef {Omit<import('@sveltebrush/core').WriteOptions, 'width' | 'height'>} WriteOptions
	 * @typedef {Omit<NonNullable<Parameters<typeof import('@sveltebrush/core').renderVideo>[1]>, 'width' | 'height'>} VideoOptions
	 */
</script>

<script>
	import { untrack } from 'svelte';
	import {
		BRUSHES,
		Brush,
		Surface,
		Tape,
		createWriter,
		freehand,
		paintDocument,
		play as replay,
		renderVideo,
		sampleStroke
	} from '@sveltebrush/core';

	/**
	 * @type {{
	 *   brush?: Partial<BrushPreset>,
	 *   color?: string,
	 *   ink?: number,
	 *   history?: { undo: number, redo: number },
	 *   strokes?: number,
	 *   playing?: boolean,
	 *   infinite?: boolean,
	 *   timelapse?: boolean,
	 *   streamline?: number,
	 *   onstroke?: (stroke: InkStroke) => void,
	 *   onresize?: (size: { width: number, height: number }) => void,
	 *   class?: string
	 * }}
	 */
	let {
		brush = BRUSHES[0],
		color = '#16110d',
		ink = $bindable(1),
		history = $bindable({ undo: 0, redo: 0 }),
		strokes = $bindable(0),
		playing = $bindable(false),
		infinite = false,
		timelapse: recording = true,
		streamline = 0.35,
		onstroke,
		onresize,
		class: className = ''
	} = $props();

	/** @type {Surface | null} */
	let surface = null;
	/** @type {Brush | null} */
	let hand = null;
	/** @type {ReturnType<typeof createWriter> | null} */
	let writer = null;
	/** @type {Tape | null} */
	let tape = null;
	/** @type {ReturnType<typeof replay> | null} */
	let player = null;

	/**
	 * Start recording onto a tape: strokes, seals and history from here on.
	 * @param {Surface} sheet
	 * @param {Tape} next
	 */
	function attach(sheet, next) {
		next.width = sheet.width;
		next.height = sheet.height;
		next.onevent = (event) => {
			if (event.type !== 'stroke') return;
			strokes += 1;
			onstroke?.(event.stroke);
		};
		sheet.tape = next;
		tape = next;
		strokes = next.strokes;
	}

	/** @param {HTMLCanvasElement} node */
	function paper(node) {
		const sheet = new Surface(node, {
			onchange: () => (history = { undo: sheet.past.length, redo: sheet.future.length })
		});
		sheet.resize();
		const initial = untrack(() => ({ brush: { ...brush }, color, ink, infinite, recording, streamline }));
		const pen = new Brush(sheet, initial.brush, { color: initial.color });
		const scribe = createWriter(sheet, { color: initial.color });
		pen.dip(initial.ink);
		pen.onink = (level) => {
			if (Math.abs(level - ink) > 0.002) ink = level;
		};
		surface = sheet;
		hand = pen;
		writer = scribe;
		if (initial.recording) attach(sheet, new Tape());

		$effect(() => {
			pen.set({ ...brush });
			pen.color = color;
			scribe.brush.color = color;
		});

		const interrupt = () => stopPlayback();
		node.addEventListener('pointerdown', interrupt, { capture: true });
		const release = freehand(node, pen, { infinite: initial.infinite, streamline: initial.streamline });
		const observer = new ResizeObserver(() => {
			stopPlayback();
			sheet.resize();
			if (sheet.tape) {
				sheet.tape.width = sheet.width;
				sheet.tape.height = sheet.height;
			}
			if (sheet.width && sheet.height) onresize?.({ width: sheet.width, height: sheet.height });
		});
		observer.observe(node);
		return () => {
			observer.disconnect();
			node.removeEventListener('pointerdown', interrupt, { capture: true });
			stopPlayback();
			release();
			scribe.stop();
			pen.destroy();
			sheet.destroy();
			surface = hand = writer = tape = null;
		};
	}

	/**
	 * Animate text onto the paper with the current brush. Resolves true when finished.
	 * @param {string} text
	 * @param {WriteOptions} [options]
	 */
	export function write(text, options = {}) {
		if (!writer || !surface) return Promise.resolve(false);
		stopPlayback();
		return writer.write(text, {
			brush: { ...brush },
			...options,
			width: surface.width,
			height: surface.height
		});
	}

	export function stop() {
		writer?.stop();
	}

	export function clear() {
		writer?.stop();
		surface?.clear();
	}

	export function undo() {
		writer?.stop();
		surface?.undo();
	}

	export function redo() {
		surface?.redo();
	}

	/** Add ink to the hand brush. @param {number} amount */
	export function load(amount) {
		hand?.load(amount);
	}

	/** Set the hand brush's ink to an exact level. @param {number} level */
	export function dip(level) {
		hand?.dip(level);
	}

	/** Wipe and paint one sample stroke with the current brush (for drawing pads). */
	export function preview() {
		if (!surface) return;
		surface.wipe();
		sampleStroke(surface, { ...brush }, { color });
	}

	/**
	 * Everything on the sheet as a JSON-serialisable document, or null when not recording.
	 * @returns {InkDocument | null}
	 */
	export function save() {
		if (!tape || !surface) return null;
		return structuredClone({ ...tape.toJSON(), width: surface.width, height: surface.height });
	}

	/**
	 * Replace the sheet with a saved document and keep recording on top of it.
	 * @param {InkDocument} document
	 */
	export function open(document) {
		if (!surface) return;
		stopPlayback();
		writer?.stop();
		const next = Tape.from(document);
		const sheet = surface;
		const recorder = sheet.tape;
		sheet.tape = null;
		sheet.wipe();
		sheet.forget();
		paintDocument(next, sheet);
		if (recorder) attach(sheet, next);
	}

	/**
	 * Replay everything painted so far on this canvas, then show the real sheet again.
	 * Touching the canvas stops playback. Resolves true if it played to the end.
	 * @param {{ duration?: number }} [options] duration: target length in ms
	 */
	export function play(options = {}) {
		const canvas = surface?.canvas;
		if (!surface || !tape?.strokes || !canvas) return Promise.resolve(false);
		stopPlayback();
		writer?.stop();
		const sheet = surface;
		const stage = new Surface(canvas, { dpr: sheet.dpr });
		stage.resize(sheet.width, sheet.height);
		const current = replay(tape, stage, options);
		player = current;
		playing = true;
		return current.done.then((finished) => {
			stage.destroy();
			if (player === current) player = null;
			playing = false;
			sheet.render();
			return finished;
		});
	}

	export function stopPlayback() {
		player?.stop();
	}

	/**
	 * Render the timelapse to a video file (MP4 where the browser supports it, else WebM).
	 * @param {VideoOptions} [options]
	 */
	export function timelapse(options = {}) {
		if (!surface || !tape?.strokes) return Promise.resolve(null);
		return renderVideo(tape, { ...options, width: surface.width, height: surface.height });
	}

	/** @param {{ background?: string, type?: string }} [options] */
	export function toBlob(options) {
		return surface ? surface.toBlob(options) : Promise.resolve(null);
	}
</script>

<canvas class={['ink-canvas', className]} {@attach paper}></canvas>

<style>
	.ink-canvas {
		display: block;
		width: 100%;
		height: 100%;
		touch-action: none;
		cursor: crosshair;
		user-select: none;
		-webkit-user-select: none;
		-webkit-touch-callout: none;
	}
</style>
