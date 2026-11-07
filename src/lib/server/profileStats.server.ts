import { CLICKABLE_OBJECTS, COSMOS_OBJECTS } from '#data/cosmos.js';
import { CurrenciesTypes, type CurrencyName } from '#data/currencies.js';
import { ELEMENT_COUNT } from '#data/elements.js';
import { GENERATOR_TYPES, type GeneratorType } from '#data/generators.js';
import { RealmTypes } from '#data/realms.js';
import type { PublicProfileStats } from '#lib/types/leaderboard.js';

/** Bounds the id lists echoed back, a hand-edited save could hold anything. */
const MAX_IDS = 2_000;

function record(value: unknown): Record<string, unknown> {
	return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function num(value: unknown): number {
	return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
}

function ids(value: unknown): string[] {
	return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string').slice(0, MAX_IDS) : [];
}

/** Old saves miss some fields, which read as zero or empty instead of failing the whole profile. */
export function readStats(value: unknown): PublicProfileStats | null {
	const save = record(value);
	if (Object.keys(save).length === 0) return null;

	const currencies = record(save.currencies);
	/** Cloud saves keep the version they were uploaded with, generators lived under `buildings` before v26. */
	const generators = record(save.generators ?? save.buildings);
	const realms = record(save.realms);

	const lifetime: Partial<Record<CurrencyName, number>> = {};
	for (const type of Object.values(CurrenciesTypes)) {
		const earned = num(record(currencies[type]).earnedAllTime);
		if (earned > 0) lifetime[type] = earned;
	}

	const counts: Partial<Record<GeneratorType, number>> = {};
	for (const type of GENERATOR_TYPES) {
		const count = num(record(generators[type]).count);
		if (count > 0) counts[type] = count;
	}

	const ionizes = num(save.totalIonizesAllTime);
	const cosmos = record(save.cosmos);
	const periodic = record(save.periodic);
	/** Objects in the sky as in the game: the given ones show up with the first Ionize, which opens the Cosmos. */
	const discovered = new Set(ids(cosmos.discovered));
	const skyClicks = record(cosmos.clicks);
	const elements = new Set(Array.isArray(periodic.identified) ? periodic.identified.filter((z): z is number => Number.isInteger(z) && z >= 1 && z <= ELEMENT_COUNT) : []);

	return {
		achievements: ids(save.achievements),
		clicks: num(save.totalClicksAllTime),
		discoveries: ionizes > 0 ? COSMOS_OBJECTS.filter(object => object.given || discovered.has(object.id)).length : 0,
		electronizes: num(save.totalElectronizesAllTime),
		elements: elements.size,
		generators: counts,
		guestStars: Math.floor(num(cosmos.guestStars)),
		highestAPS: num(save.highestAPS),
		ionizes,
		lifetime,
		neutrinos: Math.floor(num(periodic.neutrinos)),
		playTime: num(save.inGameTime),
		protonizes: num(save.totalProtonisesAllTime),
		realms: Object.values(RealmTypes).filter(realm => record(realms[realm]).unlocked === true),
		skills: ids(save.skillUpgrades),
		skyTaps: CLICKABLE_OBJECTS.reduce((total, object) => total + Math.floor(num(skyClicks[object.id])), 0),
	};
}
