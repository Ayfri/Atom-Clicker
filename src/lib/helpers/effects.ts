import type { Effect, SkillUpgrade, Upgrade } from "$lib/types";
import type { GameManager } from '$helpers/GameManager.svelte';

interface SearchEffectsOptions {
    target?: Effect['target'];
    type?: Effect['type'];
}

export function getUpgradesWithEffects(upgrades: (Upgrade | SkillUpgrade)[], options: SearchEffectsOptions) {
    return upgrades.filter((upgrade): upgrade is (Upgrade | SkillUpgrade) => {
        if ('effects' in upgrade && Array.isArray(upgrade.effects)) {
            const effects = upgrade.effects;
            let isType = true;
            let isTarget = true;

            if (options.type) {
                isType = effects.some(effect => effect.type === options.type);
            }
            if (options.target) {
                isTarget = effects.some(effect => effect.target === options.target);
            }
            return isType && isTarget;
        }

        return false;
    });
}

const ANY = '*';
const INDEX_CACHE = new WeakMap<object, { index: Map<string, Effect[]>; length: number }>();

function bucketKey(type: string | undefined, target: string | undefined): string {
	return `${type ?? ANY}|${target ?? ANY}`;
}

/**
 * Effects are bucketed by the `{type, target}` pairs a fold can ask for, in source order, so a fold reads only the
 * effects it will actually apply instead of walking every effect of every source and skipping 97% of them.
 */
function buildIndex(upgrades: (Upgrade | SkillUpgrade)[]): Map<string, Effect[]> {
	const index = new Map<string, Effect[]>();
	const push = (key: string, effect: Effect) => {
		const bucket = index.get(key);
		if (bucket) bucket.push(effect);
		else index.set(key, [effect]);
	};

	for (const upgrade of upgrades) {
		const effects = (upgrade as { effects?: Effect[] }).effects;
		if (!Array.isArray(effects)) continue;

		for (const effect of effects) {
			push(bucketKey(undefined, undefined), effect);
			push(bucketKey(effect.type, undefined), effect);
			if (effect.target !== undefined) {
				push(bucketKey(undefined, effect.target), effect);
				push(bucketKey(effect.type, effect.target), effect);
			}
		}
	}

	return index;
}

/** The source lists are rebuilt, never mutated in place, so the array identity plus its length is a safe cache key. */
function effectsFor(upgrades: (Upgrade | SkillUpgrade)[], options: SearchEffectsOptions): Effect[] {
	let cached = INDEX_CACHE.get(upgrades);
	if (!cached || cached.length !== upgrades.length) {
		cached = { index: buildIndex(upgrades), length: upgrades.length };
		INDEX_CACHE.set(upgrades, cached);
	}
	return cached.index.get(bucketKey(options.type, options.target)) ?? [];
}

/**
 * Fused `getUpgradesWithEffects` + `calculateEffects`: the hot derived stats read the pre-bucketed effects for the
 * requested `{type, target}` and fold them directly, without the intermediate array or the per-effect filtering.
 */
export function foldEffects(upgrades: (Upgrade | SkillUpgrade)[], manager: GameManager, defaultValue: number, options: SearchEffectsOptions): number {
	return foldBucket(effectsFor(upgrades, options), manager, defaultValue);
}

/**
 * Effects in one bucket read the same manager stats (every click upgrade reads `atomsPerSecond`), and each read
 * re-validates the whole derived graph, so the reads are cached for the duration of a single fold.
 */
function cachedManager(manager: GameManager): GameManager {
	const cache = new Map<PropertyKey, unknown>();
	return new Proxy(manager, {
		get(target, property) {
			if (cache.has(property)) return cache.get(property);
			const value = Reflect.get(target, property, target);
			cache.set(property, value);
			return value;
		},
	});
}

function foldBucket(effects: Effect[], rawManager: GameManager, defaultValue: number): number {
	const manager = effects.length > 1 ? cachedManager(rawManager) : rawManager;
	let value = defaultValue;
	let groupContributions: Map<string, number> | null = null;

	for (const effect of effects) {
		if (effect.group) {
			const contribution = effect.apply(0, manager);
			groupContributions ??= new Map();
			groupContributions.set(effect.group, (groupContributions.get(effect.group) ?? 0) + contribution);
			continue;
		}

		value = effect.apply(value, manager);
	}

	if (groupContributions) {
		for (const contribution of groupContributions.values()) value *= 1 + contribution;
	}

	return value;
}

export function calculateEffects(upgrades: (Upgrade | SkillUpgrade)[], manager: GameManager, defaultValue: number = 0, options?: SearchEffectsOptions): number {
	return foldEffects(upgrades, manager, defaultValue, options ?? {});
}
