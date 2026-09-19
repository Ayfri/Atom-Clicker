import type { FeatureState } from '$lib/types';

export const FeatureTypes = {
	BOOST_ASSIGN_ALL: 'boost_assign_all',
	BOOST_EVEN_SPLIT: 'boost_even_split',
	HOVER_COLLECTION: 'hover_collection',
	LEVELS: 'levels',
	OFFLINE_PROGRESS: 'offline_progress',
	PURPLE_REALM: 'purple_realm',
	RADIATION_REALM: 'radiation_realm',
	STABILITY_FIELD: 'stability_field',
} as const;

export type FeatureType = (typeof FeatureTypes)[keyof typeof FeatureTypes];

export const createDefaultFeatureState = (): FeatureState => Object.fromEntries(Object.values(FeatureTypes).map(featureId => [featureId, false])) as FeatureState;

export interface FeatureDefinition {
	description: string;
	id: FeatureType;
	name: string;
	persistent?: boolean;
}

export const FEATURES: Record<FeatureType, FeatureDefinition> = {
	[FeatureTypes.BOOST_ASSIGN_ALL]: {
		description: 'Assign every free boost point to a currency in one click.',
		id: FeatureTypes.BOOST_ASSIGN_ALL,
		name: 'Boost Dump',
	},
	[FeatureTypes.BOOST_EVEN_SPLIT]: {
		description: 'Spread your boost points evenly across every currency you have earned.',
		id: FeatureTypes.BOOST_EVEN_SPLIT,
		name: 'Boost Balancer',
	},
	[FeatureTypes.HOVER_COLLECTION]: {
		description: 'Collect photons by hovering over them or touching them.',
		id: FeatureTypes.HOVER_COLLECTION,
		name: 'Quantum Magnetism',
	},
	[FeatureTypes.LEVELS]: {
		description: 'Unlock the leveling system.',
		id: FeatureTypes.LEVELS,
		name: 'Unlock Levels',
	},
	[FeatureTypes.OFFLINE_PROGRESS]: {
		description: 'Enable offline progress when you are away.',
		id: FeatureTypes.OFFLINE_PROGRESS,
		name: 'Offline Progress',
	},
	[FeatureTypes.PURPLE_REALM]: {
		description: 'Unlock the mysterious purple realm.',
		id: FeatureTypes.PURPLE_REALM,
		name: 'Purple Realm',
		persistent: true,
	},
	[FeatureTypes.RADIATION_REALM]: {
		description: 'Unlock the Radiation Realm and harness nuclear decay.',
		id: FeatureTypes.RADIATION_REALM,
		name: 'Radiation Realm',
		persistent: true,
	},
	[FeatureTypes.STABILITY_FIELD]: {
		description: 'Unlock the Stability Meter (Passive Idle Bonus).',
		id: FeatureTypes.STABILITY_FIELD,
		name: 'Stability Field',
		persistent: true,
	},
};
