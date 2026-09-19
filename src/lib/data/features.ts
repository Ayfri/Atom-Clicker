import type { FeatureState } from '$lib/types';

export const FeatureTypes = {
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
