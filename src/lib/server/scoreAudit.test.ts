import { beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { COSMOS_OBJECTS_BY_ID, studyCost } from '#data/cosmos.js';
import { CurrenciesTypes, type CurrencyName } from '#data/currencies.js';
import { decayCost, ELEMENTS, lightCost, TUNING, type LightColor } from '#data/elements.js';
import { GENERATOR_TYPES, GENERATORS } from '#data/generators.js';
import { FORGE_MILESTONES, siteStudyCost } from '#data/sites.js';
import { UPGRADES } from '#data/upgrades.js';
import { currenciesManager } from '#helpers/CurrenciesManager.svelte.js';
import { EffectTable } from '#helpers/effects.js';
import { gameManager } from '#helpers/GameManager.svelte.js';
import { measureRunBounds } from '#helpers/runBounds.js';
import { GENERATOR_COST_MULTIPLIER, PROTONS_ATOMS_REQUIRED } from '#lib/constants.js';
import { auditScore, inspectScore, keptSpending, type PreviousScore, runSpending, type ScoreAudit } from '#lib/server/scoreAudit.server.js';
import type { GameState } from '#lib/types.js';
import { playHonestRun } from '../../../tests/simulatedRun.js';

/** The bot plays on a clock starting at 0, its states are moved to a real date so the date checks see a plausible save. */
const OFFSET = Date.UTC(2026, 0, 1);

interface Capture {
	now: number;
	state: GameState;
}

let captures: Capture[] = [];

/** What the client sends: its current state without the settings, tutorial and daily stats. */
function capture(): Capture {
	const clock = gameManager.clock();
	const { dailyStats, settings, tutorial, ...state } = JSON.parse(JSON.stringify(gameManager.getCurrentState())) as GameState;
	state.startDate += OFFSET;
	state.lastSave = OFFSET + clock;
	state.lastInteractionTime += OFFSET;
	if (state.runStartedAt > 0) state.runStartedAt += OFFSET;
	return { now: OFFSET + clock, state: state as GameState };
}

/** The bot signs up as it starts playing. */
const context = (now: number, previous: PreviousScore | null = null, totalUsers = 0) => ({ accountCreatedAt: OFFSET, colliderTotal: 0, now, previous, totalUsers });
const audit = ({ now, state }: Capture, previous: PreviousScore | null = null, totalUsers = 0) => auditScore(state, context(now, previous, totalUsers)) as ScoreAudit;
const atomsOf = (state: GameState) => state.currencies[CurrenciesTypes.ATOMS];
const runId = ({ state }: Capture) => `${state.totalProtonisesAllTime}:${state.totalElectronizesAllTime}:${state.totalIonizesAllTime}`;
/** A late state with a known run start, past the first Protonize. */
const lateRun = () => captures.findLast(({ state }) => state.runStartedAt > 0 && atomsOf(state).earnedRun > 1e12)!;

/** Playing six hours takes several seconds, past the default hook timeout on a busy machine. */
beforeAll(() => {
	playHonestRun('balanced', 6, () => captures.push(capture()));
	captures = captures.filter((_, i) => i % 6 === 0);
}, 60_000);

beforeEach(() => gameManager.resetAll());

describe('honest states', () => {
	test('pass on their own', () => {
		for (const entry of captures) expect(audit(entry).issues, `at ${entry.now - OFFSET} ms`).toEqual([]);
	});

	test('pass against the previous submission of the same run', () => {
		let pairs = 0;
		for (let i = 1; i < captures.length; i++) {
			if (runId(captures[i]) !== runId(captures[i - 1])) continue;
			const previous = { receivedAt: captures[i - 1].now, snapshot: audit(captures[i - 1]).snapshot };
			const result = audit(captures[i], previous);
			expect(result.issues).toEqual([]);
			expect(result.warnings).toEqual([]);
			pairs++;
		}
		expect(pairs).toBeGreaterThan(5);
	});

	test('read the score from the state, never from the client', () => {
		const entry = lateRun();
		const result = audit(entry);
		gameManager.loadSaveData(entry.state);
		expect(result.atoms).toBe(gameManager.atoms);
		expect(result.level).toBe(gameManager.playerLevel);
	});

	test('leave the shared game singleton empty', () => {
		audit(lateRun());
		expect(gameManager.atoms).toBe(0);
		expect(gameManager.upgrades).toEqual([]);
		expect(Object.hasOwn(gameManager, 'effects')).toBe(false);
	});
});

describe('edited states', () => {
	test('atoms far past what the generators make are rejected', () => {
		const entry = structuredClone(lateRun());
		const atoms = atomsOf(entry.state);
		atoms.amount *= 1e30;
		atoms.earnedRun *= 1e30;
		atoms.earnedAllTime *= 1e30;
		expect(audit(entry).issues).toContain('production');
	});

	test('generators the run never paid for are rejected', () => {
		const entry = structuredClone(lateRun());
		const count = (entry.state.generators.blackHole?.count ?? 0) + 400;
		entry.state.generators.blackHole = { count, level: Math.floor(count / 100), unlocked: true };
		expect(audit(entry).issues).toContain('spending');
	});

	test('a jump since the previous submission is rejected', () => {
		const entry = lateRun();
		const previous = { receivedAt: entry.now - 30_000, snapshot: audit(entry).snapshot };
		const jumped = structuredClone(entry);
		const atoms = atomsOf(jumped.state);
		atoms.amount *= 1e6;
		atoms.earnedRun *= 1e6;
		atoms.earnedAllTime *= 1e6;
		expect(audit(jumped, previous).issues).toContain('growth');
	});

	test('duplicated ids, broken generators and missing stats are rejected, inert legacy ids are not', () => {
		const legacy = structuredClone(lateRun());
		legacy.state.upgrades = [...legacy.state.upgrades, 'xpBoost0'];
		legacy.state.achievements = [...legacy.state.achievements, 'first_atom'];
		expect(audit(legacy).issues).toEqual([]);

		const entry = structuredClone(lateRun());
		entry.state.upgrades = [...entry.state.upgrades, entry.state.upgrades[0]];
		entry.state.generators.molecule = { count: 500, level: 99, unlocked: true };
		expect(audit(entry).issues).toEqual(expect.arrayContaining(['upgrades', 'generator:molecule']));

		const missing = structuredClone(lateRun());
		delete (missing.state as Partial<GameState>).generators;
		expect(audit(missing).issues).toEqual(['malformed:generators']);
	});

	describe('Cosmos and Periodic Table', () => {
		const earn = (state: GameState, currency: CurrencyName, amount: number) => {
			state.currencies[currency] = { amount: 0, earnedAllTime: amount, earnedRun: amount };
		};
		const edited = (edit: (state: GameState) => void) => {
			const entry = structuredClone(lateRun());
			edit(entry.state);
			return audit(entry).issues;
		};
		const jupiter = COSMOS_OBJECTS_BY_ID.jupiter;
		const firstTwoStudies = studyCost(jupiter, 0) + studyCost(jupiter, 1);

		test('study levels past the Starlight earned are rejected, the exact price passes', () => {
			expect(edited(state => (state.cosmos.studies = { jupiter: 1e6 }))).toEqual(expect.arrayContaining(['starlight']));
			expect(edited(state => (state.cosmos.studies = { jupiter: 1.5 }))).toContain('cosmos');
			expect(
				edited(state => {
					state.cosmos.studies = { jupiter: 2 };
					earn(state, CurrenciesTypes.STARLIGHT, firstTwoStudies);
				}),
			).not.toContain('starlight');
			expect(
				edited(state => {
					state.cosmos.studies = { jupiter: 2 };
					earn(state, CurrenciesTypes.STARLIGHT, firstTwoStudies * 0.99);
				}),
			).toContain('starlight');
		});

		test('Periodic source studies share the Starlight budget with the Cosmos studies', () => {
			const issues = (starlight: number) =>
				edited(state => {
					state.cosmos.studies = { jupiter: 1 };
					state.periodic.sites = { bigbang: { index: 0, level: 1, progress: 0 } };
					earn(state, CurrenciesTypes.STARLIGHT, starlight);
				});
			expect(issues(studyCost(jupiter, 0) + siteStudyCost(0))).not.toContain('starlight');
			expect(issues(siteStudyCost(0))).toContain('starlight');
		});

		test('duplicated discoveries, instruments and elements are rejected', () => {
			expect(edited(state => (state.cosmos.discovered = ['mira', 'mira']))).toContain('cosmos');
			expect(edited(state => (state.cosmos.instruments = ['eye', 'eye']))).toContain('cosmos');
			expect(edited(state => (state.periodic.identified = [1, 1]))).toContain('periodic');
		});

		test('every element identified with no Light or Decay events earned is rejected, the cheapest tuning passes', () => {
			const all = ELEMENTS.map(({ z }) => z);
			expect(edited(state => (state.periodic.identified = all))).toEqual(expect.arrayContaining(['decay', 'light']));

			const cheapest = (color: LightColor) => ELEMENTS.reduce((sum, element) => sum + lightCost(element)[color] * TUNING.factorIn, 0);
			const decay = ELEMENTS.reduce((sum, element) => sum + decayCost(element), 0);
			const honest = edited(state => {
				state.periodic.identified = all;
				state.periodic.forges = 5;
				earn(state, CurrenciesTypes.DECAY_EVENTS, decay);
				earn(state, CurrenciesTypes.BLUE_LIGHT, cheapest('blue'));
				earn(state, CurrenciesTypes.GREEN_LIGHT, cheapest('green'));
				earn(state, CurrenciesTypes.RED_LIGHT, cheapest('red'));
			});
			expect(honest).not.toEqual(expect.arrayContaining(['decay']));
			expect(honest).not.toEqual(expect.arrayContaining(['light']));
			expect(honest).not.toEqual(expect.arrayContaining(['periodic']));
		});

		test('forges past what the identified elements unlock are rejected', () => {
			expect(edited(state => (state.periodic.forges = 2))).toContain('periodic');
			expect(
				edited(state => {
					state.periodic.identified = ELEMENTS.slice(0, FORGE_MILESTONES[0]).map(({ z }) => z);
					state.periodic.forges = 2;
				}),
			).not.toContain('periodic');
		});
	});

	describe('client-set counters and dates', () => {
		/** Atoms multiplied by `factor`, after `edit` changed what the client claims about the run. */
		function inflated(entry: Capture, factor: number, edit: (state: GameState) => void = () => {}): Capture {
			const copy = structuredClone(entry);
			edit(copy.state);
			const atoms = atomsOf(copy.state);
			atoms.amount *= factor;
			atoms.earnedRun *= factor;
			atoms.earnedAllTime *= factor;
			return copy;
		}
		/** Smallest power of two the audit refuses as more atoms than the run could make. */
		function rejectedFrom(run: (factor: number) => ScoreAudit): number {
			for (let factor = 2; factor < 1e30; factor *= 2) if (run(factor).issues.includes('production')) return factor;
			return Infinity;
		}
		const inflateClicks = (times: number) => (state: GameState) => {
			state.totalClicksAllTime += state.totalClicksRun * (times - 1);
			state.totalClicksRun *= times;
		};
		const backdate = (state: GameState) => {
			state.startDate = Date.UTC(2024, 9, 31);
			state.runStartedAt = 0;
		};

		test('clicks past human speed raise the bound no further', () => {
			const entry = lateRun();
			/** Both stay safe integers, which the counter check needs, and both are past what a human clicks in the run. */
			const humanCap = rejectedFrom(factor => audit(inflated(entry, factor, inflateClicks(1e4))));
			expect(humanCap).toBeLessThan(Infinity);
			expect(rejectedFrom(factor => audit(inflated(entry, factor, inflateClicks(1e8))))).toBe(humanCap);
		});

		test('a save start moved back before the account buys no run time', () => {
			const entry = lateRun();
			const limit = rejectedFrom(factor => audit(inflated(entry, factor)));
			expect(rejectedFrom(factor => audit(inflated(entry, factor, backdate)))).toBeLessThanOrEqual(limit);
		});

		test('the account count comes from the server, a total claimed by the client is ignored', () => {
			const entry = structuredClone(lateRun());
			if (!entry.state.upgrades.includes('proton_community_power')) entry.state.upgrades.push('proton_community_power');
			const forged = structuredClone(entry);
			(forged.state as GameState & { totalUsers: number }).totalUsers = 1e12;

			const plain = rejectedFrom(factor => audit(inflated(entry, factor)));
			expect(plain).toBeLessThan(Infinity);
			expect(rejectedFrom(factor => audit(inflated(forged, factor)))).toBe(plain);
			expect(rejectedFrom(factor => audit(inflated(forged, factor), null, 1e12))).toBeGreaterThan(plain);
			expect(rejectedFrom(factor => audit(inflated(entry, factor), null, 100_000))).toBeGreaterThan(plain);
		});

		test('the credited run start never predates what the server saw', () => {
			const entry = lateRun();
			const tolerance = 10 * 60_000;
			const firstAfterSignUp = auditScore(entry.state, { ...context(entry.now), accountCreatedAt: entry.now - 60_000 }) as ScoreAudit;
			expect(firstAfterSignUp.snapshot.runStartedAt).toBeCloseTo(entry.now - 60_000 - tolerance, -2);

			const otherSave = { receivedAt: entry.now - 120_000, snapshot: { ...audit(entry).snapshot, startDate: entry.state.startDate + 1 } };
			expect(audit(entry, otherSave).snapshot.runStartedAt).toBeCloseTo(entry.now - 120_000 - tolerance, -2);

			const credited = audit(entry).snapshot;
			expect(credited.runStartedAt).toBeCloseTo(entry.state.runStartedAt - tolerance, -2);
			const movedBack = structuredClone(entry);
			movedBack.state.runStartedAt -= 24 * 3_600_000;
			expect(audit(movedBack, { receivedAt: entry.now - 60_000, snapshot: credited }).snapshot.runStartedAt).toBe(credited.runStartedAt);
		});
	});

	test('superhuman clicking is only a warning', () => {
		const entry = lateRun();
		const { snapshot } = audit(entry);
		const previous = { receivedAt: entry.now - 600_000, snapshot: { ...snapshot, clicksAllTime: snapshot.clicksAllTime - 1e7, clicksRun: snapshot.clicksRun } };
		const result = audit(entry, previous);
		expect(result.warnings).toContain('clicks');
		expect(result.issues).toEqual([]);
	});
});

describe('Overdrive', () => {
	const maxEarned = (entry: Capture) => (inspectScore(entry.state, context(entry.now)) as { maxEarnedRun: number }).maxEarnedRun;

	test('slots only raise what the run could earn once the skill is owned', () => {
		const entry = structuredClone(lateRun());
		entry.state.skillUpgrades = entry.state.skillUpgrades.filter(id => id !== 'higgsOverdrive');
		const plain = maxEarned(entry);
		expect(plain).toBeGreaterThan(0);

		entry.state.overdrive = Object.fromEntries(GENERATOR_TYPES.map(type => [type, { active: true, paidUntil: entry.now }]));
		expect(maxEarned(entry)).toBe(plain);

		entry.state.skillUpgrades = [...entry.state.skillUpgrades, 'higgsOverdrive'];
		const doubled = maxEarned(entry);
		expect(doubled).toBeGreaterThan(plain);
		entry.state.overdrive = {};
		expect(maxEarned(entry)).toBe(doubled);
	});
});

describe('Overdrive on the Worker', () => {
	/** The Worker pins one effect table before measuring, the all-active override must still reach it when no slot is active. */
	test('a pinned effect table still sees the bound grow with the skill and no active slot', () => {
		const entry = structuredClone(lateRun());
		const pinnedRate = (skills: string[]) => {
			gameManager.resetAll();
			gameManager.loadSaveData(structuredClone({ ...entry.state, activePowerUps: [], overdrive: {}, skillUpgrades: skills }));
			Object.defineProperty(gameManager, 'effects', { configurable: true, value: new EffectTable(gameManager.allEffectSources) });
			try {
				return measureRunBounds(gameManager, entry.now, 3600).rate;
			} finally {
				Reflect.deleteProperty(gameManager, 'effects');
				gameManager.resetAll();
			}
		};
		const without = entry.state.skillUpgrades.filter(id => id !== 'higgsOverdrive');
		const plain = pinnedRate(without);
		expect(pinnedRate([...without, 'higgsOverdrive'])).toBeGreaterThan(plain * 1.5);
	});
});

describe('kept generators', () => {
	const MATTER = 'electron_keep_generators';

	/** The late state as it reads right after a Protonize that kept every generator: a fresh run holding earlier runs' machines. */
	function retained(entry: Capture): Capture {
		const copy = structuredClone(entry);
		const { state } = copy;
		const atoms = atomsOf(state);
		state.keptGenerators = Object.fromEntries(GENERATOR_TYPES.flatMap(type => (state.generators[type]?.count ? [[type, state.generators[type].count]] : [])));
		atoms.earnedAllTime += keptSpending(state);
		atoms.amount = atoms.earnedRun = 0;
		state.totalXP = 0;
		state.upgrades = [...state.upgrades.filter(id => UPGRADES[id]?.cost.currency !== CurrenciesTypes.ATOMS), MATTER];
		return copy;
	}

	test('a normal save reads exactly as before: no kept cost and the whole generator bill as run spending', () => {
		const { state } = lateRun();
		expect(audit(lateRun()).snapshot.keptCost).toBe(0);
		const generators = GENERATOR_TYPES.reduce(
			(sum, type) => sum + (GENERATORS[type].cost.amount * (GENERATOR_COST_MULTIPLIER ** (state.generators[type]?.count ?? 0) - 1)) / (GENERATOR_COST_MULTIPLIER - 1),
			0,
		);
		const upgrades = state.upgrades.reduce((sum, id) => sum + (UPGRADES[id]?.cost.currency === CurrenciesTypes.ATOMS ? UPGRADES[id].cost.amount : 0), 0);
		expect(runSpending(state) / (generators + upgrades)).toBeCloseTo(1, 12);
	});

	test('everything kept passes with the kept record and fails the spending check without it', () => {
		const entry = retained(lateRun());
		expect(audit(entry).issues).toEqual([]);

		const unrecorded = structuredClone(entry);
		unrecorded.state.keptGenerators = {};
		expect(audit(unrecorded).issues).toContain('spending');
	});

	test('a run that keeps its generators passes end to end', () => {
		let nowMs = 0;
		gameManager.clock = () => nowMs;
		try {
			gameManager.startDate = 0;
			gameManager.upgrades = [MATTER];
			currenciesManager.add(CurrenciesTypes.ATOMS, 100);
			/** Twelve hours of buying whatever half the bank pays for, then waiting for the Protonize threshold. */
			for (let i = 0; i < 8640; i++) {
				nowMs += 5000;
				gameManager.tick(5000, true);
				for (const type of GENERATOR_TYPES) {
					while (gameManager.getGeneratorCost(type, 1) <= gameManager.atoms / 2) gameManager.purchaseGenerator(type);
				}
			}
			while (gameManager.atoms < PROTONS_ATOMS_REQUIRED && nowMs < 300 * 3_600_000) {
				nowMs += 10_000;
				gameManager.tick(10_000, true);
			}
			expect(gameManager.protonise()).toBe(true);
			expect(Object.keys(gameManager.keptGenerators).length).toBeGreaterThan(0);

			for (let i = 0; i < 12; i++) {
				nowMs += 5000;
				gameManager.tick(5000, true);
				for (const type of GENERATOR_TYPES) if (gameManager.getGeneratorCost(type, 1) <= gameManager.atoms) gameManager.purchaseGenerator(type);
			}
			const entry = capture();
			expect(entry.state.keptGenerators).toEqual(gameManager.keptGenerators);
			const result = audit(entry);
			expect(result.issues).toEqual([]);
			expect(result.snapshot.keptCost).toBeGreaterThan(0);
		} finally {
			gameManager.clock = () => Date.now();
		}
	});

	test('generators costing more than the earlier runs earned are rejected', () => {
		const entry = retained(lateRun());
		atomsOf(entry.state).earnedAllTime = 0;
		expect(audit(entry).issues).toContain('kept');
	});

	test('a kept record above the generators owned, or without a retention upgrade, is rejected', () => {
		const above = retained(lateRun());
		above.state.keptGenerators.molecule = (above.state.generators.molecule?.count ?? 0) + 1;
		expect(audit(above).issues).toContain('keptGenerators');

		const unowned = retained(lateRun());
		unowned.state.upgrades = unowned.state.upgrades.filter(id => id !== MATTER);
		expect(audit(unowned).issues).toContain('keptGenerators');
	});

	test('a million kept generators fail the kept check with an infinite cost, never NaN', () => {
		const entry = retained(lateRun());
		entry.state.generators.molecule = { count: 1_000_000, level: 10_000, unlocked: true };
		entry.state.keptGenerators.molecule = 1_000_000;
		const result = inspectScore(entry.state, context(entry.now));
		if (typeof result === 'string') throw new Error(result);
		const check = result.checks.find(({ id }) => id === 'kept');
		expect(check?.value).toBe(Infinity);
		expect(result.issues).toContain('kept');
	});

	test('a kept cost that grew since the previous submission of the same run is rejected', () => {
		const entry = retained(lateRun());
		const { snapshot } = audit(entry);
		expect(snapshot.keptCost).toBeGreaterThan(0);
		const receivedAt = entry.now - 60_000;
		expect(audit(entry, { receivedAt, snapshot }).issues).toEqual([]);
		expect(audit(entry, { receivedAt, snapshot: { ...snapshot, keptCost: snapshot.keptCost! / 2 } }).issues).toContain('kept');
		expect(audit(entry, { receivedAt, snapshot: { ...snapshot, keptCost: undefined } }).issues).toEqual([]);
	});
});

describe('payloads', () => {
	test('an older client is told to reload, junk is refused', () => {
		const { now, state } = lateRun();
		expect(auditScore({ ...state, version: state.version - 1 }, context(now))).toBe('outdated');
		expect(auditScore({ ...state, balanceVersion: 0 }, context(now))).toBe('outdated');
		expect(auditScore('atoms', context(now))).toBe('malformed');
		expect(auditScore(null, context(now))).toBe('malformed');
	});
});
