import { COSMOS_INSTRUMENTS, COSMOS_OBJECTS, COSMOS_OBJECTS_BY_ID } from '#data/cosmos.js';
import { CurrenciesTypes } from '#data/currencies.js';
import { cosmosManager } from '#helpers/CosmosManager.svelte.js';
import { currenciesManager } from '#helpers/CurrenciesManager.svelte.js';
import { EffectTable } from '#helpers/effects.js';
import { gameManager } from '#helpers/GameManager.svelte.js';
import type { CosmosBlocker, CosmosEvent, CosmosInsights, CosmosSnapshot } from './types.js';

const BOOST_STATS = [...new Set(COSMOS_OBJECTS.map(object => object.boost.stat))];
const INSTRUMENT_NAMES = Object.fromEntries(COSMOS_INSTRUMENTS.map(instrument => [instrument.id, instrument.name]));

export const COSMOS_DISCOVERABLE = COSMOS_OBJECTS.filter(object => !object.given).length;
/** The naked eye is owned from the start. */
export const COSMOS_INSTRUMENT_COUNT = COSMOS_INSTRUMENTS.length - 1;

export interface CosmosStep {
	id: string;
	kind: 'discover' | 'instrument';
	name: string;
	starlightPerSecond: number;
	timestamp: number;
	/** Since the previous step of the same kind, the opening of the Cosmos for the first one. */
	wait: number;
}

export function cosmosSteps({ events, openedAt }: CosmosInsights): CosmosStep[] {
	const previous = { discover: openedAt ?? 0, instrument: openedAt ?? 0 };
	return events.flatMap(({ detail, kind, starlightPerSecond, timestamp }) => {
		if (kind !== 'discover' && kind !== 'instrument') return [];
		const wait = timestamp - previous[kind];
		previous[kind] = timestamp;
		const name = kind === 'discover' ? (COSMOS_OBJECTS_BY_ID[detail]?.name ?? detail) : (INSTRUMENT_NAMES[detail] ?? detail);
		return [{ id: detail, kind, name, starlightPerSecond, timestamp, wait }];
	});
}

export function cosmosSnapshot(): CosmosSnapshot {
	const boosts = new EffectTable(cosmosManager.effectSources);
	return {
		aperture: cosmosManager.aperture,
		boosts: Object.fromEntries(BOOST_STATS.map(stat => [stat, boosts.value(stat, 1, gameManager)])),
		discovered: cosmosManager.discovered.length,
		instruments: cosmosManager.instruments.length,
		ionizes: gameManager.totalIonizesAllTime,
		starlight: currenciesManager.getAmount(CurrenciesTypes.STARLIGHT),
		starlightEarned: currenciesManager.getEarnedAllTime(CurrenciesTypes.STARLIGHT),
		starlightPerSecond: cosmosManager.starlightPerSecond,
		studyLevels: Object.values(cosmosManager.studies).reduce((total, level) => total + level, 0),
	};
}

export class CosmosTracker {
	readonly insights: CosmosInsights = {
		blockedMs: { aperture: 0, instrument: 0, observe: 0, research: 0, widening: 0 },
		events: [],
		openedAt: null,
	};

	log(kind: CosmosEvent['kind'], detail: string) {
		this.insights.events.push({ detail, kind, starlightPerSecond: cosmosManager.starlightPerSecond, timestamp: gameManager.inGameTime });
	}

	tick(deltaMs: number) {
		if (!cosmosManager.unlocked) return;
		this.insights.openedAt ??= gameManager.inGameTime;
		const blocker = this.blocker();
		if (blocker) this.insights.blockedMs[blocker] += deltaMs;
	}

	/** Null once the owned instruments see nothing new and no instrument is left to buy. */
	private blocker(): CosmosBlocker | null {
		if (cosmosManager.canObserve) return 'observe';
		if (cosmosManager.wideningMs > 0) return 'widening';
		if (cosmosManager.nextDiscovery) return 'aperture';
		if (cosmosManager.research) return 'research';
		if (!cosmosManager.nextInstrument) return null;
		return cosmosManager.apertureMaxed ? 'instrument' : 'aperture';
	}
}
