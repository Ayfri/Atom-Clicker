import { FeatureTypes } from '$data/features';
import type { FeatureState } from '$lib/types';

export const RealmTypes = {
	ATOMS: 'atoms',
	PHOTONS: 'photons',
	RADIATION: 'radiation',
} as const;

export type RealmType = (typeof RealmTypes)[keyof typeof RealmTypes];

export interface RealmDefinition {
	/** Tints part of the atom's nucleus once unlocked, radiation is softer than its neon theme color which glared on the nucleons. */
	color: string;
	condition: (features: FeatureState) => boolean;
	id: RealmType;
}

export const REALMS: Record<RealmType, RealmDefinition> = {
	[RealmTypes.ATOMS]: {
		color: '#4a90e2',
		condition: () => true,
		id: RealmTypes.ATOMS,
	},
	[RealmTypes.PHOTONS]: {
		color: '#9966cc',
		condition: features => features[FeatureTypes.PURPLE_REALM] === true,
		id: RealmTypes.PHOTONS,
	},
	[RealmTypes.RADIATION]: {
		color: '#9acd32',
		condition: features => features[FeatureTypes.RADIATION_REALM] === true,
		id: RealmTypes.RADIATION,
	},
};
