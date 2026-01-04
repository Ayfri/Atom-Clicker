
export const RealmTypes = {
	ATOMS: 'atoms',
	PHOTONS: 'photons'
} as const;

export type RealmType = typeof RealmTypes[keyof typeof RealmTypes];
