<script lang="ts">
	import AtomStage from '#components/cosmos/periodic/AtomStage.svelte';
	import { MINI_NUCLEONS, nucleonsOf, paintNucleus, type StageKind } from '#components/cosmos/periodic/atoms.js';
	import SourceArt from '#components/cosmos/periodic/SourceArt.svelte';
	import { SPECTRUM } from '#components/cosmos/periodic/sky.js';
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
		wavelengthHex,
	} from '#data/elements.js';
	import { GENERATORS } from '#data/generators.js';
	import { GENERATOR_ICON_NAMES } from '#data/iconNames.js';
	import { ICONS } from '#data/icons.js';
	import { CHAINS, DECAY_EVENTS_PER_SECOND, DECAY_SITES, FORGED_BY, MAX_UNREAD, reactionOf, SITE_IDS, siteStudyCost, SITES, type SiteId } from '#data/sites.js';
	import { particlesEnabled, pixelRatio } from '#helpers/CanvasLoop.js';
	import { cosmosManager } from '#helpers/CosmosManager.svelte.js';
	import { currenciesManager } from '#helpers/CurrenciesManager.svelte.js';
	import { gameManager } from '#helpers/GameManager.svelte.js';
	import { PanZoom } from '#helpers/PanZoom.svelte.js';
	import { periodicManager, type SiteStatus } from '#helpers/PeriodicManager.svelte.js';
	import { realmManager } from '#helpers/RealmManager.svelte.js';
	import { reveal as revealIn } from '#helpers/reveals.svelte.js';
	import type { EffectStat } from '#lib/types.js';
	import { formatNumber } from '#lib/utils.js';
	import { ui } from '#stores/ui.svelte.js';
	import { mobile } from '#stores/window.svelte.js';
	import { ChevronDown, ChevronRight, ChevronsUp, CircleHelp, Cog, Factory, Lock, MousePointerClick, Shield, Star, X, Zap } from '@lucide/svelte';
	import { tick, untrack, type Component } from 'svelte';
	import { MediaQuery, SvelteMap, SvelteSet } from 'svelte/reactivity';
	import { fade, fly, scale } from 'svelte/transition';

	interface Props {
		onClose: () => void;
	}

	let { onClose }: Props = $props();

	type StatIcon = Component<{ size?: number }> | CurrencyName;
	/** The right panel shows either an element or a source. */
	type Selection = { kind: 'element'; z: number } | { id: SiteId; kind: 'site' };
	type ChipKind = 'forged' | 'forging' | 'later' | 'waiting';

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
	/** 56px is the bonus line's height under the table, 16px leaves room for a selected cell's outline. */
	const TABLE_WIDTH = 'min(100cqw - 16px, (100cqh - 56px) * 1.68 - 16px)';
	const CELL = 44;
	const GAP = 4;
	const GRID = new Map(ELEMENTS.map(({ column, row, z }) => [`${row},${column}`, z]));
	const RAINBOW = 'linear-gradient(90deg, transparent, #ff4d5e, #ffd76b, #2ee6a0, #4d8dff, #b98aff, transparent)';
	/** Open sources keep their place whether they hold a forge or not, so assigning one never makes it jump. */
	const RANK: Record<SiteStatus['kind'], number> = { done: 1, forging: 0, full: 0, idle: 0, locked: 2, waiting: 0 };
	const REVEAL_LINES_AT = 700;
	const REVEAL_LINE_STEP = 140;
	const GOAL_STEPS = ['Start a forge on a source', 'Read one with Light', 'Each one boosts the game'];
	const BOUNCE: Keyframe[] = [{ transform: 'scale(1)' }, { transform: 'scale(1.25)' }, { transform: 'scale(1)' }];

	/** Elements whose spectrum reveal still plays: identified only once its comets land. */
	const reading = new SvelteSet<number>();
	const pops = new SvelteMap<number, string>();
	let atoms = $state.raw<TableAtoms | null>(null);
	let particles: TableParticles | null = null;
	let reveal = $state.raw<{ element: Element; id: number } | null>(null);
	let revealId = 0;
	let scienceOpen = $state(false);
	const timers = new Set<ReturnType<typeof setTimeout>>();
	let toasts = $state<{ color: string; id: number; text: string }[]>([]);
	let toastId = 0;

	const lights = $derived(Object.fromEntries(LIGHTS.map(([color, name]) => [color, currenciesManager.getAmount(name)])) as Record<LightColor, number>);
	const decayEvents = $derived(currenciesManager.getAmount(CurrenciesTypes.DECAY_EVENTS));
	const starlight = $derived(currenciesManager.getAmount(CurrenciesTypes.STARLIGHT));
	const sites = $derived(SITE_IDS.map(id => ({ id, site: SITES[id], status: periodicManager.statuses[id] })).toSorted((a, b) => RANK[a.status.kind] - RANK[b.status.kind]));

	/** Whether `z` has a cell, the rule of `looks` below, usable before it exists. */
	const onGrid = (z: number) => periodicManager.forged.has(z) || Object.values(periodicManager.statuses).some(status => 'z' in status && status.z === z);

	/** A focus asked by the opener, else a ready element, else with no forge placed the first source that can start, else the forging element closest to done. */
	function opening(): Selection {
		const asked = realmManager.tableFocus ?? periodicManager.ready[0];
		if (asked !== undefined) return onGrid(asked) ? { kind: 'element', z: asked } : { id: FORGED_BY[asked], kind: 'site' };
		const idle = sites.filter(({ status }) => status.kind === 'idle');
		const first = idle.find(({ status }) => status.kind === 'idle' && !status.missing.length && !status.object) ?? idle[0];
		if (!periodicManager.active.length && first) return { id: first.id, kind: 'site' };
		const next = sites.filter(({ status }) => status.kind === 'forging').toSorted((a, b) => periodicManager.etaOf(a.id) - periodicManager.etaOf(b.id))[0];
		return next && 'z' in next.status ? { kind: 'element', z: next.status.z } : { id: sites.find(({ status }) => status.kind !== 'locked')?.id ?? 'bigbang', kind: 'site' };
	}

	let selection = $state.raw<Selection>(untrack(opening));
	const selected = $derived(selection.kind === 'element' ? selection.z : null);
	const select = (z: number) => (selection = { kind: 'element', z });
	const ready = $derived(periodicManager.ready.filter(z => !reading.has(z)));
	const identifiedCount = $derived(periodicManager.identified.length - reading.size);
	const found = $derived(periodicManager.identified.length > 0);
	const hasForged = $derived(periodicManager.forged.size > 0);
	const showDecay = $derived(periodicManager.decayEventsPerSecond > 0 || decayEvents > 0);
	const showLights = $derived(periodicManager.ready.length > 0 || found);

	const looks = $derived.by(() => {
		const map = new Map<number, CellLook>();
		for (const { site, status } of sites) {
			if (status.kind === 'forging') map.set(status.z, { color: site.color, kind: 'forging', progress: status.progress / ELEMENTS[status.z - 1].need });
			else if (status.kind === 'full' || status.kind === 'idle' || status.kind === 'waiting') map.set(status.z, { kind: 'waiting' });
		}
		for (const z of periodicManager.forged) {
			const kind = reading.has(z) ? 'reading' : periodicManager.identifiedSet.has(z) ? 'identified' : 'ready';
			const { family, lines } = ELEMENTS[z - 1];
			map.set(z, { color: FAMILIES[family].color, ...(kind === 'identified' && lines.length > 0 && { glow: wavelengthHex(lines[0]) }), kind });
		}
		return map;
	});

	/** One character per element, `g` for a cell on or next to a known one and `h` for hidden. A string, so the grid only updates when a ghost appears. */
	const fog = $derived.by(() => {
		const marks = Array.from({ length: ELEMENT_COUNT }, () => 'h');
		for (const z of looks.keys()) {
			const { column, row } = ELEMENTS[z - 1];
			for (let dRow = -1; dRow <= 1; dRow++)
				for (let dColumn = -1; dColumn <= 1; dColumn++) {
					const near = GRID.get(`${row + dRow},${column + dColumn}`);
					if (near) marks[near - 1] = 'g';
				}
		}
		return marks.join('');
	});

	const element = $derived(ELEMENTS[(selected ?? 1) - 1]);
	const stageKind = $derived((selected === null ? null : (looks.get(selected)?.kind ?? null)) as StageKind | null);
	const forgingOf = (z: number) => sites.find(({ status }) => status.kind === 'forging' && status.z === z);
	/** Cells of the selected source's chain, outlined on the grid. */
	const chain = $derived(selection.kind === 'site' ? new Set(CHAINS[selection.id].steps) : null);
	const chainColor = $derived(selection.kind === 'site' ? SITES[selection.id].color : undefined);
	/** 1 while nothing is ready to read, 2 once something is. */
	const goalStep = $derived(periodicManager.ready.length ? 2 : 1);
	/** Tall desktop screens stack the atom above its name, shorter ones keep it beside it so the card never needs a scrollbar. */
	const tall = new MediaQuery('(min-height: 860px)');
	const stacked = $derived(!mobile.current && tall.current);

	$effect(() => atoms?.set(looks));

	/** The Table covers the screen itself, so `ui.covered` can't tell a modal opened over it: the grid's loop stops while one is open. */
	$effect(() => atoms?.setActive(ui.activeModal === null && !realmManager.introPlaying));

	$effect(() => () => {
		for (const timer of timers) clearTimeout(timer);
		timers.clear();
	});

	/** A timeout of the reveal and the toasts, cleared with the Table so none fires on a destroyed canvas. */
	function schedule(run: () => void, ms: number) {
		const timer = setTimeout(() => {
			timers.delete(timer);
			run();
		}, ms);
		timers.add(timer);
	}

	/** A focus asked while the Table is already open lands here too, one that opened it was already read by `selection`. */
	$effect(() => {
		const focus = realmManager.tableFocus;
		if (focus === null) return;
		pick(focus);
		realmManager.tableFocus = null;
	});

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

	const shownNucleons = (z: number, progress: number) => Math.floor(progress * Math.min(MINI_NUCLEONS, nucleonsOf(z)));

	/** Takes the nucleon count and not the progress, so the canvas only repaints when the drawing changes. */
	function forgeNucleus(shown: number, color: string) {
		return (canvas: HTMLCanvasElement) => {
			const size = Math.round(canvas.clientWidth * pixelRatio());
			canvas.width = canvas.height = size;
			const ctx = canvas.getContext('2d');
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
		schedule(() => (toasts = toasts.filter(other => other.id !== id)), 2800);
	}

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
			schedule(() => to && particles?.burst(to, [color, '#ffffff'], 18), 900);
			toast(`${SITES[id].glyph} ${ELEMENTS[z - 1].name} is ready to identify`, color);
		}
	});

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

	function locate(id: SiteId) {
		const source = document.querySelector(`[data-forge="${id}"]`);
		source?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
		source?.animate(BOUNCE, { delay: 300, duration: 400, easing: 'ease-out' });
	}

	/** Whether a forge can go to this source now: a free one, or the only one there is. */
	const canAssign = () => periodicManager.freeForges > 0 || periodicManager.forges === 1;

	function assign(id: SiteId) {
		if (!periodicManager.assign(id)) return;
		const source = centerOf(`[data-forge="${id}"]`);
		if (source) particles?.burst(source, [SITES[id].color, '#ffffff'], 18, { speed: 120 });
		document.querySelector(`[data-forge="${id}"]`)?.animate(BOUNCE, { duration: 400, easing: 'ease-out' });
	}

	function study(id: SiteId) {
		if (!periodicManager.study(id)) return;
		const source = centerOf(`[data-forge="${id}"]`);
		if (source) particles?.burst(source, [SITES[id].color, '#cfe8ff'], 24, { rise: true, speed: 140 });
		document.querySelector(`[data-forge="${id}"]`)?.animate(BOUNCE, { duration: 400, easing: 'ease-out' });
	}

	function studyGains(id: SiteId, kind: SiteStatus['kind']): string {
		return [
			...(kind === 'done' ? [] : [`×${periodicManager.forge(id).level + 2} synthesis speed`]),
			...(DECAY_SITES.includes(id) ? [`+${DECAY_EVENTS_PER_SECOND} Decay events/s`] : []),
		].join(', ');
	}

	/** Going from level L to L + 1 takes the rate from ×(L + 1) to ×(L + 2). */
	function speedUp(id: SiteId): string {
		const { level } = periodicManager.forge(id);
		return `×${+((level + 2) / (level + 1)).toFixed(2)}`;
	}

	/** The Starlight button only exists once something is forged, and for a source that forges or pays Decay events. */
	const canStudy = (id: SiteId, kind: SiteStatus['kind']) => hasForged && (kind === 'forging' || kind === 'full' || (kind !== 'locked' && DECAY_SITES.includes(id)));

	function openCosmos(objectId?: string) {
		onClose();
		realmManager.openCosmos(objectId);
	}

	let cardShift = $state(0);

	/** Centers the card on the page height, held under the sources band when it is too tall to sit there. */
	function centerOnPage(wrapper: HTMLElement) {
		const card = wrapper.firstElementChild as HTMLElement;
		const place = () => {
			const room = wrapper.clientHeight - card.offsetHeight;
			cardShift = Math.max(0, Math.min(room, innerHeight / 2 - wrapper.getBoundingClientRect().top - card.offsetHeight / 2));
		};
		const observer = new ResizeObserver(place);
		observer.observe(wrapper);
		observer.observe(card);
		/** The Table slides in from below, a position read mid-slide is off by the slide. */
		const settled = setTimeout(place, 450);
		return () => {
			clearTimeout(settled);
			observer.disconnect();
		};
	}

	/** An element outside the grid (not forged yet) has no card, its source does. */
	function pick(z: number) {
		if (looks.has(z)) select(z);
		else selection = { id: FORGED_BY[z], kind: 'site' };
	}

	function chipKind(z: number, status: SiteStatus): ChipKind {
		if (periodicManager.forged.has(z)) return 'forged';
		if (!('z' in status) || status.z !== z) return 'later';
		return status.kind === 'forging' ? 'forging' : 'waiting';
	}

	function eta(seconds: number): string {
		if (!Number.isFinite(seconds)) return 'stalled';
		if (seconds < 3600) return `~${Math.max(1, Math.round(seconds / 60))}m`;
		if (seconds < 86_400 * 2) return `~${Math.round(seconds / 3600)}h`;
		return `~${Math.round(seconds / 86_400)}d`;
	}

	/** A save forged past the cap before it existed holds more unread elements than the cap, and needs several reads. */
	function fullText(unread: number[]): string {
		if (unread.length === MAX_UNREAD) return `Read ${unread.map(z => ELEMENTS[z - 1].name).join(' or ')} to keep forging`;
		return `Read ${unread.length - MAX_UNREAD + 1} of its elements to keep forging`;
	}

	/** Lamp rates are tiny per element: two decimals would round most of them to 0. */
	const rateText = (rate: number) => (rate >= 0.01 ? formatNumber(rate) : rate.toPrecision(2));

	const bonusText = (target: Element) => `+${FAMILIES[target.family].step}% ${STAT_LABELS[elementStat(target)]}`;

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

	/** Pays up to `fraction` more of the reading cost and starts the reveal once the element is fully paid. Returns the share paid. */
	function pour(target: Element, fraction: number): number {
		const share = periodicManager.pour(target.z, fraction);
		if (share > 0 && periodicManager.identifiedSet.has(target.z)) read(target);
		return share;
	}

	function read(target: Element) {
		reading.add(target.z);
		const id = ++revealId;
		reveal = { element: target, id };
		const lines = target.lines.toSorted((a, b) => a - b);
		const launch = (i: number) => REVEAL_LINES_AT + i * REVEAL_LINE_STEP + 250;
		lines.forEach((nm, i) =>
			schedule(() => {
				const from = centerOf(`[data-reveal="${id}"] [data-line="${nm}"]`);
				const to = centerOf(`[data-cell="${target.z}"]`);
				if (from && to) particles?.comet(from, to, wavelengthColor(nm));
			}, launch(i)),
		);
		const landing = launch(lines.length - 1) + 900;
		schedule(() => lightUp(target, lines), landing);
		schedule(() => {
			if (reveal?.id === id) reveal = null;
		}, landing + 500);
	}

	function lightUp(target: Element, lines: number[]) {
		reading.delete(target.z);
		pops.set(target.z, bonusText(target));
		schedule(() => pops.delete(target.z), 1400);
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
			schedule(() => particles?.burst(at, [FAMILIES[target.family].color, '#ffffff'], 16, { speed: 90 }), 350);
		}

		const family = ELEMENTS.filter(other => other.family === target.family);
		if (family.every(other => periodicManager.identifiedSet.has(other.z))) {
			const info = FAMILIES[target.family];
			toast(`★ Set complete! ${info.name} ×${SET_BONUS}`, info.color);
			for (const other of family) {
				const delay = Math.hypot(other.row - target.row, other.column - target.column) * 70;
				document.querySelector(`[data-cell="${other.z}"] [data-wave]`)?.animate([{ opacity: 0 }, { opacity: 0.9 }, { opacity: 0 }], { delay, duration: 600 });
				schedule(() => {
					const point = centerOf(`[data-cell="${other.z}"]`);
					if (point) particles?.burst(point, [info.color, '#ffffff'], 10, { speed: 110 });
				}, delay);
			}
		}
		const next = ready.find(other => other !== target.z);
		if (next && !mobile.current && selected === target.z) schedule(() => selected === target.z && select(next), 1600);
	}

	/** Pans the table to the selected element, or to where the selected source works. */
	const anchor = $derived.by(() => {
		if (selection.kind === 'element') return selection.z;
		const status = periodicManager.statuses[selection.id];
		return 'z' in status ? status.z : status.kind === 'done' ? (CHAINS[selection.id].steps.at(-1) ?? 1) : 1;
	});
	const spotOf = (z: number) => ({ x: (ELEMENTS[z - 1].column - 0.5) * (CELL + GAP), y: (ELEMENTS[z - 1].row - 0.5) * (CELL + GAP) });
	/** One instance for the whole visit: a new one would snap the view back to the home zoom, even in the middle of a pinch. */
	const panZoom = new PanZoom({
		bounds: { maxX: 18 * (CELL + GAP), maxY: 10 * (CELL + GAP) + 12, minX: 0, minY: 0 },
		home: { ...untrack(() => spotOf(ready[0] ?? anchor)), zoom: 1.1 },
		maxZoom: 2.5,
		minZoom: 0.4,
	});

	/** Only a new selection moves the view, to its anchor and at the zoom the player chose. */
	let panned = untrack(() => selection);
	$effect(() => {
		const current = selection;
		if (current === panned) return;
		panned = current;
		const { x, y } = spotOf(untrack(() => anchor));
		panZoom.panTo(x, y, 150);
	});
</script>

{#snippet counter(light: LightColor | 'decay', name: CurrencyName, amount: number, rate: number)}
	{@const { color, name: label } = CURRENCIES[name]}
	<div
		class="flex flex-col items-center leading-tight"
		data-hint={light === 'decay' ? 'table-decay' : undefined}
		data-light={light}
	>
		<span
			class="flex items-center gap-1.5 text-lg font-black tabular-nums lg:text-3xl"
			style:color
			style:text-shadow="0 0 24px color-mix(in srgb, {color} 45%, transparent)"
		>
			<Currency
				{name}
				size={mobile.current ? 18 : 28}
			/>
			{formatNumber(amount)}
		</span>
		<span class="text-[10px] font-bold tracking-[0.3em] text-white/45 uppercase">{label}</span>
		{#if rate > 0}
			<span class="font-mono text-xs text-white/60 tabular-nums">+{rateText(rate)}/s</span>
		{/if}
	</div>
{/snippet}

{#snippet lightPill(name: CurrencyName, amount: number, need: number, small = false)}
	{@const shown = Math.ceil(need - 1e-6)}
	<span
		class={[
			'flex items-center rounded-full font-semibold tabular-nums',
			small ? 'gap-1 px-2 py-0.5 text-xs' : 'gap-1.5 px-2.5 py-1 text-sm',
			amount >= shown ? 'bg-white/10 text-white' : 'bg-red-500/15 text-red-300',
		]}
	>
		<Currency
			{name}
			size={small ? 13 : 16}
		/>
		{formatNumber(shown)}
	</span>
{/snippet}

{#snippet costPills(small: boolean)}
	{@const cost = periodicManager.costOf(element.z).light}
	{@const decayNeed = decayCost(element)}
	{@const left = 1 - (periodicManager.paid[element.z] ?? 0)}
	{#each LIGHTS as [color, name] (color)}
		{#if cost[color] > 0}
			{@render lightPill(name, lights[color], cost[color] * left, small)}
		{/if}
	{/each}
	{#if decayNeed > 0}
		{@render lightPill(CurrenciesTypes.DECAY_EVENTS, decayEvents, decayNeed * left, small)}
	{/if}
{/snippet}

{#snippet studyButton(id: SiteId)}
	{@const cost = siteStudyCost(periodicManager.forge(id).level)}
	<button
		class="inline-flex min-h-8 w-full items-center justify-center gap-1.5 rounded-full bg-accent-600/80 text-center text-xs font-bold whitespace-nowrap transition-colors enabled:hover:bg-accent-500 disabled:opacity-35"
		disabled={starlight < cost}
		onclick={() => study(id)}
		title="Study it: {studyGains(id, periodicManager.statuses[id].kind)}"
		in:revealIn
	>
		<Currency
			name={CurrenciesTypes.STARLIGHT}
			size={14}
		/>
		{formatNumber(cost)}
	</button>
{/snippet}

{#snippet studyBlock(id: SiteId, effect: string)}
	<div class="flex w-full flex-col gap-1 text-xs">
		<p class="flex items-baseline justify-between gap-3">
			<span class="font-bold whitespace-nowrap text-white/70">Study · Lv {periodicManager.forge(id).level}</span>
			<span class="text-right text-white/55">{effect}</span>
		</p>
		{@render studyButton(id)}
	</div>
{/snippet}

{#snippet assignControl(id: SiteId)}
	{#if canAssign()}
		<button
			class="inline-flex min-h-8 max-w-full items-center justify-center rounded-full bg-amber-300 px-4 text-center text-xs font-black whitespace-nowrap text-[#05070f] transition-colors hover:bg-amber-200"
			data-hint="table-start"
			onclick={() => assign(id)}
		>
			{periodicManager.freeForges === 0 ? 'Move the forge here' : 'Start forging'}
		</button>
	{:else}
		<button
			class="inline-flex min-h-8 max-w-full items-center justify-center rounded-full bg-white/8 px-4 text-center text-xs font-bold whitespace-nowrap text-white/40"
			disabled
		>
			All forges are busy
		</button>
		<span class="flex flex-wrap items-center gap-1 text-xs text-white/45">
			Stop one:
			{#each periodicManager.active as busy (busy)}
				<button
					class="rounded-full bg-white/6 px-2 py-0.5 font-semibold transition-colors hover:bg-white/12"
					onclick={() => (selection = { id: busy, kind: 'site' })}
					style:color={SITES[busy].color}
				>
					{SITES[busy].short}
				</button>
			{/each}
		</span>
	{/if}
{/snippet}

{#snippet needs(status: Pick<Extract<SiteStatus, { kind: 'waiting' }>, 'missing' | 'object'>)}
	<div class="flex flex-col items-start gap-1.5 text-xs">
		{#each status.missing as z (z)}
			{@const from = SITES[FORGED_BY[z]]}
			<button
				class="inline-flex min-h-8 max-w-full items-center justify-center gap-1.5 rounded-full bg-white/6 px-3 text-center whitespace-nowrap text-amber-200/90 transition-colors hover:bg-white/12"
				onclick={() => pick(z)}
			>
				<span class="truncate">
					Needs {ELEMENTS[z - 1].name} from
					<span style:color={from.color}>{from.short}</span>
				</span>
				<ChevronRight
					class="shrink-0"
					size={12}
				/>
			</button>
		{/each}
		{#if status.object}
			{@render cosmosButton(`Discover ${COSMOS_OBJECTS_BY_ID[status.object]?.name ?? 'it'}`)}
		{/if}
	</div>
{/snippet}

{#snippet unreadButtons(unread: number[])}
	<div class="flex flex-col items-start gap-1.5 text-xs">
		{#each unread.slice(0, 3) as z (z)}
			<button
				class="inline-flex min-h-8 max-w-full items-center justify-center gap-1.5 rounded-full bg-white/6 px-3 text-center whitespace-nowrap text-amber-200/90 transition-colors hover:bg-white/12"
				onclick={() => select(z)}
			>
				<span class="truncate">Read {ELEMENTS[z - 1].name}</span>
				<ChevronRight
					class="shrink-0"
					size={12}
				/>
			</button>
		{/each}
	</div>
{/snippet}

{#snippet cosmosButton(label: string, objectId?: string)}
	<button
		class="inline-flex min-h-8 max-w-full items-center justify-center gap-1.5 rounded-full bg-white/6 px-3 text-center text-xs whitespace-nowrap text-[#cfe8ff] transition-colors hover:bg-white/12"
		onclick={() => openCosmos(objectId)}
	>
		<span class="truncate">{label}</span>
		<ChevronRight
			class="shrink-0"
			size={12}
		/>
	</button>
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

{#snippet sky()}
	<div
		class="mx-auto flex w-max gap-1 px-2 lg:gap-3"
	>
		{#each sites.filter(({ status }) => status.kind !== 'locked') as { id, site, status } (id)}
			{@const level = periodicManager.forge(id).level}
			<div
				class="flex w-24 shrink-0 flex-col items-center gap-0.5 text-center lg:w-26"
				in:revealIn
			>
				<button
					class={[
						'relative grid size-16 shrink-0 cursor-pointer place-items-center rounded-full lg:size-20',
						selection.kind === 'site' && selection.id === id && 'outline-2 outline-offset-1 outline-white/80',
					]}
					aria-label={site.name}
					data-forge={id}
					data-hint={status.kind === 'waiting' ? 'table-waiting' : status.kind === 'full' ? 'table-full' : undefined}
					onclick={() => (selection = { id, kind: 'site' })}
					title={status.kind === 'locked' ? site.gate : site.name}
				>
					<span
						class={[
							'absolute inset-1.5 rounded-full',
							status.kind === 'forging' && 'breathe',
							status.kind === 'locked' && 'opacity-25 grayscale',
							status.kind === 'idle' && 'opacity-50 grayscale-50',
							status.kind === 'done' && 'opacity-60',
						]}
					>
						<SourceArt
							class="block size-full"
							{id}
						/>
					</span>
					{#if status.kind === 'forging'}
						{@const fraction = status.progress / ELEMENTS[status.z - 1].need}
						{@render progressRing(site.color, fraction, status.z)}
						{@const shown = shownNucleons(status.z, fraction)}
						<!-- `site` is rebuilt every forge tick, a plain const keeps the attachment from repainting with each one. -->
						{@const nucleusColor = site.color}
						{#if shown > 0}
							<span class="absolute -right-1 -bottom-1 size-7 rounded-full bg-[#05070f] ring-1 ring-white/15">
								<canvas
									class="inset-0.5 size-6"
									{@attach forgeNucleus(shown, nucleusColor)}
								></canvas>
							</span>
						{/if}
					{:else if status.kind === 'full' || status.kind === 'waiting'}
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
					{#if level > 0}
						<span
							class="absolute top-0 right-0 rounded-full bg-[#05070f] px-1.5 text-[10px] leading-4 font-bold tabular-nums ring-1 ring-white/15"
							style:color={site.color}
						>
							Lv {level}
						</span>
					{/if}
				</button>
				<span
					class="h-4 text-xs leading-4 font-bold whitespace-nowrap lg:text-[13px]"
					style:color={status.kind === 'locked' ? 'rgb(255 255 255 / 0.4)' : site.color}
					style:opacity={status.kind === 'idle' ? 0.6 : undefined}
				>
					{site.short}
				</span>
				<!-- One line at a fixed height so the band is as tall in every state, long texts are cut and complete in the title. -->
				<div class="h-4 w-full">
					{#if status.kind === 'forging'}
						<span class="block truncate text-[11px] leading-4 text-white/55 tabular-nums lg:text-xs">
							{ELEMENTS[status.z - 1].symbol} · {eta(periodicManager.etaOf(id))}
						</span>
					{:else if status.kind === 'waiting'}
						{@const need = status.missing.length ? `Needs ${status.missing.map(z => ELEMENTS[z - 1].symbol).join(', ')}` : `Needs ${COSMOS_OBJECTS_BY_ID[status.object ?? '']?.name ?? 'a discovery'}`}
						<span
							class="block truncate text-[11px] leading-4 text-amber-200/80 lg:text-xs"
							title={CHAINS[id].seeds[status.z]?.why ?? need}
						>
							{need}
						</span>
					{:else if status.kind === 'full'}
						<span
							class="block truncate text-[11px] leading-4 text-amber-200/80 lg:text-xs"
							title={fullText(status.unread)}
						>
							Full · {status.unread.slice(0, 3).map(z => ELEMENTS[z - 1].symbol).join(' ')}
						</span>
					{:else if status.kind === 'idle'}
						{@const unread = periodicManager.unreadOf(id)}
						{#if unread.length >= MAX_UNREAD}
							<span
								class="block truncate text-[11px] leading-4 text-amber-200/80 lg:text-xs"
								title={fullText(unread)}
							>
								Full
							</span>
						{:else}
							<span class="block truncate text-[11px] leading-4 text-white/45 lg:text-xs">Idle</span>
						{/if}
					{:else if status.kind === 'done'}
						<span class="block truncate text-[11px] leading-4 text-white/40 lg:text-xs">Complete</span>
					{:else}
						<span
							class="block truncate text-[11px] leading-4 text-white/40 lg:text-xs"
							title={site.gate}
						>
							{site.gate}
						</span>
					{/if}
				</div>
			</div>
		{/each}
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
			<!-- Every slot is the same button so the atoms canvas measures it once. -->
			<button
				class={[
					'relative flex aspect-square items-end justify-center rounded-md border pb-[4%] text-[10px] leading-none font-black transition-opacity duration-500 lg:text-[11px]',
					look ? 'cursor-pointer border-transparent hover:bg-white/5'
					: fog[cell.z - 1] === 'g' ? 'border-white/6'
					: 'border-white/4 opacity-0',
					selected === cell.z ? 'z-1 outline-2 outline-offset-1 outline-white/80'
					: look && chain?.has(cell.z) && 'outline-1 outline-offset-1',
				]}
				style:grid-column={cell.column}
				style:grid-row={cell.row}
				style:outline-color={selected !== cell.z && look && chain?.has(cell.z) ? chainColor : undefined}
				aria-label={look ? cell.name : undefined}
				data-cell={cell.z}
				disabled={!look}
				onclick={() => select(cell.z)}
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
						in:fade={{ duration: 500 }}
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

{#snippet goal()}
	<ol class="mb-3 grid grid-cols-3 gap-2 text-[10px] leading-tight">
		{#each GOAL_STEPS as label, i (label)}
			{@const step = i + 1}
			<li class={['flex items-start gap-1', step === goalStep ? 'font-bold text-white' : step < goalStep ? 'text-white/55' : 'text-white/30']}>
				<span class={['grid size-3.5 shrink-0 place-items-center rounded-full text-[9px] font-black', step === goalStep ? 'bg-amber-300 text-[#05070f]' : 'bg-white/10']}>{step}</span>
				{label}
			</li>
		{/each}
	</ol>
{/snippet}

{#snippet sourceCard(id: SiteId)}
	{@const site = SITES[id]}
	{@const status = periodicManager.statuses[id]}
	{@const level = periodicManager.forge(id).level}
	{@const steps = CHAINS[id].steps}
	<div class="flex items-center gap-3">
		<SourceArt
			class={status.kind === 'locked' ? 'size-20 shrink-0 opacity-40 grayscale' : 'size-20 shrink-0'}
			{id}
		/>
		<div class="min-w-0">
			<h2
				class="text-xl leading-tight font-black"
				style:color={status.kind === 'locked' ? undefined : site.color}
			>
				{site.name}
			</h2>
			<p class="text-xs text-white/45">{steps.filter(z => periodicManager.forged.has(z)).length}/{steps.length} elements forged</p>
		</div>
	</div>
	<p class="mt-3 text-sm leading-snug text-white/70">{site.blurb}</p>
	<div class="mt-3 flex flex-col items-start gap-1.5">
		{#if status.kind === 'forging'}
			<p
				class="text-sm font-bold"
				style:color={site.color}
			>
				{site.glyph} Forging {ELEMENTS[status.z - 1].name} · {Math.floor((status.progress / ELEMENTS[status.z - 1].need) * 100)}% · {eta(periodicManager.etaOf(id))}
			</p>
		{:else if status.kind === 'full'}
			<p class="text-sm text-amber-200/90">{fullText(status.unread)}</p>
			{@render unreadButtons(status.unread)}
		{:else if status.kind === 'waiting'}
			{@render needs(status)}
		{:else if status.kind === 'idle'}
			{@const unread = periodicManager.unreadOf(id)}
			<p class="text-sm text-white/60">Idle, next is {ELEMENTS[status.z - 1].name}</p>
			{#if unread.length >= MAX_UNREAD}
				<p class="text-sm text-amber-200/90">Full: {fullText(unread)}</p>
				{@render unreadButtons(unread)}
			{/if}
			{#if status.missing.length || status.object}
				{@render needs(status)}
			{/if}
		{:else if status.kind === 'done'}
			<p class="text-sm text-white/45">Complete</p>
		{:else}
			<p class="text-sm text-white/60">{site.gate}</p>
			{#if site.object}
				{@render cosmosButton('Open the Cosmos')}
			{/if}
		{/if}
		{#if site.object && cosmosManager.unlocked && cosmosManager.discovered.includes(site.object)}
			{@render cosmosButton('Show in the Cosmos', site.object)}
		{/if}
	</div>
	{#if status.kind === 'idle'}
		<div class="mt-3 flex flex-col items-start gap-1.5">
			{@render assignControl(id)}
		</div>
	{:else if status.kind === 'forging' || status.kind === 'full' || status.kind === 'waiting'}
		<button
			class="mt-3 inline-flex min-h-8 max-w-full items-center justify-center rounded-full bg-white/10 px-4 text-center text-xs font-bold whitespace-nowrap transition-colors hover:bg-white/15 self-start"
			onclick={() => periodicManager.release(id)}
		>
			Stop
		</button>
	{/if}
	<div class="mt-3 flex flex-wrap gap-0.5">
		{#each steps as z (z)}
			{@const kind = chipKind(z, status)}
			{@const member = ELEMENTS[z - 1]}
			<button
				class={[
					'flex h-6 min-w-6 items-center justify-center gap-0.5 rounded px-1 text-[11px] font-black transition-colors',
					kind === 'later' ? 'text-white/20' : 'cursor-pointer hover:bg-white/10',
					kind === 'waiting' && 'text-white/40',
				]}
				style:color={kind === 'forged' ? FAMILIES[member.family].color : kind === 'forging' ? site.color : undefined}
				disabled={kind === 'later'}
				onclick={() => select(z)}
				title={member.name}
			>
				{member.symbol}
				{#if kind === 'forging' && status.kind === 'forging'}
					<span class="text-[9px] font-semibold tabular-nums opacity-70">{Math.floor((status.progress / member.need) * 100)}%</span>
				{/if}
			</button>
		{/each}
	</div>
	{#if status.kind !== 'locked'}
		<div class="mt-3">
			{#if canStudy(id, status.kind)}
				{@render studyBlock(id, studyGains(id, status.kind))}
			{:else}
				<p class="text-xs text-white/45">Study · Lv {level}</p>
			{/if}
		</div>
	{/if}
{/snippet}

{#snippet card()}
	{#if !found}
		{@render goal()}
	{/if}
	{#if selection.kind === 'site'}
		{@render sourceCard(selection.id)}
	{:else}
		{@render elementCard()}
	{/if}
{/snippet}

{#snippet elementCard()}
	{@const info = FAMILIES[element.family]}
	{@const family = ELEMENTS.filter(other => other.family === element.family)}
	{@const lamp = lightCost(element)}
	{@const decayNeed = decayCost(element)}
	{@const siteId = FORGED_BY[element.z]}
	{@const site = SITES[siteId]}
	{@const lore = LORE[element.symbol]}
	{@const fill = forgingOf(element.z)}
	{@const paid = periodicManager.paid[element.z] ?? 0}
	{@const payable = periodicManager.canPour(element.z)}
	{@const stat = elementStat(element)}
	{#if stageKind}
		<div class={['flex items-center gap-4', stacked && 'flex-col gap-2 text-center']}>
			<div
				class="shrink-0"
				data-hint="table-stage"
			>
				<AtomStage
					class={stacked ? 'size-[clamp(6rem,calc(100cqh-400px),13rem)]' : 'size-28 lg:size-[clamp(6rem,calc(100cqh-320px),8rem)]'}
					color={info.color}
					kind={stageKind}
					onfeed={center => feed(element, center)}
					onpour={fraction => pour(element, fraction)}
					onrefuse={() => toast(decayNeed > 0 ? 'Not enough Decay events yet' : 'Not enough Light to read it yet', '#ff8a8a')}
					{paid}
					{payable}
					progress={fill && fill.status.kind === 'forging' ? fill.status.progress / element.need : 0}
					siteColor={site.color}
					z={element.z}
				/>
			</div>
			<div class="min-w-0">
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
						stageKind === 'ready' && (payable ? 'text-white' : 'text-red-300'),
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
						{payable ? 'Hold the atom to read its light' : decayNeed > 0 ? 'Not enough Decay events yet' : 'Not enough Light yet'}
						{#if paid > 0}
							<span class="font-normal text-white/50">· {Math.floor(paid * 100)}% read</span>
						{/if}
					{:else if stageKind === 'forging'}
						{site.glyph} Forged by {site.short} · {Math.floor((fill && fill.status.kind === 'forging' ? fill.status.progress / element.need : 0) * 100)}% ·
						{eta(periodicManager.etaOf(siteId))}
					{:else}
						{@const sourceKind = periodicManager.statuses[siteId].kind}
						{sourceKind === 'idle' ? 'Its source is idle' : sourceKind === 'full' ? 'Its source is full' : "Can't start yet"}
					{/if}
				</p>
			</div>
		</div>

		{#if stageKind === 'ready'}
			<div class={['mt-3 flex flex-wrap gap-1.5 text-xs', stacked && 'justify-center']}>
				{@render costPills(false)}
			</div>
			{#if periodicManager.tuned && element.lines.length}
				<div class={['mt-3 flex', stacked && 'justify-center']}>
					<TuningStrip {element} />
				</div>
			{/if}
		{:else if stageKind === 'forging'}
			<div class={['mt-3 flex flex-col gap-2', stacked ? 'items-center' : 'items-start']}>
				{#if hasForged}
					{@render studyBlock(siteId, `Speed up ${speedUp(siteId)}`)}
				{/if}
				<div class="flex flex-wrap items-center gap-1.5 text-xs text-white/45">
					Reading costs
					{@render costPills(true)}
				</div>
			</div>
		{:else if stageKind === 'waiting'}
			{@const status = periodicManager.statuses[siteId]}
			{#if status.kind === 'full'}
				<div class={['mt-3 flex flex-col gap-1.5', stacked ? 'items-center' : 'items-start']}>
					<p class="text-xs text-amber-200/90">{fullText(status.unread)}</p>
					{@render unreadButtons(status.unread)}
				</div>
			{:else if status.kind === 'waiting' || status.kind === 'idle'}
				<div class={['mt-3 flex flex-col gap-1.5', stacked ? 'items-center' : 'items-start']}>
					{#if status.kind === 'idle'}
						{@render assignControl(siteId)}
					{/if}
					{#if status.missing.length || status.object}
						{@render needs(status)}
					{/if}
				</div>
			{/if}
		{/if}

		<div class={['mt-3 flex flex-col gap-1 text-xs', stacked ? 'items-center' : 'items-start']}>
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
				class={['flex max-w-60 flex-wrap gap-1', stacked && 'justify-center']}
				data-hint="table-family"
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

		<p class={['mt-3 text-sm leading-snug text-white/70', stacked && 'text-center']}>{lore.fact}</p>
		<div class="mt-3 flex items-center justify-between gap-2">
			<button
				class="rounded-full bg-white/6 px-2 py-0.5 text-xs transition-colors hover:bg-white/12"
				onclick={() => {
					selection = { id: siteId, kind: 'site' };
					locate(siteId);
				}}
				style:color={site.color}
				title="Open its source"
			>
				{site.glyph} from {site.name}
			</button>
			{#if found}
				<button
					class="flex items-center gap-1 text-[11px] font-semibold tracking-wider text-white/40 uppercase hover:text-white/70"
					onclick={() => (scienceOpen = !scienceOpen)}
					in:revealIn
				>
					<ChevronDown
						class={['transition-transform', scienceOpen && 'rotate-180']}
						size={12}
					/>
					Science
				</button>
			{/if}
		</div>
		{#if found && scienceOpen}
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
	<header class="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 pt-3 sm:px-4">
		<div class="flex items-center gap-2.5 lg:flex-1">
			{#if identifiedCount > 0}
				<div
					class="flex items-center gap-2.5"
					in:revealIn
				>
					<span class="h-1.5 w-16 overflow-hidden rounded-full bg-white/10 lg:w-28">
						<span
							class="block h-full origin-left bg-linear-to-r from-[#4dabf7] via-[#9775fa] to-[#ffd43b] transition-transform duration-500"
							style:transform="scaleX({identifiedCount / ELEMENT_COUNT})"
						></span>
					</span>
					<span class="text-xs font-bold tabular-nums">{identifiedCount}<span class="text-white/40">/{ELEMENT_COUNT}</span></span>
				</div>
			{/if}
		</div>
		{#if showLights || showDecay}
			<div
				class="flex flex-wrap items-start justify-center gap-x-10 gap-y-2 max-lg:order-last max-lg:w-full"
				data-hint="table-lights"
				in:revealIn
			>
				{#if showLights}
					<div
						class="grid w-full grid-cols-3 justify-items-center gap-x-3 lg:flex lg:w-auto lg:gap-10"
						in:revealIn
					>
						{#each LIGHTS as [color, name] (color)}
							{@render counter(color, name, lights[color], gameManager.passiveLight[color])}
						{/each}
					</div>
				{/if}
				{#if showDecay}
					<div in:revealIn>
						{@render counter('decay', CurrenciesTypes.DECAY_EVENTS, decayEvents, periodicManager.decayEventsPerSecond)}
					</div>
				{/if}
			</div>
		{/if}
		<div class="ml-auto flex items-center gap-2 lg:ml-0 lg:flex-1 lg:justify-end">
			{#if hasForged}
				<div
					class="mr-2 flex flex-col items-end leading-tight"
					in:revealIn
				>
					<span
						class="flex items-center gap-1.5 text-base font-black tabular-nums"
						style:color={CURRENCIES[CurrenciesTypes.STARLIGHT].color}
						style:text-shadow="0 0 18px color-mix(in srgb, {CURRENCIES[CurrenciesTypes.STARLIGHT].color} 45%, transparent)"
					>
						<Currency
							name={CurrenciesTypes.STARLIGHT}
							size={16}
						/>
						{formatNumber(starlight)}
					</span>
					<span class="text-[10px] font-bold tracking-[0.3em] text-white/45 uppercase">Starlight</span>
				</div>
			{/if}
			{#if ready.length}
				<button
					class="flex items-center gap-1.5 rounded-full bg-amber-300 px-3 py-1.5 text-xs font-black text-[#05070f] transition-transform hover:scale-105"
					onclick={() => select(ready.find(other => other > (selected ?? 0)) ?? ready[0])}
					in:scale
				>
					{ready.length} READY
				</button>
			{/if}
			<button
				class="grid size-9 place-items-center rounded-lg text-white/45 transition-colors hover:bg-white/8 hover:text-white"
				aria-label="Show the tips again"
				onclick={() => gameManager.tutorialManager.startTour('table:')}
				title="Show the tips again"
			>
				<CircleHelp size={16} />
			</button>
			<button
				class="grid size-9 place-items-center rounded-lg border border-accent-500/30 bg-accent-900/80 text-accent-300 transition-colors hover:bg-accent-800"
				aria-label="Close the Periodic Table"
				onclick={onClose}
			>
				<X size={16} />
			</button>
		</div>
	</header>

	<!-- Fixed heights so nothing that grows over a run adds a scrollbar. On desktop the sources are a short band over both columns, the table and the card share the area below. -->
	<main class="flex min-h-0 flex-1 flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:grid-rows-[auto_minmax(0,1fr)] lg:gap-x-5 lg:px-4 lg:pt-2 lg:pb-4">
		<div class="shrink-0 px-3 pt-2 pb-1 sm:px-4 lg:col-span-2 lg:row-start-1 lg:px-0 lg:pt-0">
			<div class="mb-1 flex h-8.5 flex-col items-center justify-center gap-1 text-[10px] leading-none lg:mb-0 lg:h-5 lg:flex-row lg:gap-x-4">
				<p class="flex items-baseline gap-2">
					<span class="font-bold tracking-[0.3em] text-white/55 uppercase">Sources</span>
					<span class="text-white/40">where elements are forged</span>
				</p>
				<div
					class="flex items-center gap-1.5"
					title="A source only advances while it holds a forge"
				>
					<span class="font-bold tracking-[0.2em] text-white/55 uppercase">Forges</span>
					<span class="flex gap-1">
						{#each { length: periodicManager.forges } as _, i (i)}
							<span class={['size-2 rounded-full', i < periodicManager.active.length ? 'bg-amber-300' : 'bg-white/20']}></span>
						{/each}
					</span>
					<span class="tabular-nums text-white/55">{periodicManager.active.length}/{periodicManager.forges}</span>
					{#if periodicManager.nextForgeUnlocked}
						<button
							class="flex h-5 items-center gap-1 rounded-full bg-accent-600/80 px-2 font-bold transition-colors enabled:hover:bg-accent-500 disabled:opacity-35"
							data-hint="table-new-forge"
							disabled={starlight < periodicManager.forgeCost}
							onclick={() => periodicManager.buyForge()}
							in:revealIn
						>
							New forge
							<Currency
								name={CurrenciesTypes.STARLIGHT}
								size={12}
							/>
							{formatNumber(periodicManager.forgeCost)}
						</button>
					{/if}
				</div>
			</div>
			<!-- The top padding is room for a source's bounce (scale 1.25 of a 64 or 80px disc, plus its outline), the scroller clips both axes. -->
			<div class="overflow-x-auto pt-3 [scrollbar-width:none]">
				{@render sky()}
			</div>
		</div>

		<section class="relative min-h-0 flex-1 overflow-hidden lg:col-start-1 lg:row-start-2">
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
				<!-- Size containment scales the table to whichever of width or height runs out first. -->
				<div
					class="h-full pt-2"
					style:container-type="size"
				>
					{@render table()}
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

		<!-- Bottom sheet on phones so it never covers the selected cell. -->
		<!-- On desktop the wrapper is the size container the atom scales with, and the card is centered on the page within it. -->
		<div
			class="shrink-0 lg:col-start-2 lg:row-start-2 lg:flex lg:min-h-0 lg:flex-col lg:[container-type:size]"
			{@attach centerOnPage}
		>
			<aside
				class="max-h-[44dvh] shrink-0 overflow-y-auto rounded-t-2xl border-t border-white/10 bg-linear-to-b from-[#0d1226]/95 to-[#070a16]/95 p-4 shadow-2xl lg:max-h-full lg:rounded-2xl lg:border"
				style:margin-top={mobile.current ? undefined : `${cardShift}px`}
			>
				{@render card()}
			</aside>
		</div>
	</main>

	{#if reveal}
		{@const target = reveal.element}
		{@const color = FAMILIES[target.family].color}
		{#key reveal.id}
			<!-- Global transitions: the card sits in a key block inside the if, so local ones would never play when the reveal opens or closes. -->
			<div
				class="pointer-events-none fixed top-[16%] left-1/2 z-55 w-[min(24rem,calc(100vw-2rem))] -translate-x-1/2 rounded-2xl border border-white/10 bg-[#0a0e1c] p-5 shadow-2xl shadow-black/60"
				data-reveal={reveal.id}
				in:fly|global={{ duration: 320, y: 16 }}
				out:fly|global={{ duration: 260, y: -10 }}
			>
				<div class="flex items-center gap-4">
					<span
						class="reveal-symbol block w-16 shrink-0 text-center text-5xl leading-none font-black"
						style:color
					>
						{target.symbol}
					</span>
					<div class="min-w-0">
						<p class="text-xs text-white/45">{target.z} · Reading its light</p>
						<p class="truncate text-xl leading-tight font-bold">{target.name}</p>
					</div>
				</div>
				<div class="relative mt-4 h-10 overflow-hidden rounded-md bg-black">
					<span
						class="reveal-rainbow absolute inset-0 origin-left"
						style:background-image={SPECTRUM}
					></span>
					{#each target.lines.toSorted((a, b) => a - b) as nm, i (nm)}
						<span
							class="reveal-line absolute inset-y-0 w-0.5 -translate-x-1/2"
							style:animation-delay="{REVEAL_LINES_AT + i * REVEAL_LINE_STEP}ms"
							style:background={wavelengthColor(nm)}
							style:box-shadow="0 0 6px {wavelengthColor(nm)}"
							style:left="{lineX(nm)}%"
							data-line={nm}
						></span>
					{/each}
				</div>
				<div class="mt-1 flex justify-between text-[10px] text-white/30 tabular-nums">
					<span>380 nm</span>
					<span>{target.lines.length ? `${target.lines.length} lines` : 'never measured'}</span>
					<span>780 nm</span>
				</div>
				<div
					class="reveal-late mt-4"
					style:animation-delay="{REVEAL_LINES_AT + target.lines.length * REVEAL_LINE_STEP}ms"
				>
					<p
						class="font-bold"
						style:color
					>
						{bonusText(target)}
					</p>
					<p class="mt-0.5 text-xs text-white/40">{reactionOf(target)}</p>
				</div>
			</div>
		{/key}
	{/if}

	<div class="pointer-events-none fixed bottom-4 left-1/2 z-55 flex -translate-x-1/2 flex-col items-center gap-1.5 max-lg:bottom-[calc(44dvh+var(--mobile-dock-height,0px)+1rem)]">
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

	/** Progress lands on the 1 s tick, a 1 s linear glide makes it read as continuous. */
	.smooth {
		transition: stroke-dashoffset 1s linear;
	}

	/** Only the sources forging right now breathe (a handful, transform only). */
	@media (prefers-reduced-motion: no-preference) {
		.breathe {
			animation: breathe 3.2s ease-in-out infinite;
		}
	}

	@keyframes breathe {
		50% {
			transform: scale(1.07);
		}
	}

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
