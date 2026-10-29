export const APP_PRODUCTION_MULTIPLIER = 1.1;
/** The same bonus as players read it, `10` for `+10%`. */
export const APP_PRODUCTION_PERCENT = Math.round((APP_PRODUCTION_MULTIPLIER - 1) * 100);

/** Generators one auto-buy purchase builds, indexed by the level of the Bulk Assembly photon upgrade. */
export const AUTO_BUY_BULK = [1, 5, 15, 50, Infinity] as const;

export const GENERATOR_COST_MULTIPLIER = 1.17;

// Currency requirements for prestige mechanics
export const PROTONS_ATOMS_REQUIRED = 1_000_000_000;
export const ELECTRONS_PROTONS_REQUIRED = 1_000_000_000;

export const XP_PER_ATOM = 0.1;

export const MAX_BOOST_POINTS = 20;
