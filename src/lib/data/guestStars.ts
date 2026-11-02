/** Cosmos time between two guest stars is drawn uniformly from this range, in ms. */
export const GUEST_STAR_INTERVAL_MS = [240_000, 480_000] as const;

/** Seconds of the current Starlight income a caught guest star pays. */
export const GUEST_STAR_REWARD_SECONDS = 90;

export const GUEST_STAR_TIERS = [1, 25, 250] as const;

/** Seconds a flare stays in the sky: it rises until 1.2, holds until 6.5, then fades. */
export const GUEST_STAR_LIFE = 9;

/** Stored in the saves and claimed server-side, never rename. */
export const guestStarAchievementId = (tier: number): string => `cosmos_guest_stars_${tier}`;

/** Real novae and supernovae, "guest star" is what the old Chinese astronomers called a new star appearing where none was seen. Shown one per catch, in order. */
export const GUEST_STARS: readonly { name: string; text: string }[] = [
	{ name: 'SN 185', text: 'Chinese astronomers recorded it in 185 and it stayed visible for about 8 months, the oldest supernova on record.' },
	{ name: 'SN 1006', text: 'The brightest stellar event in recorded history, around magnitude -7.5, described by Ali ibn Ridwan in Egypt.' },
	{ name: 'SN 1054', text: 'Chinese astronomers saw it in daylight for 23 days, it left the Crab Nebula.' },
	{ name: 'SN 1181', text: 'Chinese and Japanese astronomers watched it for 185 days.' },
	{ name: 'SN 1604', text: "Kepler's star, the last supernova seen in the Milky Way with the naked eye." },
	{ name: 'Nova Persei 1901', text: 'It reached magnitude 0.2 and was found by the amateur Thomas Anderson in Edinburgh.' },
	{ name: 'Nova Aquilae 1918', text: 'The brightest nova of the 20th century, at magnitude -0.5.' },
	{ name: 'SN 1987A', text: 'In the Large Magellanic Cloud, its neutrinos reached detectors in Japan, the US and Russia hours before its light.' },
];

const RISE = 1.2;
const HOLD = 6.5;
/** Random points tried before a spawn gives up until the next second. */
const SPOT_TRIES = 8;
/** Band of the view a spot is drawn from, as shares of its height: under the Starlight counter and above the bottom dock. */
const SPOT_BAND = [0.2, 0.7] as const;

const smooth = (t: number): number => t * t * (3 - 2 * t);

/** Brightness of a flare `age` seconds after it appeared, 0 outside its life. `still` holds it steady for reduced motion. */
export function flareIntensity(age: number, still: boolean): number {
	if (age <= 0 || age >= GUEST_STAR_LIFE) return 0;
	if (age < RISE) return smooth(age / RISE);
	if (age < HOLD) return still ? 1 : 0.85 + 0.15 * Math.sin(age * 9);
	return smooth(1 - (age - HOLD) / (GUEST_STAR_LIFE - HOLD));
}

/**
 * First of a few random points in the view, `margin` px from its left and right edges, that `isFree` accepts, null when none does.
 * Panels over the sky differ per screen, so the caller asks what is really visible there instead of this assuming a layout.
 */
export function guestStarSpot(
	width: number,
	height: number,
	margin: number,
	isFree: (x: number, y: number) => boolean,
	random: () => number = Math.random,
): { x: number; y: number } | null {
	for (let i = 0; i < SPOT_TRIES; i++) {
		const x = margin + random() * (width - 2 * margin);
		const y = height * (SPOT_BAND[0] + random() * (SPOT_BAND[1] - SPOT_BAND[0]));
		if (isFree(x, y)) return { x, y };
	}
	return null;
}
