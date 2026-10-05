import { CHROMATIC_UPGRADES } from '#data/chromatic.js';
import { colliderBonus } from '#data/collider.js';
import { CurrenciesTypes } from '#data/currencies.js';
import { GENERATOR_LEVEL_UP_COST, GENERATOR_TYPES, GENERATORS, type GeneratorType } from '#data/generators.js';
import { ALL_PHOTON_UPGRADES } from '#data/photonUpgrades.js';
import { QUARK_SHOP } from '#data/quarkShop.js';
import { RADIATION_UPGRADES } from '#data/radiationUpgrades.js';
import { UPGRADES } from '#data/upgrades.js';
import { EffectTable } from '#helpers/effects.js';
import { gameManager } from '#helpers/GameManager.svelte.js';
import { checkStatePlausibility } from '#helpers/plausibility.js';
import { BALANCE_VERSION, maxRunAtoms, measureRunBounds, RUN_BOUND_SLACK, runSeconds, type RunBounds } from '#helpers/runBounds.js';
import { SAVE_VERSION, validateAndRepairGameState } from '#helpers/saves.js';
import { statsConfig } from '#helpers/statConstants.js';
import { levelFromTotalXP } from '#helpers/xp.js';
import { GENERATOR_COST_MULTIPLIER, MAX_BOOST_POINTS } from '#lib/constants.js';
import type { EffectSource, GameState } from '#lib/types.js';

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
	protonises: number;
	runStartedAt: number;
	startDate: number;
}

export interface PreviousScore {
	receivedAt: number;
	snapshot: ScoreSnapshot;
}

export interface AuditContext {
	colliderTotal: number;
	now: number;
	previous: PreviousScore | null;
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
const isUnique = (ids: string[]) => new Set(ids).size === ids.length;

function structureIssues(state: GameState, now: number): string[] {
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
	check(COUNTERS.every(key => isCount(state[key])), 'counters');
	check([state.totalXP, state.highestAPS, state.highestAPSRun, state.inGameTime, state.radiation.mass].every(isAmount), 'stats');
	check(state.radiation.controlRodLevel >= 0 && state.radiation.controlRodLevel <= 1, 'radiation');
	check(Object.values(state.currencyBoosts).every(points => isCount(points) && points <= MAX_BOOST_POINTS), 'boosts');
	const latest = now + DATE_TOLERANCE_MS;
	check(state.startDate <= latest && state.lastSave <= latest, 'dates');
	check(state.runStartedAt === 0 || (state.runStartedAt >= state.startDate - DATE_TOLERANCE_MS && state.runStartedAt <= latest), 'runStart');
	return issues;
}

/** Atoms the generators and atom-priced upgrades of the current run cost, both reset on every Protonize. */
function runSpending(state: GameState): number {
	let cost = 0;
	for (const type of GENERATOR_TYPES) {
		const count = state.generators[type]?.count ?? 0;
		cost += (GENERATORS[type].cost.amount * (GENERATOR_COST_MULTIPLIER ** count - 1)) / (GENERATOR_COST_MULTIPLIER - 1);
	}
	for (const id of state.upgrades) {
		const price = UPGRADES[id]?.cost;
		if (price?.currency === CurrenciesTypes.ATOMS) cost += price.amount;
	}
	return cost;
}

/**
 * Loads a copy of the state into the shared game singleton for one synchronous measurement, then wipes it so no request sees another's.
 * Server-compiled `$state` fields hold the objects they are given, so without the copy the wipe would zero the audited state too.
 */
function measure(state: GameState, colliderTotal: number, now: number): RunBounds {
	gameManager.resetAll();
	gameManager.loadSaveData(structuredClone({ ...state, activePowerUps: [] }));
	gameManager.colliderBonus = colliderBonus(colliderTotal);
	gameManager.quarkBoostSources = QUARK_SOURCES;
	/**
	 * Server-compiled runes never cache a derived, so every stat read would rebuild the effect table about a hundred times and one
	 * table is pinned instead. A caching build (the tests) must not be pinned, its deriveds would keep values read from the pin.
	 */
	const uncached = gameManager.effects !== gameManager.effects;
	if (uncached) Object.defineProperty(gameManager, 'effects', { configurable: true, value: new EffectTable(gameManager.allEffectSources) });
	try {
		return measureRunBounds(gameManager, now);
	} finally {
		if (uncached) Reflect.deleteProperty(gameManager, 'effects');
		gameManager.colliderBonus = 0;
		gameManager.quarkBoostSources = [];
		gameManager.resetAll();
	}
}

/**
 * Checks a submitted game state against what the current balance allows, alone and against the previous accepted submission.
 * Returns 'outdated' for a client older than the server and 'malformed' for something that is not a game state at all.
 */
export function auditScore(raw: unknown, { colliderTotal, now, previous }: AuditContext): ScoreAudit | 'malformed' | 'outdated' {
	if (!isObject(raw)) return 'malformed';
	if (raw.version !== SAVE_VERSION || raw.balanceVersion !== BALANCE_VERSION) return 'outdated';

	const input = structuredClone(raw);
	const sent = { ...input };
	const { state } = validateAndRepairGameState(input);
	if (!state) return 'malformed';
	/** The repair swaps a missing or broken stat for a fresh default, so a changed reference is a stat the client got wrong. */
	const repaired = Object.keys(statsConfig).filter(key => !OMITTED_KEYS.has(key) && input[key] !== sent[key]);
	if (repaired.length > 0) return { ...emptyAudit(state), issues: repaired.map(key => `malformed:${key}`) };

	const issues = [...structureIssues(state, now), ...(checkStatePlausibility(state).length > 0 ? ['plausibility'] : [])];
	if (issues.length > 0) return { ...emptyAudit(state), issues };

	const warnings: string[] = [];
	const atoms = state.currencies[CurrenciesTypes.ATOMS];
	const bounds = measure(state, colliderTotal, now);
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

	const runStart = state.runStartedAt > 0 ? Math.min(state.runStartedAt, now) - CLOCK_TOLERANCE_MS : 0;
	let seconds = runSeconds(runStart, state.startDate, now);
	/** A run that began since the last accepted submission began after the server received it, whatever the client clock says. */
	if (sameLineage && !sameRun) seconds = Math.min(seconds, sinceLast + CLOCK_TOLERANCE_MS / 1000);
	if (atoms.earnedRun > maxRunAtoms(bounds, seconds, state.totalClicksRun)) issues.push('production');
	if (atoms.amount > atoms.earnedRun * (1 + 1e-9) + 1) issues.push('atoms');
	if (state.totalXP > atoms.earnedRun * bounds.xpPerAtom * RUN_BOUND_SLACK + 1) issues.push('xp');
	/** Only a run started since runStartedAt exists has an earned total that counts every purchase from zero. */
	if (state.runStartedAt > 0 && runSpending(state) > (atoms.earnedRun - atoms.amount) * RUN_BOUND_SLACK + 1e4) issues.push('spending');

	if (sameRun) {
		const growth = atoms.earnedRun - previousSnapshot.atomsEarnedRun;
		if (growth > maxRunAtoms(bounds, sinceLast, state.totalClicksRun - previousSnapshot.clicksRun)) issues.push('growth');
	}
	if (sameLineage && sinceLast >= MIN_RATE_WINDOW_SECONDS) {
		if (state.totalClicksAllTime - previousSnapshot.clicksAllTime > (bounds.autoClicksPerSecond + HUMAN_CLICKS_PER_SECOND) * sinceLast) warnings.push('clicks');
		if (state.totalProtonisesAllTime - previousSnapshot.protonises > MAX_PROTONISES_PER_SECOND * sinceLast) warnings.push('protonise_rate');
		if (state.inGameTime - previousSnapshot.inGameTime > sinceLast * 1000 + CLOCK_TOLERANCE_MS) warnings.push('play_time');
	}

	return { ...emptyAudit(state), issues, warnings };
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
		protonises: state.totalProtonisesAllTime,
		runStartedAt: state.runStartedAt,
		startDate: state.startDate,
	};
	return { atoms: atoms.amount, issues: [], level: levelFromTotalXP(state.totalXP), snapshot, warnings: [] };
}
