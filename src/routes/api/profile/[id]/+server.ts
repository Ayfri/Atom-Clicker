import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { CurrenciesTypes, type CurrencyName } from '$data/currencies';
import { GENERATOR_TYPES, type GeneratorType } from '$data/generators';
import { RealmTypes } from '$data/realms';
import { leaderboardService } from '$lib/server/supabase.server';
import type { PublicProfile, PublicProfileStats } from '$lib/types/leaderboard';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
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
function readStats(value: unknown): PublicProfileStats | null {
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

	return {
		achievements: ids(save.achievements),
		clicks: num(save.totalClicksAllTime),
		electronizes: num(save.totalElectronizesAllTime),
		generators: counts,
		highestAPS: num(save.highestAPS),
		lifetime,
		playTime: num(save.inGameTime),
		protonizes: num(save.totalProtonisesAllTime),
		realms: Object.values(RealmTypes).filter(realm => record(realms[realm]).unlocked === true),
		skills: ids(save.skillUpgrades),
	};
}

export const GET: RequestHandler = async ({ params }) => {
	if (!UUID.test(params.id)) return json({ error: 'Invalid player id' }, { status: 400 });

	try {
		const row = await leaderboardService.getPublicSave(params.id);
		if (!row) return json({ error: 'Player not found' }, { status: 404 });

		const profile: PublicProfile = {
			joinedAt: row.created_at ? new Date(row.created_at).getTime() : null,
			stats: readStats(row.save),
		};
		return json(profile, { headers: { 'Cache-Control': 'public, max-age=60' } });
	} catch (error) {
		console.error('Failed to fetch profile:', error);
		return json({ error: 'Failed to fetch profile' }, { status: 500 });
	}
};
