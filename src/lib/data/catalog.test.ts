import { describe, expect, test } from 'bun:test';
import { ACHIEVEMENT_GROUPS, ACHIEVEMENTS } from '#data/achievements.js';
import { CHROMATIC_UPGRADES, getChromaticUpgradeCost } from '#data/chromatic.js';
import { FeatureTypes } from '#data/features.js';
import { GENERATOR_TYPES } from '#data/generators.js';
import { HINTS } from '#data/hints.js';
import { ALL_PHOTON_UPGRADES, EXCITED_PHOTON_UPGRADES, getPhotonUpgradeCost, PHOTON_UPGRADES } from '#data/photonUpgrades.js';
import { QUARK_SHOP } from '#data/quarkShop.js';
import { getRadiationUpgradeCost, RADIATION_UPGRADES } from '#data/radiationUpgrades.js';
import { RealmTypes } from '#data/realms.js';
import { SKILL_UPGRADES } from '#data/skillTree.js';
import { UPGRADES } from '#data/upgrades.js';
import { gameManager } from '#helpers/GameManager.svelte.js';
import type { Effect } from '#lib/types.js';

/** Every keyed catalog, the key is what saves and the Quarks server store. */
const CATALOGS: Record<string, Record<string, { id: string }>> = {
	ACHIEVEMENTS,
	ALL_PHOTON_UPGRADES,
	CHROMATIC_UPGRADES,
	QUARK_SHOP,
	RADIATION_UPGRADES,
	SKILL_UPGRADES,
	UPGRADES,
};

test.each(Object.entries(CATALOGS))('%s entries are stored under their own id', (_, catalog) => {
	for (const [key, entry] of Object.entries(catalog)) expect(entry.id).toBe(key);
});

test('no achievement id appears twice across groups, the later one would silently replace the first', () => {
	expect(ACHIEVEMENT_GROUPS.flatMap(group => group.achievements)).toHaveLength(Object.keys(ACHIEVEMENTS).length);
});

test('photon and excited photon upgrades never share an id', () => {
	expect(Object.keys(ALL_PHOTON_UPGRADES)).toHaveLength(Object.keys(PHOTON_UPGRADES).length + Object.keys(EXCITED_PHOTON_UPGRADES).length);
});

test('hint ids are unique and prefixed with their realm', () => {
	const realms: string[] = Object.values(RealmTypes);
	expect(new Set(HINTS.map(hint => hint.id)).size).toBe(HINTS.length);
	for (const hint of HINTS) {
		const [prefix] = hint.id.split(':');
		expect(realms, hint.id).toContain(prefix);
	}
});

describe('skill tree', () => {
	const skills = Object.values(SKILL_UPGRADES);

	test('every requirement names an existing skill', () => {
		for (const skill of skills) for (const id of skill.requires ?? []) expect(SKILL_UPGRADES, `${skill.id} requires ${id}`).toHaveProperty(id);
	});

	test('every skill is reachable from a root, so no requirement cycle locks one away', () => {
		const reachable = new Set<string>();
		let grew = true;
		while (grew) {
			grew = false;
			for (const skill of skills) {
				if (reachable.has(skill.id) || !(skill.requires ?? []).every(id => reachable.has(id))) continue;
				reachable.add(skill.id);
				grew = true;
			}
		}
		expect(skills.map(skill => skill.id).filter(id => !reachable.has(id))).toEqual([]);
	});

	test('skill features are known flags and every flag has a skill unlocking it', () => {
		const features: string[] = Object.values(FeatureTypes);
		const unlocked = new Set<string>(skills.flatMap(skill => skill.feature ?? []));
		for (const feature of unlocked) expect(features).toContain(feature);
		expect(features.filter(feature => !unlocked.has(feature))).toEqual([]);
	});

	test('no two skills sit on the same spot', () => {
		const spots = skills.map(skill => `${skill.position.x},${skill.position.y}`);
		expect(new Set(spots).size).toBe(spots.length);
	});
});

describe('effects', () => {
	const generators: string[] = GENERATOR_TYPES;
	const allEffects: [string, Effect][] = [
		...Object.values(UPGRADES).flatMap(upgrade => upgrade.effects.map(effect => [upgrade.id, effect] as [string, Effect])),
		...Object.values(SKILL_UPGRADES).flatMap(skill => skill.effects.map(effect => [skill.id, effect] as [string, Effect])),
		...Object.values(ALL_PHOTON_UPGRADES).flatMap(upgrade => upgrade.effects(upgrade.maxLevel).map(effect => [upgrade.id, effect] as [string, Effect])),
		...Object.values(QUARK_SHOP).flatMap(item => (item.effects ?? []).map(effect => [item.id, effect] as [string, Effect])),
	];

	test('generator targets name real generators', () => {
		for (const [id, effect] of allEffects) if (effect.kind !== 'sum' && effect.target) expect(generators, id).toContain(effect.target);
	});

	test('every effect and upgrade condition evaluates on a fresh game', () => {
		gameManager.resetAll();
		for (const [id, effect] of allEffects) {
			const amount = effect.kind === 'sum' ? effect.per(gameManager) : typeof effect.amount === 'number' ? effect.amount : effect.amount(gameManager);
			expect(Number.isFinite(amount), id).toBe(true);
		}
		for (const upgrade of [...Object.values(UPGRADES), ...Object.values(SKILL_UPGRADES), ...Object.values(ALL_PHOTON_UPGRADES)]) {
			expect(() => upgrade.condition?.(gameManager), upgrade.id).not.toThrow();
		}
		for (const achievement of Object.values(ACHIEVEMENTS)) expect(typeof achievement.condition(gameManager), achievement.id).toBe('boolean');
	});
});

describe('prices', () => {
	test('upgrade and skill prices are positive and finite', () => {
		for (const { cost, id } of [...Object.values(UPGRADES), ...Object.values(SKILL_UPGRADES)]) {
			expect(cost.amount > 0 && Number.isFinite(cost.amount), id).toBe(true);
		}
	});

	test('leveled upgrades get pricier with every level up to their max', () => {
		const leveled: [string, (level: number) => number, number][] = [
			...Object.values(ALL_PHOTON_UPGRADES).map(u => [u.id, (level: number) => getPhotonUpgradeCost(u, level), u.maxLevel] as [string, (level: number) => number, number]),
			...Object.values(RADIATION_UPGRADES).map(u => [u.id, (level: number) => getRadiationUpgradeCost(u, level), u.maxLevel] as [string, (level: number) => number, number]),
			...Object.values(CHROMATIC_UPGRADES).map(u => [u.id, (level: number) => getChromaticUpgradeCost(u, level), u.maxLevel] as [string, (level: number) => number, number]),
		];
		for (const [id, cost, maxLevel] of leveled) {
			expect(cost(0), id).toBeGreaterThan(0);
			for (let level = 1; level < Math.min(maxLevel, 1000); level++) expect(cost(level), `${id} level ${level}`).toBeGreaterThanOrEqual(cost(level - 1));
			expect(Number.isFinite(cost(Math.min(maxLevel, 1000) - 1)), id).toBe(true);
		}
	});
});
