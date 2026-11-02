/** Longest eligible Table time between two neutrinos, in ms. */
export const NEUTRINO_MAX_INTERVAL_MS = 420_000;

/** The server bounds the catches with it: two neutrinos are always at least this far apart in wall time. */
export const NEUTRINO_MIN_INTERVAL_MS = 240_000;

/** Table time a caught neutrino runs ahead, in ms. */
export const NEUTRINO_SKIP_MS = 600_000;

export const NEUTRINO_FLIGHT_MS = 12_000;

/** Reduced motion gets a slower, straighter flight. */
export const NEUTRINO_REDUCED_FLIGHT_MS = 14_000;

/** Stored in the saves and claimed server-side, never rename. */
export const NEUTRINO_TIERS = [1, 25, 250] as const;

export const neutrinoAchievementId = (tier: number): string => `table_neutrinos_${tier}`;

/** A random one is shown with each catch. */
export const NEUTRINO_FACTS: readonly string[] = [
	'Trillions of neutrinos pass through your body every second, and almost none ever touch it.',
	'About 60 billion neutrinos from the Sun cross each square centimeter of you every second.',
	'Clyde Cowan and Frederick Reines first detected neutrinos in 1956, at the Savannah River reactor.',
	'Wolfgang Pauli proposed the neutrino in 1930 to save energy conservation in beta decay.',
	'A neutrino could cross a light-year of lead and most likely come out the other side.',
];
