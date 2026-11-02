import { NEUTRINO_FLIGHT_MS, NEUTRINO_REDUCED_FLIGHT_MS } from '#data/neutrinos.js';

export interface NeutrinoPath {
	durationMs: number;
	keyframes: Keyframe[];
}

/** A stop of the flight: `easing` and `weight` (a share of the flight's time) describe the segment that arrives at it. */
interface Stop {
	easing: string;
	squash?: boolean;
	weight: number;
	x: number;
	y: number;
}

/** Closest a stop gets to the sides and the top of the overlay. */
const MARGIN = 32;
/** The flight starts and ends this far outside the overlay. */
const OFF = 24;
/** Share of the overlay height the flight stays in, the bottom is left to the panels. */
const BAND = 0.7;
const LOOP_RADIUS = 22;
const JITTER = 4;
/** Each beat moves at least this share of the band up or down, so the path zigzags. */
const MIN_STEP = 0.15;
/** Overshoots both ends, which gives the darts their goofy wobble. The stops stay inside the box, only the interpolation leaves it. */
const DART = 'cubic-bezier(.6,-.3,.4,1.3)';
const EASE = 'ease-in-out';
const SQUASH = [0.8, 1.2] as const;
/** Stretch along the heading per px/s, capped so a fast dart never turns into a streak. */
const STRETCH_PER_SPEED = 0.001;
const MAX_STRETCH = 0.6;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), Math.max(min, max));

const frame = (x: number, y: number, angle: number, scaleX: number, scaleY: number) =>
	`translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) rotate(${angle.toFixed(1)}deg) scale(${scaleX.toFixed(3)}, ${scaleY.toFixed(3)})`;

/**
 * The keyframes of one neutrino crossing a `width` x `height` overlay: in from one side, a few darts, zigzags, a hesitation and a loop, out of the other.
 * Position is a `transform` only, so the compositor animates it and the browser hit-tests the animated element.
 * Reduced motion gets a gentle three-point glide with no spin or stretch.
 */
export function neutrinoPath(width: number, height: number, random: () => number, reduced = false): NeutrinoPath {
	const fromLeft = random() < 0.5;
	const startX = fromLeft ? -OFF : width + OFF;
	const endX = fromLeft ? width + OFF : -OFF;
	const [xMin, xMax] = [MARGIN, width - MARGIN];
	const [yMin, yMax] = [MARGIN, height * BAND];
	const range = Math.max(0, yMax - yMin);
	const startY = clamp(yMin + random() * range, yMin, yMax);
	const endY = clamp(yMin + random() * range, yMin, yMax);

	if (reduced) {
		const bend = (random() < 0.5 ? -1 : 1) * 0.1 * range;
		const middleY = clamp((startY + endY) / 2 + bend, yMin, yMax);
		return {
			durationMs: NEUTRINO_REDUCED_FLIGHT_MS,
			keyframes: [
				{ easing: 'linear', offset: 0, transform: frame(startX, startY, 0, 1, 1) },
				{ easing: 'linear', offset: 0.5, transform: frame(width / 2, middleY, 0, 1, 1) },
				{ offset: 1, transform: frame(endX, endY, 0, 1, 1) },
			],
		};
	}

	const stops: Stop[] = [{ easing: EASE, weight: 0, x: startX, y: startY }];
	const beats = 5 + Math.floor(random() * 3);
	let direction = random() < 0.5 ? -1 : 1;
	let y = startY;
	let looped = false;
	let hesitated = false;
	/** The stop after a hesitation darts off. */
	let dartNext = false;
	const arrival = (easing: string) => {
		const used = dartNext ? DART : easing;
		dartNext = false;
		return used;
	};

	for (let beat = 0; beat < beats; beat++) {
		const x = clamp(startX + ((endX - startX) * (beat + 1)) / (beats + 1), xMin, xMax);
		const step = range * (MIN_STEP + random() * (0.5 - MIN_STEP));
		/** A step of at most half the band always fits on one side of the previous stop, so flipping once is enough. */
		if (y + direction * step < yMin || y + direction * step > yMax) direction = -direction;
		y = clamp(y + direction * step, yMin, yMax);
		direction = -direction;

		const roll = random();
		if (roll < 0.15 && !looped) {
			looped = true;
			const centerX = clamp(x, xMin + LOOP_RADIUS, xMax - LOOP_RADIUS);
			const centerY = clamp(y, yMin + LOOP_RADIUS, yMax - LOOP_RADIUS);
			const base = random() * 2 * Math.PI;
			for (let corner = 0; corner < 4; corner++) {
				const around = base + (corner * Math.PI) / 2;
				stops.push({
					easing: corner === 0 ? arrival(EASE) : 'linear',
					weight: 0.3,
					x: centerX + Math.cos(around) * LOOP_RADIUS,
					y: centerY + Math.sin(around) * LOOP_RADIUS,
				});
			}
			y = centerY;
		} else if (roll < 0.3 && !hesitated) {
			hesitated = true;
			stops.push({ easing: arrival(EASE), squash: true, weight: 1.2, x, y });
			stops.push({
				easing: EASE,
				squash: true,
				weight: 0.4,
				x: clamp(x + (random() - 0.5) * 2 * JITTER, xMin, xMax),
				y: clamp(y + (random() - 0.5) * 2 * JITTER, yMin, yMax),
			});
			dartNext = true;
		} else if (roll < 0.65) stops.push({ easing: arrival(DART), weight: 0.5, x, y });
		else stops.push({ easing: arrival(EASE), weight: 1, x, y });
	}
	stops.push({ easing: arrival('ease-in'), weight: 1, x: endX, y: endY });

	const total = stops.reduce((sum, stop) => sum + stop.weight, 0);
	const seconds = NEUTRINO_FLIGHT_MS / 1000;
	let elapsed = 0;
	let angle = 0;
	let stretch = 1;
	const keyframes = stops.map((stop, i): Keyframe => {
		elapsed += stop.weight;
		const next = stops[i + 1];
		if (next) {
			const [dx, dy] = [next.x - stop.x, next.y - stop.y];
			const distance = Math.hypot(dx, dy);
			if (distance > 0.5) {
				const heading = (Math.atan2(dy, dx) * 180) / Math.PI;
				/** Stays within half a turn of the previous heading, or the browser spins the long way round. */
				angle = heading - 360 * Math.round((heading - angle) / 360);
			}
			stretch = 1 + Math.min(MAX_STRETCH, (distance / ((next.weight / total) * seconds)) * STRETCH_PER_SPEED);
		}
		const [scaleX, scaleY] = stop.squash ? SQUASH : [stretch, 1 / stretch];
		return { ...(next && { easing: next.easing }), offset: elapsed / total, transform: frame(stop.x, stop.y, angle, scaleX, scaleY) };
	});
	return { durationMs: NEUTRINO_FLIGHT_MS, keyframes };
}
