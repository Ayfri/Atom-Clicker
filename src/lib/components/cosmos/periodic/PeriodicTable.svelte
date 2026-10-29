<script lang="ts">
	import AtomStage from '#components/cosmos/periodic/AtomStage.svelte';
	import { MINI_NUCLEONS, nucleonsOf, paintNucleus, type StageKind } from '#components/cosmos/periodic/atoms.js';
	import { TableAtoms, type CellLook } from '#components/cosmos/periodic/TableAtoms.js';
	import { TableParticles, type Point } from '#components/cosmos/periodic/TableParticles.js';
	import TuningStrip from '#components/cosmos/periodic/TuningStrip.svelte';
	import Currency from '#components/ui/Currency.svelte';
	import { COSMOS_OBJECTS_BY_ID } from '#data/cosmos.js';
	import { CURRENCIES, CurrenciesTypes, type CurrencyName } from '#data/currencies.js';
	import {
		decayCost,
		ELEMENT_COUNT,
		ELEMENT_GENERATOR_PERCENT,
		ELEMENTS,
		elementGenerators,
		elementStat,
		FAMILIES,
		FAMILY_IDS,
		LAMP_PAYBACK_SECONDS,
		lightCost,
		type Element,
		type LightColor,
		LORE,
		lineX,
		SET_BONUS,
		spectrumGradient,
		STAT_LABELS,
		wavelengthColor,
	} from '#data/elements.js';
	import { GENERATORS } from '#data/generators.js';
	import { GENERATOR_ICON_NAMES } from '#data/iconNames.js';
	import { ICONS } from '#data/icons.js';
	import { CHAINS, DECAY_EVENTS_PER_SECOND, DECAY_SITES, FORGED_BY, reactionOf, SITE_IDS, siteStudyCost, SITES, type SiteId } from '#data/sites.js';
	import { particlesEnabled, pixelRatio } from '#helpers/CanvasLoop.js';
	import { currenciesManager } from '#helpers/CurrenciesManager.svelte.js';
	import { gameManager } from '#helpers/GameManager.svelte.js';
	import { PanZoom } from '#helpers/PanZoom.svelte.js';
	import { periodicManager, type SiteStatus } from '#helpers/PeriodicManager.svelte.js';
	import type { EffectStat } from '#lib/types.js';
	import { formatNumber } from '#lib/utils.js';
	import { mobile } from '#stores/window.svelte.js';
	import { ChevronDown, ChevronsUp, Cog, Factory, Lock, MousePointerClick, Shield, Star, X, Zap } from '@lucide/svelte';
	import { tick, untrack, type Component } from 'svelte';
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';
	import { fade, fly, scale } from 'svelte/transition';

	interface Props {
		onClose: () => void;
	}

	let { onClose }: Props = $props();

	type StatIcon = Component<{ size?: number }> | CurrencyName;

	/** Same pictograms as the Sky panel's boosts: a currency shows its own icon, the other stats a lucide one. */
	const STAT_ICONS: Partial<Record<EffectStat, StatIcon>> = {
		blue_light_gain: CurrenciesTypes.BLUE_LIGHT,
		click: MousePointerClick,
		electron_gain: CurrenciesTypes.ELECTRONS,
		excited_photon_chance: CurrenciesTypes.EXCITED_PHOTONS,
		generator: Cog,
		global: Factory,
		green_light_gain: CurrenciesTypes.GREEN_LIGHT,
		power_up_multiplier: Zap,
		proton_gain: CurrenciesTypes.PROTONS,
		red_light_gain: CurrenciesTypes.RED_LIGHT,
		stability_capacity: Shield,
		xp_gain: ChevronsUp,
	};
	const LIGHTS = [
		['red', CurrenciesTypes.RED_LIGHT],
		['green', CurrenciesTypes.GREEN_LIGHT],
		['blue', CurrenciesTypes.BLUE_LIGHT],
	] as const satisfies [LightColor, CurrencyName][];
	const LIGHT_HEX: Record<LightColor, string> = { blue: '#4d8dff', green: '#2ee6a0', red: '#ff4d5e' };
	/**
	 * Each source as a small piece of sky, the same object the Cosmos shows: the CMB's mottled glow, a red giant, a supernova
	 * remnant, a white dwarf's shell, cosmic rays streaking down on the Earth, two neutron stars merging, glowing ore, a reactor's
	 * Cherenkov blue and an accelerator ring.
	 */
	const SKY: Record<SiteId, string> = {
		accelerator:
			'radial-gradient(circle, #e6ecff 0 4%, transparent 7%), radial-gradient(circle, transparent 52%, #8a93a6 55%, #5b6375 58%, transparent 61%), radial-gradient(circle, #1a2030, #0b0f1c)',
		bigbang:
			'radial-gradient(circle at 30% 35%, #ffcf9a88 0, transparent 30%), radial-gradient(circle at 68% 62%, #8fb4ff99 0, transparent 34%), radial-gradient(circle at 62% 26%, #ff9f8a66 0, transparent 24%), radial-gradient(circle at 34% 72%, #9db8ff77 0, transparent 26%), radial-gradient(circle, #2c2350, #0b0f1c)',
		cosmic:
			'repeating-linear-gradient(118deg, transparent 0 7px, #6ff0c477 7px 8px, transparent 8px 15px), radial-gradient(circle at 50% 135%, #3d8bd6 0 52%, #9fd3ff 54%, transparent 57%), radial-gradient(circle, #10283a, #0b0f1c)',
		decay: 'radial-gradient(circle, #e9ffb0 0 7%, #c6f36b 14%, #c6f36b55 32%, transparent 60%), radial-gradient(circle at 60% 70%, #3a3a2a, #0b0f1c)',
		lowmass: 'radial-gradient(circle, #fff3d6 0 8%, #ffb36b 20%, #ff7a3d 36%, #ff7a3d33 52%, transparent 70%), #0b0f1c',
		massive:
			'radial-gradient(circle, #ffffff 0 4%, #ffb3c3 10%, transparent 22%), conic-gradient(from 10deg, #ff6b8b55, transparent 8%, #ff6b8b44 18%, transparent 27%, #ffa06b55 40%, transparent 50%, #ff6b8b55 63%, transparent 72%, #b98aff44 85%, transparent 94%), radial-gradient(circle, #3a1730, #0b0f1c 72%)',
		neutron:
			'radial-gradient(circle at 42% 50%, #ffffff 0 5%, transparent 8%), radial-gradient(circle at 58% 50%, #ffffff 0 5%, transparent 8%), radial-gradient(ellipse 70% 35%, #e5d6ff 0 12%, #b98aff88 30%, transparent 62%), radial-gradient(circle, #1f1636, #0b0f1c)',
		reactor: 'radial-gradient(circle, #e8f7ff 0 6%, #7fc8ff 18%, #3b6cff 36%, #3b6cff33 56%, transparent 72%), #0b0f1c',
		whitedwarf:
			'radial-gradient(circle, #ffffff 0 5%, #e6ecff55 9%, transparent 14%), radial-gradient(circle, transparent 40%, #e6ecff66 47%, #9db8ff33 53%, transparent 60%), radial-gradient(circle, #141a2e, #0b0f1c)',
	};
	/** The table and the bonus line under it share the size container: 56px is the line's height, 16px leaves room for a selected cell's outline. */
	const TABLE_WIDTH = 'min(100cqw - 16px, (100cqh - 56px) * 1.68 - 16px)';
	const CELL = 44;
	const GAP = 4;
	const RAINBOW = 'linear-gradient(90deg, transparent, #ff4d5e, #ffd76b, #2ee6a0, #4d8dff, #b98aff, transparent)';
	const RANK: Record<SiteStatus['kind'], number> = { done: 2, forging: 0, locked: 3, waiting: 1 };
	/** The reveal's rainbow fills, fades out, then the element's lines light one every step. */
	const REVEAL_LINES_AT = 700;
	const REVEAL_LINE_STEP = 140;
	const SPECTRUM = `linear-gradient(90deg, ${[380, 420, 450, 480, 510, 550, 580, 610, 650, 700, 780].map(wavelengthColor).join(', ')})`;
	const BOUNCE: Keyframe[] = [{ transform: 'scale(1)' }, { transform: 'scale(1.25)' }, { transform: 'scale(1)' }];

	/** Elements whose spectrum reveal still plays, they read as identified only once its comets land. */
	const reading = new SvelteSet<number>();
	const pops = new SvelteMap<number, string>();
	let atoms = $state.raw<TableAtoms | null>(null);
	let particles: TableParticles | null = null;
	let reveal = $state.raw<{ element: Element; id: number } | null>(null);
	let revealId = 0;
	let scienceOpen = $state(false);
	let showLocked = $state(false);
	let toasts = $state<{ color: string; id: number; text: string }[]>([]);
	let toastId = 0;
	let selected = $state(untrack(() => periodicManager.ready[0] ?? [...periodicManager.forged].at(-1) ?? 1));

	const lights = $derived(Object.fromEntries(LIGHTS.map(([color, name]) => [color, currenciesManager.getAmount(name)])) as Record<LightColor, number>);
	const decayEvents = $derived(currenciesManager.getAmount(CurrenciesTypes.DECAY_EVENTS));
	const starlight = $derived(currenciesManager.getAmount(CurrenciesTypes.STARLIGHT));
	const sites = $derived(SITE_IDS.map(id => ({ id, site: SITES[id], status: periodicManager.statuses[id] })).toSorted((a, b) => RANK[a.status.kind] - RANK[b.status.kind]));
	const lockedCount = $derived(sites.filter(({ status }) => status.kind === 'locked').length);
	const ready = $derived(periodicManager.ready.filter(z => !reading.has(z)));
	const identifiedCount = $derived(periodicManager.identified.length - reading.size);

	/**
	 * What each cell shows: an atom once identified, a bare nucleus once forged, a nucleus gaining nucleons while forged, a dashed
	 * ring for the next element of a source that waits. Every other element is only the table's faint outline.
	 */
	const looks = $derived.by(() => {
		const map = new Map<number, CellLook>();
		for (const { site, status } of sites) {
			if (status.kind === 'forging') map.set(status.z, { color: site.color, kind: 'forging', progress: status.progress / ELEMENTS[status.z - 1].need });
			else if (status.kind === 'waiting') map.set(status.z, { kind: 'waiting' });
		}
		for (const z of periodicManager.forged) {
			const kind = reading.has(z) ? 'reading' : periodicManager.identifiedSet.has(z) ? 'identified' : 'ready';
			const { family, lines } = ELEMENTS[z - 1];
			map.set(z, { color: FAMILIES[family].color, ...(kind === 'identified' && lines.length > 0 && { glow: wavelengthColor(lines[0]) }), kind });
		}
		return map;
	});

	const element = $derived(ELEMENTS[selected - 1]);
	const stageKind = $derived((looks.get(selected)?.kind ?? null) as StageKind | null);
	const forgingOf = (z: number) => sites.find(({ status }) => status.kind === 'forging' && status.z === z);

	$effect(() => atoms?.set(looks));

	$effect(() => {
		if (!particlesEnabled) return;
		const canvas = document.createElement('canvas');
		canvas.style.cssText = 'height: 100%; inset: 0; pointer-events: none; position: fixed; width: 100%; z-index: 60;';
		document.body.appendChild(canvas);
		particles = new TableParticles(canvas);
		return () => {
			particles?.destroy();
			particles = null;
			canvas.remove();
		};
	});

	function mountAtoms(canvas: HTMLCanvasElement) {
		const instance = new TableAtoms(canvas, mobile.current ? 1.25 : 1);
		atoms = instance;
		return () => {
			instance.destroy();
			atoms = null;
		};
	}

	/** The nucleus a source is forging, drawn again whenever it gains a nucleon. */
	function forgeNucleus(z: number, progress: number, color: string) {
		return (canvas: HTMLCanvasElement) => {
			const size = Math.round(canvas.clientWidth * pixelRatio());
			canvas.width = canvas.height = size;
			const ctx = canvas.getContext('2d');
			const shown = Math.floor(progress * Math.min(MINI_NUCLEONS, nucleonsOf(z)));
			if (ctx && shown > 0) paintNucleus(ctx, size / 2, size / 2, size * 0.4, shown, color);
		};
	}

	function centerOf(selector: string): Point | null {
		const rect = document.querySelector(selector)?.getBoundingClientRect();
		return rect && rect.width ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : null;
	}

	function toast(text: string, color: string) {
		const id = ++toastId;
		toasts = [...toasts.slice(-2), { color, id, text }];
		setTimeout(() => (toasts = toasts.filter(other => other.id !== id)), 2800);
	}

	/** A newly forged nucleus flies from its source to its cell. */
	let known = new Set(untrack(() => periodicManager.forged));
	$effect(() => {
		const forged = periodicManager.forged;
		const fresh = [...forged].filter(z => !known.has(z));
		known = new Set(forged);
		for (const z of fresh) {
			const id = FORGED_BY[z];
			const color = SITES[id].color;
			const from = centerOf(`[data-forge="${id}"]`);
			const to = centerOf(`[data-cell="${z}"]`);
			if (from) particles?.burst(from, [color, '#ffffff'], 12, { speed: 120 });
			if (from && to) particles?.comet(from, to, color);
			document.querySelector(`[data-forge="${id}"]`)?.animate(BOUNCE, { duration: 400, easing: 'ease-out' });
			setTimeout(() => to && particles?.burst(to, [color, '#ffffff'], 18), 900);
			toast(`${SITES[id].glyph} ${ELEMENTS[z - 1].name} is ready to identify`, color);
		}
	});

	/** Sites open as their Cosmos object is found or their elements identified, each one bursts into the strip. */
	let opened = new Set(untrack(() => periodicManager.open));
	$effect(() => {
		const open = periodicManager.open;
		const fresh = [...open].filter(id => !opened.has(id));
		opened = new Set(open);
		for (const id of fresh) {
			toast(`${SITES[id].glyph} ${SITES[id].name} opened`, SITES[id].color);
			tick().then(() => {
				const source = centerOf(`[data-forge="${id}"]`);
				if (source) particles?.burst(source, [SITES[id].color, '#ffffff'], 30, { speed: 160 });
			});
		}
	});

	/** The forging sources breathe out a spark on every forge tick. */
	$effect(() => {
		const interval = setInterval(() => {
			for (const { id, site, status } of sites) {
				if (status.kind !== 'forging') continue;
				const source = centerOf(`[data-forge="${id}"]`);
				if (source) particles?.burst(source, [site.color], 2, { rise: true, size: 8, speed: 50 });
			}
		}, 1000);
		return () => clearInterval(interval);
	});

	/** Shows a source in the sky strip. */
	async function locate(id: SiteId) {
		if (!periodicManager.open.has(id)) showLocked = true;
		await tick();
		const source = document.querySelector(`[data-forge="${id}"]`);
		source?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
		source?.animate(BOUNCE, { delay: 300, duration: 400, easing: 'ease-out' });
	}

	function study(id: SiteId) {
		if (!periodicManager.study(id)) return;
		const source = centerOf(`[data-forge="${id}"]`);
		if (source) particles?.burst(source, [SITES[id].color, '#cfe8ff'], 24, { rise: true, speed: 140 });
		document.querySelector(`[data-forge="${id}"]`)?.animate(BOUNCE, { duration: 400, easing: 'ease-out' });
	}

	function studyTitle(id: SiteId, kind: SiteStatus['kind']): string {
		const gains = [
			...(kind === 'done' ? [] : [`×${periodicManager.forge(id).level + 2} synthesis speed`]),
			...(DECAY_SITES.includes(id) ? [`+${DECAY_EVENTS_PER_SECOND} Decay event/s`] : []),
		];
		return `Study it: ${gains.join(', ')}`;
	}

	/** Short enough for the strip under a source: `~40m`, `~5h`, `~3d`. */
	function eta(seconds: number): string {
		if (!Number.isFinite(seconds)) return 'stalled';
		if (seconds < 3600) return `~${Math.max(1, Math.round(seconds / 60))}m`;
		if (seconds < 86_400 * 2) return `~${Math.round(seconds / 3600)}h`;
		return `~${Math.round(seconds / 86_400)}d`;
	}

	/** Lamp rates are tiny per element: two decimals would round most of them to 0. */
	const rateText = (rate: number) => (rate >= 0.01 ? formatNumber(rate) : rate.toPrecision(2));

	const bonusText = (target: Element) => `+${FAMILIES[target.family].step}% ${STAT_LABELS[elementStat(target)]}`;

	/** Light flies from the counters into the held atom, each color as often as the element's lines call for it, Decay events for one without lines. */
	function feed(target: Element, to: Point) {
		if (decayCost(target) > 0) {
			const from = centerOf('[data-light="decay"]');
			if (from) particles?.comet(from, to, CURRENCIES[CurrenciesTypes.DECAY_EVENTS].color, -40);
			return;
		}
		const cost = periodicManager.costOf(target.z).light;
		let pick = Math.random() * (cost.red + cost.green + cost.blue);
		const [color] = LIGHTS.find(([candidate]) => (pick -= cost[candidate]) < 0) ?? LIGHTS[0];
		const from = centerOf(`[data-light="${color}"]`);
		if (from) particles?.comet(from, to, LIGHT_HEX[color], -40);
	}

	/**
	 * Identifying plays the element's own spectrum: a rainbow collapses into its real emission lines, each line flies to the cell
	 * as a comet in its wavelength color, and the atom lights up when the last one lands.
	 */
	function identify(target: Element) {
		if (!periodicManager.identify(target.z)) return;
		reading.add(target.z);
		const id = ++revealId;
		reveal = { element: target, id };
		const lines = target.lines.toSorted((a, b) => a - b);
		const launch = (i: number) => REVEAL_LINES_AT + i * REVEAL_LINE_STEP + 250;
		lines.forEach((nm, i) =>
			setTimeout(() => {
				const from = centerOf(`[data-reveal="${id}"] [data-line="${nm}"]`);
				const to = centerOf(`[data-cell="${target.z}"]`);
				if (from && to) particles?.comet(from, to, wavelengthColor(nm));
			}, launch(i)),
		);
		const landing = launch(lines.length - 1) + 900;
		setTimeout(() => lightUp(target, lines), landing);
		setTimeout(() => {
			if (reveal?.id === id) reveal = null;
		}, landing + 500);
	}

	function lightUp(target: Element, lines: number[]) {
		reading.delete(target.z);
		pops.set(target.z, bonusText(target));
		setTimeout(() => pops.delete(target.z), 1400);
		document
			.querySelector(`[data-cell="${target.z}"] [data-sweep]`)
			?.animate(
				[
					{ opacity: 1, transform: 'translateX(-100%)' },
					{ opacity: 1, offset: 0.6, transform: 'translateX(0)' },
					{ opacity: 0, transform: 'scaleY(0.1)' },
				],
				{ duration: 700, easing: 'ease-out' },
			);
		const at = centerOf(`[data-cell="${target.z}"]`);
		if (at) {
			particles?.burst(at, lines.map(wavelengthColor), 36, { speed: 220 });
			setTimeout(() => particles?.burst(at, [FAMILIES[target.family].color, '#ffffff'], 16, { speed: 90 }), 350);
		}

		const family = ELEMENTS.filter(other => other.family === target.family);
		if (family.every(other => periodicManager.identifiedSet.has(other.z))) {
			const info = FAMILIES[target.family];
			toast(`★ Set complete! ${info.name} ×${SET_BONUS}`, info.color);
			for (const other of family) {
				const delay = Math.hypot(other.row - target.row, other.column - target.column) * 70;
				document.querySelector(`[data-cell="${other.z}"] [data-wave]`)?.animate([{ opacity: 0 }, { opacity: 0.9 }, { opacity: 0 }], { delay, duration: 600 });
				setTimeout(() => {
					const point = centerOf(`[data-cell="${other.z}"]`);
					if (point) particles?.burst(point, [info.color, '#ffffff'], 10, { speed: 110 });
				}, delay);
			}
		}
		const next = ready.find(other => other !== target.z);
		if (next && !mobile.current && selected === target.z) setTimeout(() => (selected = next), 1600);
	}

	const home = $derived.by(() => {
		const target = ELEMENTS[(ready[0] ?? selected) - 1];
		return { x: (target.column - 0.5) * (CELL + GAP), y: (target.row - 0.5) * (CELL + GAP) };
	});
	const panZoom = $derived(
		new PanZoom({ bounds: { maxX: 18 * (CELL + GAP), maxY: 10 * (CELL + GAP) + 12, minX: 0, minY: 0 }, home: { ...home, zoom: 1.1 }, maxZoom: 2.5, minZoom: 0.4 }),
	);
</script>

{#snippet lightPill(color: LightColor | 'decay' | null, name: CurrencyName, amount: number, need?: number, rate = 0)}
	<span
		class={[
			'flex items-center gap-1.5 rounded-full font-semibold tabular-nums',
			need === undefined ? 'bg-white/6 px-2.5 py-1 text-sm' : 'px-3 py-1.5 text-base',
			need !== undefined && (amount >= need ? 'bg-white/10 text-white' : 'bg-red-500/15 text-red-300'),
		]}
		data-hint={need === undefined && color === 'decay' ? 'table-decay' : undefined}
		data-light={need === undefined ? color : undefined}
	>
		<Currency
			{name}
			size={need === undefined ? 16 : 20}
		/>
		{formatNumber(need ?? amount)}
		{#if rate > 0}
			<span class="text-[10px] font-normal text-white/45">+{rateText(rate)}/s</span>
		{/if}
	</span>
{/snippet}

{#snippet progressRing(color: string, progress: number, smoothKey: number)}
	<svg
		class="absolute inset-0 -rotate-90"
		viewBox="0 0 64 64"
	>
		<circle
			cx="32"
			cy="32"
			fill="none"
			r="30"
			stroke="rgb(255 255 255 / 0.08)"
			stroke-width="3"
		/>
		{#key smoothKey}
			<circle
				class="smooth"
				cx="32"
				cy="32"
				fill="none"
				r="30"
				stroke={color}
				stroke-dasharray={2 * Math.PI * 30}
				stroke-dashoffset={2 * Math.PI * 30 * (1 - progress)}
				stroke-linecap="round"
				stroke-width="3"
			/>
		{/key}
	</svg>
{/snippet}

{#snippet statIcon(stat: EffectStat, size: number)}
	{@const Icon = STAT_ICONS[stat]}
	{#if typeof Icon === 'string'}
		<Currency
			name={Icon}
			{size}
		/>
	{:else if Icon}
		<Icon {size} />
	{/if}
{/snippet}

<!-- The sources as pieces of sky, each with the nucleus it is forging in front of it. -->
{#snippet sky()}
	<div
		class="mx-auto flex w-max gap-1 lg:gap-3"
		data-hint="table-forges"
	>
		{#each sites.filter(({ status }) => showLocked || status.kind !== 'locked') as { id, site, status } (id)}
			{@const forge = periodicManager.forge(id)}
			<div class="flex w-21 shrink-0 flex-col items-center gap-0.5 text-center lg:w-24">
				<button
					class={['relative grid size-15 shrink-0 place-items-center rounded-full lg:size-18', 'z' in status && 'cursor-pointer']}
					data-forge={id}
					disabled={!('z' in status)}
					onclick={() => 'z' in status && (selected = status.z)}
					title={status.kind === 'locked' ? site.gate : site.name}
				>
					<span
						class={[
							'absolute inset-1 rounded-full',
							status.kind === 'forging' && 'breathe',
							status.kind === 'locked' && 'opacity-25 grayscale',
							status.kind === 'done' && 'opacity-60',
						]}
						style:background={SKY[id]}
					></span>
					{#if status.kind === 'forging'}
						{@render progressRing(site.color, status.progress / ELEMENTS[status.z - 1].need, status.z)}
						<span class="absolute -right-1 -bottom-1 size-8 rounded-full bg-[#05070f] ring-1 ring-white/15">
							<canvas
								class="inset-0.5 size-7"
								{@attach forgeNucleus(status.z, status.progress / ELEMENTS[status.z - 1].need, site.color)}
							></canvas>
						</span>
					{:else if status.kind === 'waiting'}
						<svg
							class="absolute inset-0"
							viewBox="0 0 64 64"
						>
							<circle
								cx="32"
								cy="32"
								fill="none"
								r="30"
								stroke="rgb(252 211 77 / 0.6)"
								stroke-dasharray="4 6"
								stroke-width="2"
							/>
						</svg>
					{:else if status.kind === 'locked'}
						<Lock
							class="relative text-white/60"
							size={16}
						/>
					{/if}
				</button>
				<span
					class="mt-1 text-[11px] leading-tight font-bold whitespace-nowrap"
					style:color={status.kind === 'locked' ? 'rgb(255 255 255 / 0.4)' : site.color}
				>
					{site.short}
				</span>
				{#if status.kind === 'forging'}
					<span class="text-[10px] text-white/55 tabular-nums">
						{ELEMENTS[status.z - 1].symbol} · {eta(periodicManager.etaOf(id))}
					</span>
				{:else if status.kind === 'waiting'}
					<span
						class="line-clamp-2 text-[10px] leading-tight text-amber-200/80"
						title={CHAINS[id].seeds[status.z]?.why}
					>
						{status.missing.length ?
							`Needs ${status.missing.map(z => ELEMENTS[z - 1].symbol).join(', ')}`
						:	`Needs ${COSMOS_OBJECTS_BY_ID[status.object ?? '']?.name ?? 'a discovery'}`}
					</span>
				{:else if status.kind === 'done'}
					<span class="text-[10px] text-white/40">Complete</span>
				{:else}
					<span class="line-clamp-2 text-[10px] leading-tight text-white/40">{site.gate}</span>
				{/if}
				<!-- A decay site's chain ends early, its study also raises the Decay events it pays. -->
				{#if status.kind === 'forging' || (status.kind !== 'locked' && DECAY_SITES.includes(id))}
					<button
						class="mt-0.5 flex items-center gap-1 rounded-full bg-accent-600/80 px-2 py-0.5 text-[10px] font-bold transition-colors enabled:hover:bg-accent-500 disabled:opacity-35"
						disabled={starlight < siteStudyCost(forge.level)}
						onclick={() => study(id)}
						title={studyTitle(id, status.kind)}
					>
						<Currency
							name={CurrenciesTypes.STARLIGHT}
							size={12}
						/>
						{formatNumber(siteStudyCost(forge.level))}
					</button>
				{/if}
			</div>
		{/each}
		{#if lockedCount}
			<!-- Locked sources stay folded so the strip only shows what the player can act on. -->
			<div class="flex w-21 shrink-0 flex-col items-center gap-0.5 text-center lg:w-24">
				<button
					class="grid size-15 place-items-center rounded-full border border-dashed border-white/15 text-sm font-bold text-white/45 transition-colors hover:bg-white/4 hover:text-white/70 lg:size-18"
					onclick={() => (showLocked = !showLocked)}
				>
					{showLocked ? '−' : `+${lockedCount}`}
				</button>
				<span class="mt-1 text-[11px] leading-tight text-white/40">{showLocked ? 'Hide' : 'To find'}</span>
			</div>
		{/if}
	</div>
{/snippet}

{#snippet table()}
	<div
		class="relative mx-auto grid"
		style:gap="{GAP}px"
		style:grid-template-columns={mobile.current ? `repeat(18, ${CELL}px)` : 'repeat(18, minmax(0, 1fr))'}
		style:width={mobile.current ? undefined : TABLE_WIDTH}
		style:grid-template-rows="repeat(8, auto) 12px auto auto"
	>
		<canvas
			class="-top-4 -left-4 z-0 size-[calc(100%+2rem)]"
			{@attach mountAtoms}
		></canvas>
		{#each ELEMENTS as cell (cell.z)}
			{@const look = looks.get(cell.z)}
			<!-- Every slot is the same button so the atoms canvas measures it once, an empty one is only the table's faint outline. -->
			<button
				class={[
					'relative flex aspect-square items-end justify-center rounded-md border pb-[4%] text-[10px] leading-none font-black lg:text-[11px]',
					look ? 'cursor-pointer border-transparent hover:bg-white/5' : 'border-white/4',
					selected === cell.z && 'z-1 outline-2 outline-offset-1 outline-white/80',
				]}
				style:grid-column={cell.column}
				style:grid-row={cell.row}
				aria-label={look ? cell.name : undefined}
				data-cell={cell.z}
				disabled={!look}
				onclick={() => (selected = cell.z)}
			>
				{#if look}
					<span class="pointer-events-none absolute inset-0 overflow-hidden rounded-[5px]">
						<span
							class="absolute inset-0 opacity-0"
							data-sweep
							style:background-image={RAINBOW}
						></span>
						<span
							class="absolute inset-0 bg-white opacity-0"
							data-wave
						></span>
					</span>
					<span
						class={[
							'relative [text-shadow:0_0_3px_#05070f,0_0_6px_#05070f]',
							look.kind === 'identified' || look.kind === 'ready' ? 'text-white'
							: look.kind === 'reading' ? 'text-white/70'
							: 'text-white/35',
						]}
					>
						{cell.symbol}
					</span>
					{#if pops.has(cell.z)}
						<span class="reward-pop pointer-events-none absolute bottom-full left-1/2 z-10 rounded-md bg-[#05070f]/90 px-1.5 py-0.5 text-[10px] whitespace-nowrap text-amber-200">
							{pops.get(cell.z)}
						</span>
					{/if}
				{/if}
			</button>
		{/each}

		{#each [[6, '57-71', 57], [7, '89-103', 89]] as const as [row, range, first] (row)}
			<span
				class:invisible={!ELEMENTS.slice(first - 1, first + 14).some(other => looks.has(other.z))}
				class="flex items-center justify-center text-[8px] text-white/20"
				style:grid-column={3}
				style:grid-row={row}
			>
				{range}
			</span>
		{/each}
	</div>
{/snippet}

<!-- The element as a big atom: forged bare, filled with electrons by holding it, spinning in its family color once identified. -->
{#snippet card()}
	{@const info = FAMILIES[element.family]}
	{@const family = ELEMENTS.filter(other => other.family === element.family)}
	{@const cost = periodicManager.costOf(element.z).light}
	{@const lamp = lightCost(element)}
	{@const decayNeed = decayCost(element)}
	{@const siteId = FORGED_BY[element.z]}
	{@const site = SITES[siteId]}
	{@const lore = LORE[element.symbol]}
	{@const fill = forgingOf(element.z)}
	{@const affordable = periodicManager.canAfford(element.z)}
	{@const stat = elementStat(element)}
	{#if stageKind}
		<div class="flex items-center gap-4 lg:flex-col lg:gap-0 lg:text-center">
			<div
				class="shrink-0"
				data-hint="table-stage"
			>
				<AtomStage
					class="size-28 lg:size-60"
					{affordable}
					color={info.color}
					kind={stageKind}
					onfeed={center => feed(element, center)}
					onidentify={() => identify(element)}
					onrefuse={() => toast(decayNeed > 0 ? 'Not enough Decay events yet' : 'Not enough Light to read it yet', '#ff8a8a')}
					progress={fill && fill.status.kind === 'forging' ? fill.status.progress / element.need : 0}
					siteColor={site.color}
					z={element.z}
				/>
			</div>
			<div class="min-w-0 lg:-mt-1">
				<p
					class="text-xs font-semibold"
					style:color={info.color}
				>
					{element.z} · {info.name}
				</p>
				<h2 class="text-2xl leading-tight font-black">
					{element.name}
					<span class="text-white/30">{element.symbol}</span>
				</h2>
				<p
					class={[
						'mt-1 text-sm font-bold',
						stageKind === 'ready' && (affordable ? 'hold-call text-white' : 'text-red-300'),
						stageKind === 'reading' && 'text-white/70',
						stageKind === 'waiting' && 'text-amber-200/80',
					]}
					style:color={stageKind === 'identified' ? info.color : stageKind === 'forging' ? site.color : undefined}
				>
					{#if stageKind === 'identified'}
						<span class="inline-flex items-center gap-1.5">{@render statIcon(stat, 16)} {bonusText(element)}</span>
					{:else if stageKind === 'reading'}
						Reading its light…
					{:else if stageKind === 'ready'}
						{affordable ? 'Hold the atom to read its light' : decayNeed > 0 ? 'Not enough Decay events yet' : 'Not enough Light yet'}
					{:else if stageKind === 'forging'}
						{site.glyph} Forging · {Math.floor((fill && fill.status.kind === 'forging' ? fill.status.progress / element.need : 0) * 100)}% ·
						{eta(periodicManager.etaOf(siteId))}
					{:else}
						Its source waits for another element
					{/if}
				</p>
			</div>
		</div>

		{#if stageKind === 'ready'}
			<div class="mt-3 flex flex-wrap justify-center gap-1.5 text-xs">
				{#each LIGHTS as [color, name] (color)}
					{#if cost[color] > 0}
						{@render lightPill(null, name, lights[color], cost[color])}
					{/if}
				{/each}
				{#if decayNeed > 0}
					{@render lightPill(null, CurrenciesTypes.DECAY_EVENTS, decayEvents, decayNeed)}
				{/if}
			</div>
			{#if periodicManager.tuned && element.lines.length}
				<div class="mt-3 flex justify-center">
					<TuningStrip {element} />
				</div>
			{/if}
		{/if}

		<div class="mt-3 flex flex-col items-center gap-1.5 text-xs">
			{#if stageKind !== 'identified'}
				<span
					class="flex items-center gap-1"
					style:color={info.color}
				>
					{@render statIcon(stat, 13)}
					{bonusText(element)}
				</span>
			{:else if element.lines.length}
				<span class="flex items-center gap-2 text-white/60">
					Glows
					{#each LIGHTS as [color] (color)}
						{#if lamp[color] > 0}
							<span class="flex items-center gap-1">
								<span
									class="size-1.5 rounded-full"
									style:background={LIGHT_HEX[color]}
								></span>
								+{rateText((lamp[color] / LAMP_PAYBACK_SECONDS) * gameManager.lightGain[color])}/s
							</span>
						{/if}
					{/each}
				</span>
			{/if}
			{#each elementGenerators(element.z) as type (type)}
				{@const Icon = ICONS[GENERATOR_ICON_NAMES[type]]}
				<span class={['flex items-center gap-1', stageKind === 'identified' ? 'text-white/80' : 'text-white/40']}>
					<Icon
						color="currentColor"
						size={13}
					/>
					+{ELEMENT_GENERATOR_PERCENT}% {GENERATORS[type].name} output
				</span>
			{/each}
			<span
				class="flex max-w-60 flex-wrap justify-center gap-1"
				title="{info.name}, a full family ×{SET_BONUS}"
			>
				{#each family as member (member.z)}
					<span
						class="size-1.5 rounded-full"
						style:background={periodicManager.identifiedSet.has(member.z) ? info.color : 'rgb(255 255 255 / 0.12)'}
						title={member.name}
					></span>
				{/each}
			</span>
		</div>

		<p class="mt-3 text-sm text-white/70">{lore.fact}</p>
		<button
			class="mt-2 rounded-full bg-white/6 px-2 py-0.5 text-xs transition-colors hover:bg-white/12"
			onclick={() => locate(siteId)}
			style:color={site.color}
			title="Show its source"
		>
			{site.glyph} from {site.name}
		</button>

		<button
			class="mt-3 flex w-full items-center gap-1 text-[11px] font-semibold tracking-wider text-white/40 uppercase hover:text-white/70"
			onclick={() => (scienceOpen = !scienceOpen)}
		>
			<ChevronDown
				class={['transition-transform', scienceOpen && 'rotate-180']}
				size={12}
			/>
			Science
		</button>
		{#if scienceOpen}
			<div class="mt-2 space-y-3 text-left text-xs">
				{#if !element.lines.length}
					<p class="rounded bg-[#0b0f1c] px-2 py-1.5 text-white/50">No lab has ever seen its light: it was identified by how it decays, so it costs Decay events.</p>
				{:else}
					<div>
						<div class="relative h-6 overflow-hidden rounded bg-[#0b0f1c]">
							<span
								class={['absolute inset-0', stageKind !== 'identified' && 'opacity-30']}
								style:background-image={spectrumGradient(element.lines)}
							></span>
						</div>
						<div class="relative h-3.5 text-[9px] text-white/35">
							{#each [400, 500, 600, 700] as nm (nm)}
								<span
									class="absolute -translate-x-1/2"
									style:left="{lineX(nm)}%"
								>
									{nm} nm
								</span>
							{/each}
						</div>
					</div>
				{/if}
				<p class="flex flex-wrap gap-x-3 text-[10px]">
					{#each element.origin as [id, share] (id)}
						<span style:color={SITES[id].color}>{SITES[id].glyph} {share < 0.01 ? '<1' : Math.round(share * 100)}% {SITES[id].name}</span>
					{/each}
				</p>
				<p class="font-mono text-white/70">{reactionOf(element)}</p>
				<p class="text-white/45">{lore.discovery}</p>
			</div>
		{/if}
	{/if}
{/snippet}

<div class="table-page absolute inset-0 z-30 flex flex-col overflow-hidden text-white">
	<header class="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 pt-3 sm:px-4">
		<div class="flex items-center gap-2.5">
			<p class="text-sm font-black tracking-widest uppercase max-lg:hidden">Periodic Table</p>
			<span class="h-1.5 w-16 overflow-hidden rounded-full bg-white/10 lg:w-28">
				<span
					class="block h-full origin-left bg-linear-to-r from-[#4dabf7] via-[#9775fa] to-[#ffd43b] transition-transform duration-500"
					style:transform="scaleX({identifiedCount / ELEMENT_COUNT})"
				></span>
			</span>
			<span class="text-xs font-bold tabular-nums">{identifiedCount}<span class="text-white/40">/{ELEMENT_COUNT}</span></span>
		</div>
		<div
			class="flex flex-wrap items-center gap-1.5 text-xs max-lg:order-last max-lg:w-full"
			data-hint="table-lights"
		>
			<span class="flex items-center gap-1.5 rounded-full bg-white/6 px-2.5 py-1 text-sm font-semibold text-[#cfe8ff] tabular-nums">
				<Currency
					name={CurrenciesTypes.STARLIGHT}
					size={16}
				/>
				{formatNumber(starlight)}
			</span>
			{#each LIGHTS as [color, name] (color)}
				{@render lightPill(color, name, lights[color], undefined, gameManager.passiveLight[color])}
			{/each}
			{#if periodicManager.decayEventsPerSecond > 0 || decayEvents > 0}
				{@render lightPill('decay', CurrenciesTypes.DECAY_EVENTS, decayEvents)}
			{/if}
		</div>
		<div class="ml-auto flex items-center gap-2">
			{#if ready.length}
				<button
					class="flex items-center gap-1.5 rounded-full bg-amber-300 px-3 py-1.5 text-xs font-black text-[#05070f] transition-transform hover:scale-105"
					onclick={() => (selected = ready.find(other => other > selected) ?? ready[0])}
					in:scale
				>
					{ready.length} READY
				</button>
			{/if}
			<button
				class="grid size-9 place-items-center rounded-lg border border-accent-500/30 bg-accent-900/80 text-accent-300 transition-colors hover:bg-accent-800"
				aria-label="Back to the sky"
				onclick={onClose}
			>
				<X size={16} />
			</button>
		</div>
	</header>

	<div class="shrink-0 overflow-x-auto px-3 pt-3 pb-1 [scrollbar-width:none] sm:px-4">
		{@render sky()}
	</div>

	<!-- Desktop: the table and the element's atom side by side, fixed heights so nothing that grows over a run adds a scrollbar. -->
	<main class="flex min-h-0 flex-1 flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-5 lg:px-4 lg:pt-2 lg:pb-4">
		<section class="relative min-h-0 flex-1 overflow-hidden">
			{#if mobile.current}
				<div
					class="absolute inset-0 touch-none overflow-hidden"
					{@attach panZoom.attach}
				>
					<div
						class={['absolute top-0 left-0 origin-top-left', panZoom.moving && 'will-change-transform']}
						style:transform="translate({panZoom.x}px, {panZoom.y}px) scale({panZoom.zoom})"
					>
						{@render table()}
					</div>
				</div>
			{:else}
				<!-- Size containment lets the table scale to whichever of the width or the height runs out first. -->
				<div
					class="h-full pt-2"
					style:container-type="size"
				>
					{@render table()}
					<!-- What the identified elements give, one discreet line per family that has started. -->
					<div
						class="mx-auto mt-4 flex flex-wrap justify-center gap-x-5 gap-y-1.5"
						style:width={TABLE_WIDTH}
					>
						{#each FAMILY_IDS as family (family)}
							{@const info = FAMILIES[family]}
							{@const members = ELEMENTS.filter(other => other.family === family)}
							{@const count = members.filter(other => periodicManager.identifiedSet.has(other.z)).length}
							{#if count}
								<span
									class="flex items-center gap-1.5 text-xs"
									title="{info.name}: {count}/{members.length} identified, a full family ×{SET_BONUS}"
									in:scale={{ start: 0.85 }}
								>
									<span style:color={info.color}>
										{#if count === members.length}
											<Star
												class="fill-amber-300 text-amber-300"
												size={14}
											/>
										{:else}
											{@render statIcon(info.stat, 14)}
										{/if}
									</span>
									<span class="font-bold tabular-nums">+{count * info.step}%</span>
									<span class="text-white/45">{family === 'lanthanide' ? 'Light gain' : STAT_LABELS[info.stat]}</span>
								</span>
							{/if}
						{/each}
					</div>
				</div>
			{/if}
		</section>

		<!-- Element atom: side panel on desktop, bottom sheet on phones so it never covers the selected cell. -->
		<aside
			class="max-h-[44dvh] shrink-0 overflow-y-auto rounded-t-2xl border-t border-white/10 bg-linear-to-b from-[#0d1226]/95 to-[#070a16]/95 p-4 shadow-2xl lg:max-h-full lg:self-start lg:rounded-2xl lg:border"
		>
			{@render card()}
		</aside>
	</main>

	<!-- The identify moment, built from the element's own spectrum, so every element plays a different one. -->
	{#if reveal}
		{@const target = reveal.element}
		{@const color = FAMILIES[target.family].color}
		{#key reveal.id}
			<div
				class="pointer-events-none fixed top-[16%] left-1/2 z-55 w-[min(26rem,calc(100vw-2rem))] -translate-x-1/2"
				data-reveal={reveal.id}
				in:scale={{ duration: 350, start: 0.85 }}
				out:fade={{ duration: 300 }}
			>
				<div
					class="rounded-2xl border bg-[#05070f]/92 p-5 text-center shadow-2xl"
					style:border-color="color-mix(in srgb, {color} 45%, transparent)"
					style:box-shadow="0 0 60px -12px {color}"
				>
					<p class="text-[10px] font-bold tracking-[0.35em] text-white/45 uppercase">Reading its light</p>
					<p
						class="reveal-symbol mt-1 text-6xl font-black"
						style:color
						style:text-shadow="0 0 24px {color}"
					>
						{target.symbol}
					</p>
					<p class="text-lg font-bold">{target.name}</p>
					<div class="relative mt-4 h-14 overflow-hidden rounded-lg bg-black">
						<span
							class="reveal-rainbow absolute inset-0 origin-left"
							style:background-image={SPECTRUM}
						></span>
						{#each target.lines.toSorted((a, b) => a - b) as nm, i (nm)}
							<span
								class="reveal-line absolute inset-y-0 w-0.75 -translate-x-1/2"
								style:animation-delay="{REVEAL_LINES_AT + i * REVEAL_LINE_STEP}ms"
								style:background={wavelengthColor(nm)}
								style:box-shadow="0 0 10px 2px {wavelengthColor(nm)}"
								style:left="{lineX(nm)}%"
								data-line={nm}
							></span>
						{/each}
					</div>
					<div class="mt-1 flex justify-between text-[9px] text-white/30 tabular-nums">
						<span>380 nm</span>
						<span>{target.lines.length ? `${target.lines.length} lines` : 'never measured'}</span>
						<span>780 nm</span>
					</div>
					<p
						class="reveal-late mt-3 font-bold"
						style:animation-delay="{REVEAL_LINES_AT + target.lines.length * REVEAL_LINE_STEP}ms"
						style:color
					>
						{bonusText(target)}
					</p>
					<p
						class="reveal-late mt-1 font-mono text-xs text-white/50"
						style:animation-delay="{REVEAL_LINES_AT + target.lines.length * REVEAL_LINE_STEP + 150}ms"
					>
						{reactionOf(target)}
					</p>
				</div>
			</div>
		{/key}
	{/if}

	<div class="pointer-events-none fixed bottom-4 left-1/2 z-55 flex -translate-x-1/2 flex-col items-center gap-1.5 max-lg:bottom-[calc(44dvh+1rem)]">
		{#each toasts as item (item.id)}
			<p
				class="rounded-full border border-white/10 bg-accent-950/95 px-3 py-1.5 text-xs font-semibold whitespace-nowrap shadow-xl"
				style:color={item.color}
				in:fly={{ duration: 250, y: -12 }}
				out:fly={{ duration: 200, y: -12 }}
			>
				{item.text}
			</p>
		{/each}
	</div>
</div>

<style>
	.table-page {
		background:
			radial-gradient(1px 1px at 12% 18%, #fff9, transparent),
			radial-gradient(1px 1px at 33% 72%, #fff7, transparent),
			radial-gradient(1.5px 1.5px at 58% 26%, #fffa, transparent),
			radial-gradient(1px 1px at 77% 64%, #fff8, transparent),
			radial-gradient(1px 1px at 88% 12%, #fff6, transparent),
			radial-gradient(1.5px 1.5px at 22% 88%, #fff8, transparent),
			radial-gradient(60% 50% at 75% 0%, #2a1d5a55, transparent),
			radial-gradient(50% 40% at 10% 100%, #10305a55, transparent),
			#05070f;
	}

	/** Progress lands on the 1 s tick, a 1 s linear glide between ticks makes it read as continuous. */
	.smooth {
		transition: stroke-dashoffset 1s linear;
	}

	/** Only the sources forging right now breathe, a handful at most, on transform. */
	@media (prefers-reduced-motion: no-preference) {
		.breathe {
			animation: breathe 3.2s ease-in-out infinite;
		}

		.hold-call {
			animation: hold-call 1.6s ease-in-out infinite;
		}
	}

	@keyframes breathe {
		50% {
			transform: scale(1.07);
		}
	}

	@keyframes hold-call {
		50% {
			opacity: 0.55;
		}
	}

	/** Reveal timeline: the rainbow sweeps in and fades, the element's lines light one by one, then the bonus and reaction. */
	.reveal-rainbow {
		animation: rainbow 1s ease-out both;
	}

	@keyframes rainbow {
		0% {
			opacity: 1;
			transform: scaleX(0);
		}
		45% {
			opacity: 1;
			transform: scaleX(1);
		}
		65% {
			opacity: 1;
		}
		100% {
			opacity: 0.07;
			transform: scaleX(1);
		}
	}

	.reveal-line {
		animation: line 0.35s cubic-bezier(0.3, 1.6, 0.5, 1) both;
	}

	@keyframes line {
		from {
			opacity: 0;
			transform: translateX(-50%) scaleY(0);
		}
		to {
			opacity: 1;
			transform: translateX(-50%) scaleY(1);
		}
	}

	.reveal-symbol {
		animation: symbol 0.6s cubic-bezier(0.3, 1.6, 0.5, 1) both;
	}

	@keyframes symbol {
		from {
			opacity: 0;
			transform: scale(0.5);
		}
		to {
			opacity: 1;
			transform: scale(1);
		}
	}

	.reveal-late {
		animation: late 0.4s ease-out both;
	}

	@keyframes late {
		from {
			opacity: 0;
			transform: translateY(6px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.reward-pop {
		animation: rise 1.4s ease-out forwards;
	}

	@keyframes rise {
		0% {
			opacity: 0;
			transform: translate(-50%, 8px) scale(0.8);
		}
		15% {
			opacity: 1;
			transform: translate(-50%, 0) scale(1.1);
		}
		80% {
			opacity: 1;
		}
		100% {
			opacity: 0;
			transform: translate(-50%, -18px) scale(1);
		}
	}
</style>
