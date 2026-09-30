import type { FeatureState } from '$lib/types';

export const FeatureTypes = {
	BOOST_ASSIGN_ALL: 'boost_assign_all',
	BOOST_EVEN_SPLIT: 'boost_even_split',
	COLLIDER: 'collider',
	HOVER_COLLECTION: 'hover_collection',
	LEVELS: 'levels',
	OFFLINE_AUTO_CLICK: 'offline_auto_click',
	OFFLINE_AUTO_UPGRADE: 'offline_auto_upgrade',
	OFFLINE_PROGRESS: 'offline_progress',
	PURPLE_REALM: 'purple_realm',
	RADIATION_REALM: 'radiation_realm',
	STABILITY_FIELD: 'stability_field',
	STABLE_ATOM_AUTO_CLICK: 'stable_atom_auto_click',
	STABLE_ATOM_CLICK: 'stable_atom_click',
	STABLE_BONUS_CLICK: 'stable_bonus_click',
	STABLE_PHOTON_AUTO_CLICK: 'stable_photon_auto_click',
	STABLE_PHOTON_CLICK: 'stable_photon_click',
} as const;

export type FeatureType = (typeof FeatureTypes)[keyof typeof FeatureTypes];

export const createDefaultFeatureState = (): FeatureState => Object.fromEntries(Object.values(FeatureTypes).map(featureId => [featureId, false])) as FeatureState;
