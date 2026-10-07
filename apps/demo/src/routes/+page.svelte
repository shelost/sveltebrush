<script module>
	/** @typedef {'library' | 'studio' | 'write' | 'color' | 'paper' | 'export'} Panel */
</script>

<script>
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';
	import { prefersReducedMotion } from 'svelte/motion';
	import {
		BRUSHES,
		INKS,
		PAPERS,
		BrushLibrary,
		BrushStudio,
		ColorWheel,
		InkCanvas,
		Inkstone,
		Slider,
		paperClass,
		preset,
		videoType
	} from 'sveltebrush';
	import 'sveltebrush/paper.css';

	const PHRASES = ['永', '風林火山', '바람이 분다', '一期一會\n한 번의 만남', '龍', '사랑해'];
	const GITHUB = 'https://github.com/shelost/sveltebrush';
	/** How long the writer waits for the red brush to fly in before its first stroke, in ms. */
	const ARRIVAL = 650;

	const GEAR =
		'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z';
	const OCTOCAT =
		'M12 .5C5.65.5.5 5.65.5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.56v-2c-3.2.7-3.87-1.37-3.87-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.42-2.7 5.4-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z';

	/** Stroke icons on a 24px grid. */
	const ICONS = {
		write: ['M5 7V5h14v2', 'M12 5v14', 'M9 19h6'],
		brush: ['M14.5 3.5 20.5 9.5 11 19c-1.6 1.6-4.4 1.8-6.5 1.5.4-1.6.2-3 1.2-4.5L14.5 3.5Z', 'm12.5 5.5 6 6'],
		export: ['M12 15V4', 'm8 8 4-4 4 4', 'M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5'],
		play: ['M8 5.5v13l10.5-6.5L8 5.5Z'],
		clear: ['M5 7h14M10 7V5h4v2m-7 0 1 12h8l1-12'],
		hide: [
			'M3 3l18 18',
			'M10.6 10.6a2 2 0 0 0 2.8 2.8',
			'M9.9 5.1A9.8 9.8 0 0 1 12 5c5 0 9 4.5 10 7a13 13 0 0 1-3 4.1',
			'M6.1 6.1C3.9 7.6 2.5 9.8 2 12c1 2.5 5 7 10 7a9.7 9.7 0 0 0 4.9-1.3'
		],
		show: ['M2 12c1-2.5 5-7 10-7s9 4.5 10 7c-1 2.5-5 7-10 7S3 14.5 2 12Z', 'M9 12a3 3 0 1 0 6 0a3 3 0 1 0-6 0'],
		settings: ['M9 12a3 3 0 1 0 6 0a3 3 0 1 0-6 0', GEAR],
		size: ['M4.5 16a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0', 'M10.5 9a5 5 0 1 0 10 0a5 5 0 1 0-10 0'],
		water: ['M12 3.5c3 3.6 6 7 6 10.2a6 6 0 0 1-12 0c0-3.2 3-6.6 6-10.2Z'],
		undo: ['M9 14 4 9l5-5', 'M4 9h10a6 6 0 0 1 0 12h-3'],
		redo: ['m15 14 5-5-5-5', 'M20 9H10a6 6 0 0 0 0 12h3'],
		image: [
			'M6 4h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z',
			'm4 16 4.5-4.5 3 3L15 11l5 5',
			'M14 8.5a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0'
		],
		film: [
			'M5 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z',
			'M7 5v14M17 5v14M3 9.5h4M3 14.5h4M17 9.5h4M17 14.5h4'
		],
		save: ['M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z', 'M14 3v5h5', 'M12 11v6', 'm9.5 14.5 2.5 2.5 2.5-2.5'],
		open: ['M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z', 'M3 10h18'],
		paper: ['M8 3.5h11v14H8z', 'M5 7v13.5h11'],
		cube: ['M12 3 20 7.5v9L12 21l-8-4.5v-9L12 3Z', 'M4 7.5 12 12l8-4.5', 'M12 12v9'],
		github: [OCTOCAT]
	};
	const FILLED = ['play', 'github'];

	let brushes = $state(structuredClone(BRUSHES));
	let selected = $state(BRUSHES[0].id);
	const index = $derived(
		Math.max(
			0,
			brushes.findIndex((brush) => brush.id === selected)
		)
	);
	let color = $state(INKS[0].color);
	let paper = $state(PAPERS[0].id);
	const tone = $derived(PAPERS.find((entry) => entry.id === paper)?.color ?? PAPERS[0].color);

	/** The 3D brushes and inkstone, loaded with three.js only once they're turned on. */
	let three = $state(false);
	const kit = $derived(three ? import('sveltebrush/3d') : null);
	/** Where the brush in your hand stands in for the pointer. @param {Element} node */
	const writable = (node) => !!node.closest('.ink-canvas, .sb-ink-tray');

	let ink = $state(1);
	let history = $state({ undo: 0, redo: 0 });
	let strokes = $state(0);
	let playing = $state(false);
	/** @type {Panel | null} */
	let panel = $state(null);
	/** @type {ReturnType<typeof InkCanvas> | undefined} */
	let canvas = $state();

	let ready = $state(false);
	let hidden = $state(false);
	let theater = $state(false);
	const chrome = $derived(ready && !hidden && !theater);

	/** @type {number | null} */
	let exporting = $state(null);
	let video = $state('');
	let unreadable = $state(false);

	let text = $state('永');
	let vertical = $state(false);
	let speed = $state(1);
	let weight = $state(1);
	let writing = $state(false);
	let sheet = $state(0);

	/** @param {Panel} name */
	const toggle = (name) => (panel = panel === name ? null : name);

	/**
	 * Panels drift in from the side they live on.
	 * @param {Element} node
	 * @param {{ x?: number, y?: number, delay?: number, duration?: number }} [params]
	 */
	function float(node, { x = 0, y = 0, delay = 0, duration = 640 } = {}) {
		return {
			delay,
			duration,
			easing: quintOut,
			css: (/** @type {number} */ t, /** @type {number} */ u) =>
				`opacity: ${t}; transform: translate(${u * x}px, ${u * y}px) scale(${0.97 + 0.03 * t});`
		};
	}

	function reset() {
		brushes[index] = preset(selected);
	}

	async function write() {
		if (!canvas) return;
		writing = true;
		const narrow = matchMedia('(max-width: 720px)').matches;
		const floor = panel === 'write' ? sheet + 32 : narrow ? 120 : 48;
		const finished = await canvas.write(text, {
			vertical,
			speed,
			weight,
			lead: three ? ARRIVAL : 0,
			padding: narrow ? { top: 80, right: 20, bottom: floor, left: 60 } : { top: 84, right: 160, bottom: floor, left: 84 }
		});
		if (finished) writing = false;
	}

	/** @param {string} phrase */
	function choose(phrase) {
		text = phrase;
		write();
	}

	/** @param {Blob} blob @param {string} name */
	function download(blob, name) {
		const link = document.createElement('a');
		link.href = URL.createObjectURL(blob);
		link.download = name;
		link.click();
		setTimeout(() => URL.revokeObjectURL(link.href), 1000);
	}

	async function saveImage() {
		const blob = await canvas?.toBlob({ background: tone });
		if (blob) download(blob, 'sveltebrush.png');
		panel = null;
	}

	async function saveTimelapse() {
		if (!canvas || exporting !== null) return;
		exporting = 0;
		try {
			const result = await canvas.timelapse({ background: tone, onprogress: (p) => (exporting = p) });
			if (result) download(result.blob, `sveltebrush-timelapse.${result.extension}`);
		} finally {
			exporting = null;
		}
	}

	function saveProject() {
		const project = canvas?.save();
		if (!project) return;
		download(new Blob([JSON.stringify(project)], { type: 'application/json' }), 'sveltebrush.json');
		panel = null;
	}

	/** @param {Event & { currentTarget: HTMLInputElement }} e */
	async function openProject(e) {
		const input = e.currentTarget;
		const file = input.files?.[0];
		input.value = '';
		if (!file || !canvas) return;
		try {
			canvas.open(JSON.parse(await file.text()));
			unreadable = false;
			panel = null;
		} catch {
			unreadable = true;
		}
	}

	async function playback() {
		if (!canvas || !strokes) return;
		panel = null;
		theater = true;
		await canvas.play();
	}

	function onstage() {
		theater = false;
		if (panel !== 'write') panel = null;
	}

	/** @param {KeyboardEvent} e */
	function onkeydown(e) {
		const target = /** @type {HTMLElement} */ (e.target);
		if (target.closest('textarea, input')) {
			if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
				e.preventDefault();
				write();
			}
			return;
		}
		const mod = e.metaKey || e.ctrlKey;
		if (mod && e.key.toLowerCase() === 'z') {
			e.preventDefault();
			if (e.shiftKey) canvas?.redo();
			else canvas?.undo();
		} else if (mod && e.key.toLowerCase() === 's') {
			e.preventDefault();
			saveProject();
		} else if (e.key === '[' || e.key === ']') {
			const size = brushes[index].size + (e.key === ']' ? 4 : -4);
			brushes[index].size = Math.min(140, Math.max(4, size));
		} else if (e.key === 'Escape') {
			if (theater) {
				canvas?.stopPlayback();
				theater = false;
			}
			panel = null;
		}
	}

	onMount(() => {
		ready = true;
		video = videoType();
		write();
	});
</script>

<svelte:head>
	<title>Sveltebrush</title>
	<meta name="description" content="Ink-brush painting and animated East Asian calligraphy for the HTML canvas, made with Svelte." />
</svelte:head>

<svelte:window {onkeydown} />

{#snippet icon(/** @type {keyof typeof ICONS} */ name)}
	<svg viewBox="0 0 24 24" aria-hidden="true" class={{ filled: FILLED.includes(name) }}>
		{#each ICONS[name] as d (d)}
			<path {d} />
		{/each}
	</svg>
{/snippet}

<section class={['paper', paperClass(paper), 'sb-ui', { theater, three }]}>
	<div class="stage" role="presentation" onpointerdown={onstage}>
		<InkCanvas bind:this={canvas} bind:ink bind:history bind:strokes bind:playing brush={brushes[index]} {color} />
	</div>

	{#if chrome}
		<header class="title" in:float={{ x: -20, y: -12 }} out:float={{ x: -20, y: -12, duration: 260 }}>
			<h1>Sveltebrush</h1>
			<p>Ink brush &amp; calligraphy</p>
		</header>

		<div class="corner" in:float={{ y: -20, delay: 60 }} out:float={{ y: -20, duration: 260 }}>
			<nav class="tools glass" aria-label="Tools">
				<button type="button" class={{ on: panel === 'write' }} aria-label="Write text" title="Write text" onclick={() => toggle('write')}>
					{@render icon('write')}
				</button>
				<button
					type="button"
					class={{ on: panel === 'library' }}
					aria-label="Brush library"
					title="Brush library"
					onclick={() => toggle('library')}
				>
					{@render icon('brush')}
				</button>
				<button type="button" class={{ on: panel === 'color' }} aria-label="Ink colour" title="Ink colour" onclick={() => toggle('color')}>
					<span class="swatch" style:background={color}></span>
				</button>
				<button type="button" class={{ on: panel === 'paper' }} aria-label="Paper" title="Paper" onclick={() => toggle('paper')}>
					{@render icon('paper')}
				</button>
				<button
					type="button"
					class={{ on: three }}
					aria-label="3D brushes"
					aria-pressed={three}
					title={three ? '3D brushes on' : '3D brushes'}
					onclick={() => (three = !three)}
				>
					{@render icon('cube')}
				</button>
				<button type="button" class={{ on: panel === 'export' }} aria-label="Export" title="Export" onclick={() => toggle('export')}>
					{@render icon('export')}
				</button>
				<button type="button" aria-label="Play timelapse" title="Play timelapse" disabled={!strokes} onclick={playback}>
					{@render icon('play')}
				</button>
				<button type="button" aria-label="Clear paper" title="Clear paper" onclick={() => canvas?.clear()}>
					{@render icon('clear')}
				</button>
				<button
					type="button"
					aria-label="Hide interface"
					title="Hide interface"
					onclick={() => {
						panel = null;
						hidden = true;
					}}
				>
					{@render icon('hide')}
				</button>
			</nav>
			<a class="github glass" href={GITHUB} target="_blank" rel="noopener noreferrer" aria-label="GitHub" title="GitHub">
				{@render icon('github')}
			</a>
		</div>

		<aside class="sidebar" aria-label="Brush size and water" in:float={{ x: -28, delay: 120 }} out:float={{ x: -28, duration: 260 }}>
			<div class="control">
				<Slider bind:value={brushes[index].size} min={4} max={140} step={1} label="Size" orientation="vertical" />
				<span class="legend" title="Brush size">{@render icon('size')}</span>
			</div>
			<div class="control">
				<Slider
					bind:value={brushes[index].water}
					min={0}
					max={1}
					step={0.01}
					label="Water"
					orientation="vertical"
					format={(v) => `Water ${Math.round(v * 100)}%`}
				/>
				<span class="legend" title="Water">{@render icon('water')}</span>
			</div>
			<div class="history glass">
				<button type="button" aria-label="Undo" title="Undo" disabled={!history.undo} onclick={() => canvas?.undo()}>
					{@render icon('undo')}
				</button>
				<button type="button" aria-label="Redo" title="Redo" disabled={!history.redo} onclick={() => canvas?.redo()}>
					{@render icon('redo')}
				</button>
			</div>
		</aside>

		<button
			type="button"
			class={['settings', 'glass', { on: panel === 'studio' }]}
			aria-label="Brush settings"
			title="Brush settings"
			onclick={() => toggle('studio')}
			in:float={{ x: -24, y: 16, delay: 180 }}
			out:float={{ x: -24, y: 16, duration: 260 }}
		>
			{@render icon('settings')}
		</button>

		<aside class="well" aria-label="Ink" in:float={{ x: 32, delay: 160 }} out:float={{ x: 32, duration: 260 }}>
			{#if kit}
				{#await kit then { InkTray }}
					<div class="tray glass">
						<InkTray
							{brushes}
							bind:selected
							bind:color
							{ink}
							still={prefersReducedMotion.current}
							onload={(amount) => canvas?.load(amount)}
							ondip={() => canvas?.dip(1)}
						/>
						<p class="readout" aria-live="polite"><strong>{Math.round(ink * 100)}%</strong> {brushes[index].name}</p>
					</div>
				{/await}
			{:else}
				<Inkstone level={ink} {color} onload={(amount) => canvas?.load(amount)} onset={(level) => canvas?.dip(level)} />
			{/if}
		</aside>

		{#if panel === 'library'}
			<div class="popover library glass" in:float={{ y: -12, duration: 420 }} out:float={{ y: -12, duration: 200 }}>
				<BrushLibrary {brushes} bind:selected onedit={() => (panel = 'studio')} />
			</div>
		{:else if panel === 'color'}
			<div class="popover color glass" in:float={{ y: -12, duration: 420 }} out:float={{ y: -12, duration: 200 }}>
				<h2>Ink colour</h2>
				<ColorWheel bind:value={color} />
			</div>
		{:else if panel === 'paper'}
			<div class="popover papers glass" in:float={{ y: -12, duration: 420 }} out:float={{ y: -12, duration: 200 }}>
				<h2 id="paper-heading">Paper</h2>
				<div role="radiogroup" aria-labelledby="paper-heading">
					{#each PAPERS as entry (entry.id)}
						<button
							type="button"
							role="radio"
							aria-checked={paper === entry.id}
							class={{ on: paper === entry.id }}
							onclick={() => (paper = entry.id)}
						>
							<span class={['sample', paperClass(entry.id)]}></span>
							<span class="name">{entry.name} <small>{entry.native}</small></span>
							<small class="about">{entry.description}</small>
						</button>
					{/each}
				</div>
			</div>
		{:else if panel === 'export'}
			<div class="popover export glass" role="menu" in:float={{ y: -12, duration: 420 }} out:float={{ y: -12, duration: 200 }}>
				<button type="button" role="menuitem" onclick={saveImage}>
					{@render icon('image')}
					<span>Download</span>
					<small>PNG</small>
				</button>
				<button type="button" role="menuitem" disabled={!strokes || !video || exporting !== null} onclick={saveTimelapse}>
					{@render icon('film')}
					<span>Timelapse (MP4)</span>
					<small>
						{#if exporting !== null}
							Rendering {Math.round(exporting * 100)}%
						{:else if !video}
							Not supported
						{:else if !video.includes('mp4')}
							WebM here
						{:else}
							Video
						{/if}
					</small>
					{#if exporting !== null}
						<i class="progress" style:--progress={exporting}></i>
					{/if}
				</button>
				<hr />
				<button type="button" role="menuitem" disabled={!strokes} onclick={saveProject}>
					{@render icon('save')}
					<span>Save project</span>
					<small>JSON</small>
				</button>
				<label>
					<input class="file" type="file" accept=".json,application/json" onchange={openProject} />
					{@render icon('open')}
					<span>Open project</span>
					<small>{unreadable ? 'Not a project' : 'JSON'}</small>
				</label>
			</div>
		{:else if panel === 'studio'}
			<div class="popover studio glass" in:float={{ x: -24, y: 24, duration: 520 }} out:float={{ x: -24, y: 24, duration: 220 }}>
				<BrushStudio bind:brush={brushes[index]} onreset={reset} onclose={() => (panel = null)} />
			</div>
		{:else if panel === 'write'}
			<form
				class="popover write liquid"
				bind:clientHeight={sheet}
				in:float={{ y: 56, duration: 720 }}
				out:float={{ y: 40, duration: 260 }}
				onsubmit={(e) => {
					e.preventDefault();
					write();
				}}
			>
				<div class="phrases">
					{#each PHRASES as phrase (phrase)}
						<button type="button" class="chip" onclick={() => choose(phrase)}>{phrase.replace('\n', ' · ')}</button>
					{/each}
				</div>
				<div class="compose">
					<textarea
						bind:value={text}
						rows="2"
						spellcheck="false"
						aria-label="Text to write"
						placeholder="Type Chinese characters or Hangul, e.g. 永 or 바람"></textarea>
					<button type="submit" class="primary">{writing ? 'Rewrite' : 'Write'}</button>
				</div>
				<div class="options">
					<Slider bind:value={speed} min={0.3} max={3} step={0.1} label="Speed" format={(v) => `${v.toFixed(1)}×`} />
					<Slider bind:value={weight} min={0.5} max={1.8} step={0.05} label="Weight" format={(v) => `${v.toFixed(2)}×`} />
					<label class="toggle"><input type="checkbox" bind:checked={vertical} /> Vertical</label>
				</div>
			</form>
		{/if}
	{:else if ready && hidden && !theater}
		<button
			type="button"
			class="reveal glass"
			aria-label="Show interface"
			title="Show interface"
			onclick={() => (hidden = false)}
			in:float={{ y: -16, delay: 200 }}
			out:float={{ y: -16, duration: 200 }}
		>
			{@render icon('show')}
		</button>
	{/if}

	{#if theater}
		<p class="hint glass" in:fade={{ delay: 400, duration: 400 }} out:fade={{ duration: 200 }}>
			{playing ? 'Timelapse' : 'Finished'} · Touch the canvas to return
		</p>
	{/if}

	{#if kit}
		{#await kit then { BrushStage, BrushCursor, ScribeBrush }}
			<BrushStage>
				<BrushCursor id={selected} {ink} {color} still={prefersReducedMotion.current} over={writable} />
				<ScribeBrush source={() => canvas?.scribe()} id={selected} {color} still={prefersReducedMotion.current} />
			</BrushStage>
		{/await}
	{/if}
</section>

<style>
	:global(html, body) {
		margin: 0;
		background: #f1e8d6;
	}

	.paper {
		position: fixed;
		inset: 0;
		z-index: 1;
		height: 100dvh;
		overflow: hidden;
		overscroll-behavior: none;
		touch-action: none;
		font-family: Inter, system-ui, sans-serif;
		color: #2a221b;
		-webkit-tap-highlight-color: transparent;
	}

	.stage {
		position: absolute;
		inset: 0;
		mix-blend-mode: multiply;
	}

	button {
		margin: 0;
		box-shadow: none;
		font: inherit;
		color: inherit;

		&:hover {
			opacity: 1;
		}
	}

	svg {
		width: 20px;
		height: 20px;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.6;
		stroke-linecap: round;
		stroke-linejoin: round;

		&.filled {
			fill: currentColor;
			stroke: none;
		}
	}

	.glass {
		background: linear-gradient(140deg, rgb(255 255 255 / 0.62), rgb(255 250 240 / 0.34));
		backdrop-filter: blur(22px) saturate(1.5);
		-webkit-backdrop-filter: blur(22px) saturate(1.5);
		border: 1px solid rgb(255 255 255 / 0.6);
		box-shadow:
			inset 0 1px 0 rgb(255 255 255 / 0.8),
			0 0 0 0.5px rgb(30 24 19 / 0.08),
			0 18px 40px -14px rgb(60 40 20 / 0.28);
	}

	.title {
		position: absolute;
		top: max(18px, env(safe-area-inset-top));
		left: max(20px, env(safe-area-inset-left));
		pointer-events: none;

		h1 {
			margin: 0;
			font-size: 1.05rem;
			font-weight: 650;
			letter-spacing: -0.01em;
		}

		p {
			margin: 2px 0 0;
			font-size: 0.72rem;
			opacity: 0.5;
		}
	}

	.corner {
		position: absolute;
		top: max(14px, env(safe-area-inset-top));
		right: max(16px, env(safe-area-inset-right));
		display: flex;
		gap: 8px;
	}

	.tools {
		display: flex;
		gap: 2px;
		padding: 4px;
		border-radius: 16px;
	}

	.tools button,
	.github,
	.settings,
	.reveal {
		display: grid;
		place-items: center;
		width: 40px;
		height: 40px;
		padding: 0;
		border: none;
		border-radius: 12px;
		background: transparent;
		color: inherit;
		cursor: pointer;
		transition:
			background 0.2s ease,
			color 0.2s ease,
			scale 0.15s ease;

		&:active {
			scale: 0.94;
		}

		&:disabled {
			opacity: 0.3;
			cursor: default;
		}

		&.on {
			background: #1e1813;
			color: #f4ecdd;
		}
	}

	.tools button:not(.on, :disabled):hover {
		background: rgb(30 24 19 / 0.06);
	}

	.github,
	.settings,
	.reveal {
		width: 48px;
		height: 48px;
		border-radius: 16px;
	}

	.swatch {
		width: 20px;
		height: 20px;
		border-radius: 50%;
		box-shadow:
			0 0 0 2px #fbf8f2,
			0 0 0 3px rgb(30 24 19 / 0.25);
	}

	.sidebar {
		position: absolute;
		left: max(14px, env(safe-area-inset-left));
		top: 50%;
		translate: 0 -50%;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 14px;
		height: min(64dvh, 540px);
	}

	.control {
		display: flex;
		flex: 1;
		min-height: 0;
		flex-direction: column;
		align-items: center;
		gap: 6px;

		:global(.slider.vertical) {
			flex: 1;
			min-height: 0;
		}
	}

	.legend {
		display: grid;
		place-items: center;
		opacity: 0.5;

		svg {
			width: 16px;
			height: 16px;
		}
	}

	.history {
		display: grid;
		gap: 2px;
		padding: 3px;
		border-radius: 12px;

		button {
			display: grid;
			place-items: center;
			width: 30px;
			height: 30px;
			padding: 0;
			border: none;
			border-radius: 8px;
			background: transparent;
			cursor: pointer;

			&:disabled {
				opacity: 0.3;
				cursor: default;
			}

			svg {
				width: 16px;
				height: 16px;
			}
		}
	}

	.settings {
		position: absolute;
		left: max(16px, env(safe-area-inset-left));
		bottom: max(18px, env(safe-area-inset-bottom));
	}

	.reveal {
		position: absolute;
		top: max(14px, env(safe-area-inset-top));
		right: max(16px, env(safe-area-inset-right));
		opacity: 0.55;

		&:hover {
			opacity: 1;
		}
	}

	.well {
		position: absolute;
		right: max(18px, env(safe-area-inset-right));
		bottom: max(18px, env(safe-area-inset-bottom));
	}

	.popover {
		position: absolute;
		z-index: 2;
		padding: 14px;
		border-radius: 20px;
		overflow: auto;
		overscroll-behavior: contain;
		touch-action: pan-y;

		h2 {
			margin: 0 0 12px;
			font-size: 0.95rem;
			font-weight: 600;
		}
	}

	.library,
	.color,
	.papers,
	.export {
		top: calc(max(14px, env(safe-area-inset-top)) + 60px);
		right: max(16px, env(safe-area-inset-right));
		transform-origin: top right;
	}

	.papers {
		width: 300px;

		[role='radiogroup'] {
			display: grid;
			gap: 4px;
		}

		button {
			display: grid;
			grid-template-columns: 44px 1fr;
			grid-template-rows: auto auto;
			column-gap: 12px;
			align-items: center;
			padding: 8px;
			border: none;
			border-radius: 14px;
			background: transparent;
			text-align: left;
			cursor: pointer;

			&:hover {
				background: rgb(30 24 19 / 0.06);
			}

			&.on {
				background: rgb(30 24 19 / 0.1);
			}
		}

		.sample {
			grid-row: 1 / 3;
			width: 44px;
			height: 44px;
			border-radius: 10px;
			box-shadow: inset 0 0 0 1px rgb(30 24 19 / 0.12);
		}

		.name {
			font-size: 0.88rem;
			font-weight: 500;

			small {
				margin-left: 4px;
				font-family: 'Gowun Batang', serif;
				font-weight: 400;
				opacity: 0.55;
			}
		}

		.about {
			font-size: 0.72rem;
			opacity: 0.55;
		}
	}

	/* The 3D brush in your hand is the pointer over the paper and the inkstone. */
	.three:not(.theater) :global(.ink-canvas),
	.three :global(.sb-ink-tray canvas) {
		cursor: none;
	}

	.tray {
		display: grid;
		width: 300px;
		padding: 4px 4px 8px;
		border-radius: 20px;

		:global(.sb-ink-tray) {
			height: 158px;
		}
	}

	.readout {
		margin: 0;
		font-size: 0.72rem;
		text-align: center;
		opacity: 0.65;

		strong {
			font-variant-numeric: tabular-nums;
			font-weight: 600;
		}
	}

	.library {
		width: 340px;
	}

	.color {
		width: 280px;
	}

	.export {
		display: grid;
		gap: 2px;
		width: 260px;
		padding: 6px;

		hr {
			width: calc(100% - 24px);
			margin: 4px auto;
			border: none;
			border-top: 1px solid rgb(30 24 19 / 0.1);
		}

		button,
		label {
			position: relative;
			display: grid;
			grid-template-columns: auto 1fr auto;
			align-items: center;
			gap: 12px;
			padding: 12px 12px;
			border: none;
			border-radius: 14px;
			background: transparent;
			text-align: left;
			overflow: hidden;
			cursor: pointer;

			&:hover:not(:disabled),
			&:focus-within {
				background: rgb(30 24 19 / 0.06);
			}

			&:disabled {
				cursor: default;

				span,
				svg {
					opacity: 0.4;
				}
			}

			span {
				font-size: 0.88rem;
				font-weight: 500;
			}

			small {
				font-size: 0.7rem;
				font-variant-numeric: tabular-nums;
				opacity: 0.5;
			}
		}

		.file {
			position: absolute;
			inset: 0;
			opacity: 0;
			cursor: pointer;
		}
	}

	.progress {
		position: absolute;
		inset: auto 12px 6px;
		height: 2px;
		border-radius: 2px;
		background: rgb(30 24 19 / 0.1);

		&::after {
			content: '';
			position: absolute;
			inset: 0 auto 0 0;
			width: calc(var(--progress) * 100%);
			border-radius: inherit;
			background: #1e1813;
			transition: width 0.2s linear;
		}
	}

	.studio {
		left: max(16px, env(safe-area-inset-left));
		bottom: calc(max(18px, env(safe-area-inset-bottom)) + 60px);
		width: min(900px, calc(100vw - 32px));
		height: min(480px, calc(100dvh - 180px));
		padding: 18px;
		transform-origin: bottom left;

		:global(.studio) {
			height: 100%;
		}
	}

	.write {
		left: 50%;
		bottom: max(24px, env(safe-area-inset-bottom));
		translate: -50% 0;
		width: min(640px, calc(100vw - 300px));
		display: grid;
		gap: 12px;
		padding: 16px;
		border-radius: 26px;
		transform-origin: bottom center;
	}

	.liquid {
		background:
			radial-gradient(120% 80% at 20% 0%, rgb(255 255 255 / 0.55), transparent 60%),
			linear-gradient(160deg, rgb(255 255 255 / 0.36), rgb(255 248 235 / 0.16));
		backdrop-filter: blur(28px) saturate(1.8) brightness(1.04);
		-webkit-backdrop-filter: blur(28px) saturate(1.8) brightness(1.04);
		border: 1px solid rgb(255 255 255 / 0.55);
		box-shadow:
			inset 0 1.5px 0 rgb(255 255 255 / 0.85),
			inset 0 -1px 0 rgb(255 255 255 / 0.25),
			inset 0 0 24px rgb(255 255 255 / 0.18),
			0 0 0 0.5px rgb(30 24 19 / 0.1),
			0 30px 60px -20px rgb(60 40 20 / 0.35);
	}

	.phrases {
		display: flex;
		gap: 6px;
		overflow-x: auto;
		scrollbar-width: none;
	}

	.chip {
		flex: none;
		padding: 5px 12px;
		border: 1px solid rgb(30 24 19 / 0.12);
		border-radius: 999px;
		background: rgb(255 255 255 / 0.35);
		font-family: 'Gowun Batang', serif;
		font-size: 0.85rem;
		cursor: pointer;
		transition: background 0.2s ease;

		&:hover {
			background: rgb(255 255 255 / 0.7);
		}
	}

	.compose {
		display: flex;
		gap: 8px;

		textarea {
			flex: 1;
			min-width: 0;
			resize: none;
			padding: 10px 14px;
			border: 1px solid rgb(255 255 255 / 0.6);
			border-radius: 16px;
			background: rgb(255 255 255 / 0.45);
			box-shadow: inset 0 1px 3px rgb(30 24 19 / 0.08);
			font-family: 'Gowun Batang', serif;
			font-size: 1.05rem;
			line-height: 1.4;
			color: inherit;
			outline: none;
			touch-action: auto;

			&:focus {
				border-color: rgb(181 40 28 / 0.4);
				background: rgb(255 255 255 / 0.65);
			}
		}
	}

	.primary {
		min-width: 88px;
		padding: 0 16px;
		border: none;
		border-radius: 16px;
		background: #1e1813;
		color: #f4ecdd;
		font-weight: 500;
		cursor: pointer;
		transition: scale 0.15s ease;

		&:active {
			scale: 0.96;
		}
	}

	.options {
		display: grid;
		grid-template-columns: 1fr 1fr auto;
		align-items: center;
		gap: 4px 16px;
		font-size: 0.8rem;
	}

	.toggle {
		display: flex;
		align-items: center;
		gap: 6px;
		white-space: nowrap;

		input {
			accent-color: #1e1813;
		}
	}

	.hint {
		position: absolute;
		left: 50%;
		bottom: max(24px, env(safe-area-inset-bottom));
		translate: -50% 0;
		margin: 0;
		padding: 8px 16px;
		border-radius: 999px;
		font-size: 0.78rem;
		white-space: nowrap;
		pointer-events: none;
	}

	.theater .stage {
		cursor: pointer;
	}

	@media (max-width: 720px) {
		.title {
			display: none;
		}

		.corner {
			left: max(12px, env(safe-area-inset-left));
			right: max(12px, env(safe-area-inset-right));
			justify-content: flex-end;
			gap: 6px;
		}

		.tools {
			min-width: 0;
			overflow-x: auto;
			scrollbar-width: none;
			overscroll-behavior: contain;
			touch-action: pan-x;
		}

		.tools button {
			flex: none;
			width: 36px;
			height: 36px;
		}

		.github,
		.reveal {
			flex: none;
			width: 44px;
			height: 44px;
		}

		.sidebar {
			height: min(46dvh, 360px);
			gap: 10px;
		}

		.settings {
			width: 44px;
			height: 44px;
			left: max(12px, env(safe-area-inset-left));
			bottom: max(14px, env(safe-area-inset-bottom));
		}

		.well {
			right: max(12px, env(safe-area-inset-right));
			bottom: max(12px, env(safe-area-inset-bottom));

			:global(.inkstone) {
				--size: 66px;
			}
		}

		.tray {
			width: 220px;

			:global(.sb-ink-tray) {
				height: 116px;
			}
		}

		.popover.library,
		.popover.color,
		.popover.papers,
		.popover.export,
		.popover.studio,
		.popover.write {
			top: auto;
			left: 0;
			right: 0;
			bottom: 0;
			translate: none;
			width: auto;
			max-height: 78dvh;
			padding: 16px 16px max(16px, env(safe-area-inset-bottom));
			border-radius: 24px 24px 0 0;
		}

		.popover.studio {
			height: 86dvh;
			max-height: none;
		}

		.options {
			grid-template-columns: 1fr 1fr;
		}
	}
</style>
