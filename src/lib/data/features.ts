import type { FeatureState } from '$lib/types';

export const FeatureTypes = {
	HOVER_COLLECTION: 'hover_collection',
	LEVELS: 'levels',
	OFFLINE_PROGRESS: 'offline_progress',
	PURPLE_REALM: 'purple_realm',
	STABILITY_FIELD: 'stability_field'
} as const;

export type FeatureType = (typeof FeatureTypes)[keyof typeof FeatureTypes];

export const DEFAULT_FEATURE_STATE = Object.fromEntries(
	Object.values(FeatureTypes).map((featureId) => [featureId, false])
) as FeatureState;

export const createDefaultFeatureState = (): FeatureState => structuredClone(DEFAULT_FEATURE_STATE);

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
		name: 'Quantum Magnetism'
	},
	[FeatureTypes.LEVELS]: {
		description: 'Unlock the leveling system.',
		id: FeatureTypes.LEVELS,
		name: 'Unlock Levels'
	},
	[FeatureTypes.OFFLINE_PROGRESS]: {
		description: 'Enable offline progress when you are away.',
		id: FeatureTypes.OFFLINE_PROGRESS,
		name: 'Offline Progress'
	},
	[FeatureTypes.PURPLE_REALM]: {
		description: 'Unlock the mysterious purple realm.',
		id: FeatureTypes.PURPLE_REALM,
		name: 'Purple Realm',
		persistent: true
	},
	[FeatureTypes.STABILITY_FIELD]: {
		description: 'Unlock the Stability Meter (Passive Idle Bonus).',
		id: FeatureTypes.STABILITY_FIELD,
		name: 'Stability Field',
		persistent: true
	}
};

export const PERSISTENT_FEATURE_IDS = Object.values(FEATURES)
	.filter((feature) => feature.persistent)
	.map((feature) => feature.id);
