import { FeatureTypes } from '$data/features';
import type { GameState } from '$lib/types';

export const RealmTypes = {
	ATOMS: 'atoms',
	PHOTONS: 'photons'
} as const;

export type RealmType = typeof RealmTypes[keyof typeof RealmTypes];

export interface RealmDefinition {
	condition: (state: GameState) => boolean;
	id: RealmType;
}

export const REALMS: Record<RealmType, RealmDefinition> = {
	[RealmTypes.ATOMS]: {
		condition: () => true,
		id: RealmTypes.ATOMS
	},
	[RealmTypes.PHOTONS]: {
		condition: (state) => state.features[FeatureTypes.PURPLE_REALM] === true,
		id: RealmTypes.PHOTONS
	}
};
