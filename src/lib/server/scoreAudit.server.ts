import { ACHIEVEMENTS } from '#data/achievements.js';
import { CHROMATIC_UPGRADES } from '#data/chromatic.js';
import { colliderBonus } from '#data/collider.js';
import {
	APERTURE_STEP,
	apertureCost,
	CLICKABLE_OBJECTS,
	COSMOS_INSTRUMENTS,
	COSMOS_OBJECTS_BY_ID,
	type CosmosInstrument,
	IONIZE_FLASH_SECONDS,
	ionizeStarlightMultiplier,
	SKY_CLICK_STARLIGHT_SECONDS,
	SPECTROSCOPE_ID,
	studyCost,
} from '#data/cosmos.js';
import { CurrenciesTypes, type CurrencyName } from '#data/currencies.js';
import { decayCost, ELEMENTS, lightCost, TUNING, type LightColor } from '#data/elements.js';
import { GENERATOR_LEVEL_UP_COST, GENERATOR_TYPES, GENERATORS, type GeneratorType } from '#data/generators.js';
import { GUEST_STAR_INTERVAL_MS, GUEST_STAR_REWARD_SECONDS } from '#data/guestStars.js';
import { NEUTRINO_MIN_INTERVAL_MS } from '#data/neutrinos.js';
import { ALL_PHOTON_UPGRADES } from '#data/photonUpgrades.js';
import { QUARK_SHOP } from '#data/quarkShop.js';
import { RADIATION_UPGRADES } from '#data/radiationUpgrades.js';
import { FORGE_MILESTONES, SITE_IDS, siteStudyCost } from '#data/sites.js';
import { KEEP_GENERATOR_UPGRADES, UPGRADES } from '#data/upgrades.js';
import { cosmosManager } from '#helpers/CosmosManager.svelte.js';
import { EffectTable } from '#helpers/effects.js';
import { gameManager } from '#helpers/GameManager.svelte.js';
import { findImplausible } from '#helpers/plausibility.js';
import { IONIZE_CPM, IONIZE_CPM_STEP, IONIZE_HOLD_SECONDS, radiationManager } from '#helpers/RadiationManager.svelte.js';
import { BALANCE_VERSION, MAX_CLICKS_PER_SECOND, maxRunAtoms, measureRunBounds, RUN_BOUND_SLACK, runSeconds, type RunBounds } from '#helpers/runBounds.js';
import { SAVE_VERSION, validateAndRepairGameState } from '#helpers/saves.js';
import { statsConfig } from '#helpers/statConstants.js';
import { levelFromTotalXP } from '#helpers/xp.js';
import { GENERATOR_COST_MULTIPLIER, MAX_BOOST_POINTS } from '#lib/constants.js';
import type { EffectSource, GameState } from '#lib/types.js';
import type { AuditCheck } from '#lib/types/audit.js';

/** Client clocks drift, a run start or save date this far ahead of the server is still taken as honest. */
const CLOCK_TOLERANCE_MS = 10 * 60_000;
const DATE_TOLERANCE_MS = 24 * 60 * 60_000;
/** Sustained manual clicking past this, on top of the auto-clicker, is a macro. */
const HUMAN_CLICKS_PER_SECOND = 30;
const MAX_GENERATORS = 1_000_000;
/** No skill automates Protonize, one every two seconds for minutes on end is a script. */
const MAX_PROTONISES_PER_SECOND = 0.5;
/** Rate warnings need a window this long, a burst of clicks between two close submissions means nothing. */
const MIN_RATE_WINDOW_SECONDS = 300;
/** The client leaves these out of the payload, they never move a score. */
const OMITTED_KEYS = new Set(['dailyStats', 'settings', 'tutorial']);

const COUNTERS = [
	'powerUpsCollected',
	'totalClicksAllTime',
	'totalClicksRun',
	'totalElectronizesAllTime',
	'totalElectronizesRun',
	'totalGeneratorsPurchasedAllTime',
	'totalIonizesAllTime',
	'totalProtonisesAllTime',
	'totalProtonisesRun',
	'totalUpgradesPurchasedAllTime',
] as const satisfies readonly (keyof GameState)[];

/** Readable names of the structure issue ids, an id missing here (`currency:Atoms`, `generator:blackHole`) is shown as is. */
const STRUCTURE_LABELS: Record<string, string> = {
	achievementClaims: 'Achievements claimed without the progress behind them',
	achievements: 'Duplicate achievements',
	boosts: 'Currency boosts out of range',
	chromaticUpgrades: 'Chromatic upgrade levels out of range',
	cosmos: 'Cosmos discoveries, instruments, Aperture, study levels, clicks or guest stars duplicated or out of range',
	counters: 'Counters not whole numbers',
	dates: 'Dates in the future',
	decay: 'Decay events the identified elements cost vs Decay events earned',
	discoveries: "Cosmos objects discovered without an owned instrument of their era or past the Aperture's reach",
	guestStars: 'Guest stars caught vs time since the save start',
	keptGenerators: 'Kept generators out of range',
	light: 'Light the identified elements cost vs Light earned',
	neutrinos: 'Neutrinos caught vs time since the save start',
	periodic: 'Periodic Table elements, forges, neutrinos or source studies out of range, or elements identified without the spectroscope',
	photonUpgrades: 'Photon upgrade levels out of range',
	radiation: 'Control rod level out of range',
	radiationUpgrades: 'Radiation upgrade levels out of range',
	runStart: 'Run start date out of range',
	skills: 'Duplicate skills',
	skyClicks: 'Cosmos clicks vs time since the save start',
	starlight: 'Starlight the studies, instruments and Aperture levels cost vs Starlight earned',
	stats: 'Stats negative or not finite',
	upgrades: 'Duplicate upgrades',
};

/** Every Quark boost at once, the server bounds the best case instead of reading which ones the player owns. */
const QUARK_SOURCES: EffectSource[] = Object.values(QUARK_SHOP).flatMap(item => (item.effects ? [{ effects: item.effects, id: item.id, name: item.name }] : []));

/** What the server keeps of an accepted submission to check the next one against. */
export interface ScoreSnapshot {
	atomsEarnedRun: number;
	clicksAllTime: number;
	clicksRun: number;
	electronizes: number;
	inGameTime: number;
	ionizes: number;
	/** Atoms the kept generators cost, absent from snapshots stored before retention existed. */
	keptCost?: number;
	protonises: number;
	/** Run start the server credited, never earlier than the client's own claim allowed. */
	runStartedAt: number;
	startDate: number;
}

export interface PreviousScore {
	receivedAt: number;
	snapshot: ScoreSnapshot;
}

export interface AuditContext {
	/** Creation time of the player's account, null when unknown. */
	accountCreatedAt: number | null;
	colliderTotal: number;
	now: number;
	previous: PreviousScore | null;
	/** Every account, the community upgrade scales with it. */
	totalUsers: number;
}

export interface ScoreInspection extends ScoreAudit {
	checks: AuditCheck[];
	/** The most atoms the run could have earned, null when the audit stopped before measuring. */
	maxEarnedRun: number | null;
}

export interface ScoreAudit {
	atoms: number;
	/** Reasons the state is impossible, any of them keeps the score off the leaderboard. */
	issues: string[];
	level: number;
	snapshot: ScoreSnapshot;
	/** Superhuman input rates, kept for review without touching the score. */
	warnings: string[];
}

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
const isCount = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;
const isAmount = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const isUnique = (ids: readonly unknown[]) => new Set(ids).size === ids.length;

const LIGHTS: Record<LightColor, CurrencyName> = { blue: CurrenciesTypes.BLUE_LIGHT, green: CurrenciesTypes.GREEN_LIGHT, red: CurrenciesTypes.RED_LIGHT };

/** Sum of `price(level)` for the levels 0 to `count - 1`, stopped once it passes `budget` so a tampered level can't spin the loop: prices grow geometrically. */
function priced(price: (level: number) => number, count: number, budget: number): number {
	let sum = 0;
	for (let level = 0; level < count && sum <= budget; level++) sum += price(level);
	return sum;
}

/**
 * `measure` loads the Cosmos and the Periodic Table with their boosts into the bound that atoms are checked against, so what they own must fit what the player earned.
 * Starlight pays the studies, source studies, instruments and Aperture levels, Light and Decay events pay the elements, and `maxStarlightEarned` bounds what was earned.
 * Always lower bounds of what was spent, so an honest state passes: the forge price follows Starlight income at purchase and is left out, so is the instrument still
 * being built, and the Light uses the cheapest Prism tuning. `since` is the seconds since the save start.
 */
function discoveryIssues(state: GameState, since: number): string[] {
	const issues: string[] = [];
	const check = (ok: boolean, issue: string) => {
		if (!ok) issues.push(issue);
	};
	const { discovered, instruments, studies } = state.cosmos;
	const aperture = state.cosmos.aperture ?? 0;
	const clicks = state.cosmos.clicks ?? {};
	const guestStars = state.cosmos.guestStars ?? 0;
	const { forges, identified, sites } = state.periodic;
	const neutrinos = state.periodic.neutrinos ?? 0;
	check(
		Array.isArray(discovered) &&
			Array.isArray(instruments) &&
			isUnique(discovered) &&
			isUnique(instruments) &&
			isObject(studies) &&
			Object.values(studies).every(isCount) &&
			isObject(clicks) &&
			Object.values(clicks).every(isCount) &&
			isCount(guestStars) &&
			isCount(aperture),
		'cosmos',
	);
	check(
		Array.isArray(identified) &&
			isUnique(identified) &&
			isObject(sites) &&
			Object.values(sites).every(site => isCount(site?.level ?? 0)) &&
			isCount(forges ?? 1) &&
			isCount(neutrinos) &&
			(forges ?? 1) <= 1 + FORGE_MILESTONES.filter(milestone => identified.length >= milestone).length,
		'periodic',
	);
	if (issues.length > 0) return issues;

	check(identified.length === 0 || instruments.includes(SPECTROSCOPE_ID), 'periodic');
	check(CLICKABLE_OBJECTS.reduce((sum, { id }) => sum + (clicks[id] ?? 0), 0) <= MAX_CLICKS_PER_SECOND * since, 'skyClicks');
	check(guestStars <= since / (GUEST_STAR_INTERVAL_MS[0] / 1000) + 1, 'guestStars');
	check(neutrinos <= Math.floor(since / (NEUTRINO_MIN_INTERVAL_MS / 1000)) + 1, 'neutrinos');

	const earned = (currency: CurrencyName) => (state.currencies[currency]?.earnedAllTime ?? 0) * (1 + 1e-9) + 1;
	const starlightLimit = earned(CurrenciesTypes.STARLIGHT);
	let starlight = 0;
	for (const [id, level] of Object.entries(studies)) {
		const object = COSMOS_OBJECTS_BY_ID[id];
		if (object) starlight += priced(next => studyCost(object, next), level, starlightLimit - starlight);
	}
	for (const id of SITE_IDS) starlight += priced(siteStudyCost, sites[id]?.level ?? 0, starlightLimit - starlight);
	/** Instruments, tools included, are only bought in list order (`nextInstrument`), so the latest owned one implies every earlier one was paid. */
	const latestInstrument = COSMOS_INSTRUMENTS.findLastIndex(instrument => instruments.includes(instrument.id));
	for (const instrument of COSMOS_INSTRUMENTS.slice(0, latestInstrument + 1)) starlight += instrument.cost;
	starlight += priced(apertureCost, aperture, starlightLimit - starlight);
	check(starlight <= starlightLimit, 'starlight');

	/** Mirrors `CosmosManager`: the latest owned telescope sets the sight limit and the Aperture only widens it, so an honest save's limit never drops below an earlier one. */
	const owns = (instrument: CosmosInstrument) => instrument.cost === 0 || instruments.includes(instrument.id);
	const telescope = COSMOS_INSTRUMENTS.findLast(instrument => !instrument.tool && owns(instrument)) ?? COSMOS_INSTRUMENTS[0];
	const limit = Math.min(telescope.reach, telescope.limit + APERTURE_STEP * aperture);
	check(
		discovered.every(id => {
			const object = COSMOS_OBJECTS_BY_ID[id];
			return !object || object.given || (object.magnitude <= limit && COSMOS_INSTRUMENTS.some(instrument => instrument.era === object.era && owns(instrument)));
		}),
		'discoveries',
	);

	const read = identified.flatMap(z => ELEMENTS[z - 1] ?? []);
	check(read.reduce((sum, element) => sum + decayCost(element), 0) <= earned(CurrenciesTypes.DECAY_EVENTS), 'decay');
	check(
		(Object.entries(LIGHTS) as [LightColor, CurrencyName][]).every(
			([color, currency]) => read.reduce((sum, element) => sum + lightCost(element)[color] * TUNING.factorIn, 0) <= earned(currency),
		),
		'light',
	);
	return issues;
}

function structureIssues(state: GameState, now: number, saveSeconds: number): string[] {
	const issues: string[] = [];
	const check = (ok: boolean, issue: string) => {
		if (!ok) issues.push(issue);
	};
	const currencies = new Set<string>(Object.values(CurrenciesTypes));
	for (const [name, currency] of Object.entries(state.currencies)) {
		check(currencies.has(name) && isAmount(currency?.amount) && isAmount(currency.earnedRun) && isAmount(currency.earnedAllTime), `currency:${name}`);
	}
	for (const [type, generator] of Object.entries(state.generators)) {
		check(
			GENERATOR_TYPES.includes(type as GeneratorType) &&
				isCount(generator?.count) &&
				generator.count <= MAX_GENERATORS &&
				generator.level === Math.floor(generator.count / GENERATOR_LEVEL_UP_COST),
			`generator:${type}`,
		);
	}
	/**
	 * Honest saves still carry ids renamed or removed by past updates and skills bought before the tree moved their prerequisites,
	 * all inert in the game, so only what changes a stat is checked: a duplicate counts twice and a level past the cap adds effect.
	 */
	check(isUnique(state.upgrades), 'upgrades');
	check(isUnique(state.skillUpgrades), 'skills');
	check(isUnique(state.achievements), 'achievements');
	const leveled = [
		['photonUpgrades', state.photonUpgrades, ALL_PHOTON_UPGRADES],
		['chromaticUpgrades', state.chromaticUpgrades, CHROMATIC_UPGRADES],
		['radiationUpgrades', state.radiationUpgrades, RADIATION_UPGRADES],
	] as const;
	for (const [name, levels, registry] of leveled) {
		check(Object.entries(levels).every(([id, level]) => isCount(level) && level <= (registry[id]?.maxLevel ?? Infinity)), name);
	}
	const kept = Object.entries(state.keptGenerators);
	check(
		kept.every(([type, count]) => GENERATOR_TYPES.includes(type as GeneratorType) && isCount(count) && count <= (state.generators[type as GeneratorType]?.count ?? 0)) &&
			(kept.length === 0 || KEEP_GENERATOR_UPGRADES.some(id => state.upgrades.includes(id))),
		'keptGenerators',
	);
	check(COUNTERS.every(key => isCount(state[key])), 'counters');
	check([state.totalXP, state.highestAPS, state.highestAPSRun, state.inGameTime, state.radiation.mass].every(isAmount), 'stats');
	check(state.radiation.controlRodLevel >= 0 && state.radiation.controlRodLevel <= 1, 'radiation');
	check(Object.values(state.currencyBoosts).every(points => isCount(points) && points <= MAX_BOOST_POINTS), 'boosts');
	const latest = now + DATE_TOLERANCE_MS;
	check(state.startDate <= latest && state.lastSave <= latest, 'dates');
	check(state.runStartedAt === 0 || (state.runStartedAt >= state.startDate - DATE_TOLERANCE_MS && state.runStartedAt <= latest), 'runStart');
	issues.push(...discoveryIssues(state, saveSeconds));
	return issues;
}

/** Atoms the generators from number `from` up to `to` cost, `Infinity` for counts past the float range and never NaN. */
function generatorSpend(type: GeneratorType, from: number, to: number): number {
	if (to <= from) return 0;
	const r = GENERATOR_COST_MULTIPLIER;
	return (GENERATORS[type].cost.amount * r ** from * (r ** (to - from) - 1)) / (r - 1);
}

/** Atoms the kept generators cost, which earlier runs paid. */
export function keptSpending(state: GameState): number {
	return GENERATOR_TYPES.reduce((cost, type) => {
		const count = state.keptGenerators[type];
		return isCount(count) ? cost + generatorSpend(type, 0, count) : cost;
	}, 0);
}

/** Atoms the generators and atom-priced upgrades bought in the current run cost, both reset on every Protonize unless retention kept the generators. */
export function runSpending(state: GameState): number {
	let cost = 0;
	for (const type of GENERATOR_TYPES) cost += generatorSpend(type, state.keptGenerators[type] ?? 0, state.generators[type]?.count ?? 0);
	for (const id of state.upgrades) {
		const price = UPGRADES[id]?.cost;
		if (price?.currency === CurrenciesTypes.ATOMS) cost += price.amount;
	}
	return cost;
}

const atMaxLevel = (registry: Record<string, { maxLevel: number }>): Record<string, number> =>
	Object.fromEntries(Object.entries(registry).map(([id, { maxLevel }]) => [id, maxLevel]));

/**
 * Most Starlight the loaded Cosmos could have earned in `saveSeconds`. Discoveries, studies and Ionizes never go down, so today's rate at full boost
 * bounds every past second, sky tap and guest star, and offline time pays a tenth of it so it fits in the seconds. Radiation upgrades reset on every
 * Ionize, so the flashes use the reactor cap with every radiation and Prism upgrade maxed. Reads the loaded game singleton and leaves it forced
 * to the best case, `measure` wipes it afterwards.
 */
function maxStarlightEarned(saveSeconds: number): number {
	gameManager.currencyBoosts = { [CurrenciesTypes.STARLIGHT]: MAX_BOOST_POINTS };
	gameManager.radiationUpgrades = atMaxLevel(RADIATION_UPGRADES);
	gameManager.chromaticUpgrades = atMaxLevel(CHROMATIC_UPGRADES);
	const { maxCpm } = radiationManager;
	/** An Ionize past the maxed reactor cap, or faster than one per IONIZE_HOLD_SECONDS, can't happen under today's rules, so the count only clamps the bound. */
	const maxIonizes = Math.max(0, Math.floor((maxCpm - IONIZE_CPM) / IONIZE_CPM_STEP) + 1);
	gameManager.totalIonizesAllTime = Math.min(gameManager.totalIonizesAllTime, maxIonizes, Math.floor(saveSeconds / IONIZE_HOLD_SECONDS) + 1);
	const { baseStarlight, clicks, guestStars, starlightBoost, starlightPerSecond } = cosmosManager;
	let flash = 0;
	for (let ionize = 1; ionize <= gameManager.totalIonizesAllTime; ionize++) {
		flash += ionizeStarlightMultiplier(ionize) * (maxCpm / (IONIZE_CPM + IONIZE_CPM_STEP * (ionize - 1))) ** 2;
	}
	const taps = Object.values(clicks).reduce((sum, count) => sum + count, 0);
	const online = starlightPerSecond * (saveSeconds + SKY_CLICK_STARLIGHT_SECONDS * taps + GUEST_STAR_REWARD_SECONDS * guestStars);
	return RUN_BOUND_SLACK * (online + baseStarlight * starlightBoost * IONIZE_FLASH_SECONDS * flash) + 1;
}

/**
 * Loads a copy of the state into the shared game singleton for one synchronous measurement, then wipes it so no request sees another's.
 * Server-compiled `$state` fields hold the objects they are given, so without the copy the wipe would zero the audited state too.
 * Also returns the claimed achievements flagged `audited` whose condition is false on the loaded state, read before the bounds measurement overrides the managers.
 */
function measure(
	state: GameState,
	{ colliderTotal, totalUsers }: AuditContext,
	now: number,
	seconds: number,
	saveSeconds: number,
): { bounds: RunBounds; starlightCap: number; unearned: string[] } {
	gameManager.resetAll();
	gameManager.loadSaveData(structuredClone({ ...state, activePowerUps: [] }));
	const unearned = gameManager.achievements.filter(id => ACHIEVEMENTS[id].audited && !ACHIEVEMENTS[id].condition(gameManager));
	gameManager.colliderBonus = colliderBonus(colliderTotal);
	gameManager.quarkBoostSources = QUARK_SOURCES;
	gameManager.totalUsers = totalUsers;
	/**
	 * Server-compiled runes never cache a derived, so every stat read would rebuild the effect table about a hundred times and one
	 * table is pinned instead. A caching build (the tests) must not be pinned, its deriveds would keep values read from the pin.
	 */
	const uncached = gameManager.effects !== gameManager.effects;
	if (uncached) Object.defineProperty(gameManager, 'effects', { configurable: true, value: new EffectTable(gameManager.allEffectSources) });
	try {
		const bounds = measureRunBounds(gameManager, now, seconds);
		return { bounds, starlightCap: maxStarlightEarned(saveSeconds), unearned };
	} finally {
		if (uncached) Reflect.deleteProperty(gameManager, 'effects');
		gameManager.colliderBonus = 0;
		gameManager.quarkBoostSources = [];
		gameManager.totalUsers = 0;
		gameManager.resetAll();
	}
}

/**
 * Checks a submitted game state against what the current balance allows, alone and against the previous accepted submission.
 * Returns 'outdated' for a client older than the server and 'malformed' for something that is not a game state at all.
 */
export function auditScore(raw: unknown, context: AuditContext): ScoreAudit | 'malformed' | 'outdated' {
	const inspection = inspectScore(raw, context);
	if (typeof inspection === 'string') return inspection;
	const { checks, maxEarnedRun, ...audit } = inspection;
	return audit;
}

/** The audit with the number behind each failed check, `auditScore` is this minus the extras. */
export function inspectScore(raw: unknown, context: AuditContext): ScoreInspection | 'malformed' | 'outdated' {
	const { accountCreatedAt, now, previous } = context;
	if (!isObject(raw)) return 'malformed';
	if (raw.version !== SAVE_VERSION || raw.balanceVersion !== BALANCE_VERSION) return 'outdated';

	const input = structuredClone(raw);
	const sent = { ...input };
	const { state } = validateAndRepairGameState(input);
	if (!state) return 'malformed';

	const checks: AuditCheck[] = [];
	const issues: string[] = [];
	const fail = (id: string, value: number | null, limit: number | null, label: string) => {
		checks.push({ id, label, limit, value });
		if (!issues.includes(id)) issues.push(id);
	};

	/** The repair swaps a missing or broken stat for a fresh default, so a changed reference is a stat the client got wrong. */
	const repaired = Object.keys(statsConfig).filter(key => !OMITTED_KEYS.has(key) && input[key] !== sent[key]);
	if (repaired.length > 0) {
		for (const key of repaired) fail(`malformed:${key}`, null, null, `${key} is missing or broken`);
		return { ...emptyAudit(state), checks, issues, maxEarnedRun: null };
	}

	/** The save start is client-set, but no click predates it, and the epoch clamp in `runSeconds` bounds a forged one. A device clock running ahead stamps a later start, so the margin is the date one. */
	const saveSeconds = runSeconds(0, state.startDate, now + DATE_TOLERANCE_MS);
	for (const issue of structureIssues(state, now, saveSeconds)) fail(issue, null, null, STRUCTURE_LABELS[issue] ?? issue);
	for (const { label, limit, limitLabel, value } of findImplausible(state)) fail('plausibility', value, limit, `${label} vs ${limitLabel}`);
	if (issues.length > 0) return { ...emptyAudit(state), checks, issues, maxEarnedRun: null };

	const warnings: string[] = [];
	const atoms = state.currencies[CurrenciesTypes.ATOMS];
	const previousSnapshot = previous?.snapshot;
	const sameLineage =
		previousSnapshot !== undefined &&
		previousSnapshot.startDate === state.startDate &&
		state.totalClicksAllTime >= previousSnapshot.clicksAllTime &&
		state.totalElectronizesAllTime >= previousSnapshot.electronizes &&
		state.totalIonizesAllTime >= previousSnapshot.ionizes &&
		state.totalProtonisesAllTime >= previousSnapshot.protonises;
	const sameRun =
		sameLineage &&
		state.totalElectronizesAllTime === previousSnapshot.electronizes &&
		state.totalIonizesAllTime === previousSnapshot.ionizes &&
		state.totalProtonisesAllTime === previousSnapshot.protonises;
	const sinceLast = previous ? (now - previous.receivedAt) / 1000 : 0;

	/**
	 * The client sets its own run start and save start, so a run is only as old as the server can tell: one the last accepted
	 * submission covered keeps the start credited then, one that began since, or from a save the server never saw, began after
	 * that submission, and a first submission's run began after the account.
	 */
	const runStart = sameRun ? previousSnapshot.runStartedAt : state.runStartedAt > 0 ? Math.min(state.runStartedAt, now) - CLOCK_TOLERANCE_MS : 0;
	const knownSince = sameRun ? null : (previous?.receivedAt ?? accountCreatedAt);
	let seconds = runSeconds(runStart, state.startDate, now);
	if (knownSince !== null) seconds = Math.min(seconds, Math.max(0, now - knownSince + CLOCK_TOLERANCE_MS) / 1000);
	const { bounds, starlightCap, unearned } = measure(state, context, now, seconds, saveSeconds);
	if (unearned.length > 0) fail('achievementClaims', unearned.length, 0, `${STRUCTURE_LABELS.achievementClaims}: ${unearned.join(', ')}`);
	const starlightEarned = state.currencies[CurrenciesTypes.STARLIGHT]?.earnedAllTime ?? 0;
	if (starlightEarned > starlightCap) fail('starlightEarned', starlightEarned, starlightCap, 'Starlight earned all time vs what the Cosmos could radiate since the save start');
	const cap = maxRunAtoms(bounds, seconds, state.totalClicksRun);
	if (atoms.earnedRun > cap) fail('production', atoms.earnedRun, cap, 'Atoms earned this run');
	const heldLimit = atoms.earnedRun * (1 + 1e-9) + 1;
	if (atoms.amount > heldLimit) fail('atoms', atoms.amount, heldLimit, 'Atoms held vs earned this run');
	const xpLimit = atoms.earnedRun * bounds.xpPerAtom * RUN_BOUND_SLACK + 1;
	if (state.totalXP > xpLimit) fail('xp', state.totalXP, xpLimit, 'Total XP vs XP from atoms earned this run');
	/** Only a run started since runStartedAt exists has an earned total that counts every purchase from zero. */
	if (state.runStartedAt > 0) {
		const spent = runSpending(state);
		const spendingLimit = (atoms.earnedRun - atoms.amount) * RUN_BOUND_SLACK + 1e4;
		if (spent > spendingLimit) fail('spending', spent, spendingLimit, 'Atoms spent this run vs earned minus held');
	}
	/** Generators carried in from earlier runs were paid with atoms earned before this one, so they fit what it did not earn. */
	const keptCost = keptSpending(state);
	if (keptCost > 0) {
		const keptLimit = (atoms.earnedAllTime - atoms.earnedRun) * RUN_BOUND_SLACK + 1e4;
		if (keptCost > keptLimit) fail('kept', keptCost, keptLimit, 'Kept generators vs atoms earned before this run');
	}

	if (sameRun) {
		const growth = atoms.earnedRun - previousSnapshot.atomsEarnedRun;
		const growthLimit = maxRunAtoms(bounds, sinceLast, state.totalClicksRun - previousSnapshot.clicksRun);
		if (growth > growthLimit) fail('growth', growth, growthLimit, 'Atoms gained since the previous submission');
		/** Within a run the kept generators only ever stay the same, so a rising cost means the client added to them. */
		if (typeof previousSnapshot.keptCost === 'number') {
			const keptGrowthLimit = previousSnapshot.keptCost * (1 + 1e-9) + 1;
			if (keptCost > keptGrowthLimit) fail('kept', keptCost, keptGrowthLimit, 'Kept generators vs the previous submission');
		}
	}
	if (sameLineage && sinceLast >= MIN_RATE_WINDOW_SECONDS) {
		if (state.totalClicksAllTime - previousSnapshot.clicksAllTime > (bounds.autoClicksPerSecond + HUMAN_CLICKS_PER_SECOND) * sinceLast) warnings.push('clicks');
		if (state.totalProtonisesAllTime - previousSnapshot.protonises > MAX_PROTONISES_PER_SECOND * sinceLast) warnings.push('protonise_rate');
		if (state.inGameTime - previousSnapshot.inGameTime > sinceLast * 1000 + CLOCK_TOLERANCE_MS) warnings.push('play_time');
	}

	const audit = emptyAudit(state);
	return { ...audit, checks, issues, maxEarnedRun: cap, snapshot: { ...audit.snapshot, runStartedAt: now - seconds * 1000 }, warnings };
}

function emptyAudit(state: GameState): ScoreAudit {
	const atoms = state.currencies[CurrenciesTypes.ATOMS] ?? { amount: 0, earnedAllTime: 0, earnedRun: 0 };
	const snapshot: ScoreSnapshot = {
		atomsEarnedRun: atoms.earnedRun,
		clicksAllTime: state.totalClicksAllTime,
		clicksRun: state.totalClicksRun,
		electronizes: state.totalElectronizesAllTime,
		inGameTime: state.inGameTime,
		ionizes: state.totalIonizesAllTime,
		keptCost: keptSpending(state),
		protonises: state.totalProtonisesAllTime,
		runStartedAt: state.runStartedAt,
		startDate: state.startDate,
	};
	return { atoms: atoms.amount, issues: [], level: levelFromTotalXP(state.totalXP), snapshot, warnings: [] };
}
