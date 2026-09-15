import { FeatureTypes } from '$data/features';
import type { FeatureState } from '$lib/types';

export const RealmTypes = {
	ATOMS: 'atoms',
	PHOTONS: 'photons',
	RADIATION: 'radiation',
} as const;

export type RealmType = (typeof RealmTypes)[keyof typeof RealmTypes];

export interface RealmDefinition {
	condition: (features: FeatureState) => boolean;
	id: RealmType;
}

export const REALMS: Record<RealmType, RealmDefinition> = {
	[RealmTypes.ATOMS]: {
		condition: () => true,
		id: RealmTypes.ATOMS,
	},
	[RealmTypes.PHOTONS]: {
		condition: features => features[FeatureTypes.PURPLE_REALM] === true,
		id: RealmTypes.PHOTONS,
	},
	[RealmTypes.RADIATION]: {
		condition: features => features[FeatureTypes.RADIATION_REALM] === true,
		id: RealmTypes.RADIATION,
	},
};
