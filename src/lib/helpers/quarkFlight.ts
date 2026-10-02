import { QUARK_CHARGE_COLORS } from '#data/quarks.js';

const ARC_STEPS = 12;
const CHARGE_COLORS = Object.values(QUARK_CHARGE_COLORS);
const FLIGHT_MS = 720;
const MAX_FLYERS = 12;
const MAX_SPARKS = 48;
const SPARKS_PER_SOURCE = 4;
const STAGGER_MS = 55;

/** Quadratic bezier from 0 to (`dx`, `dy`) bowing through (`bowX`, `bowY`), sampled into keyframes by `frame`. */
function arc(dx: number, dy: number, bowX: number, bowY: number, frame: (t: number, translate: string) => Keyframe): Keyframe[] {
	return Array.from({ length: ARC_STEPS + 1 }, (_, step) => {
		const t = step / ARC_STEPS;
		const x = 2 * (1 - t) * t * bowX + t * t * dx;
		const y = 2 * (1 - t) * t * bowY + t * t * dy;
		return frame(t, `translate(${x}px, ${y}px)`);
	});
}

function bump(element: Element) {
	element.animate([{ scale: 1 }, { scale: 1.15 }, { scale: 1 }], { duration: 200, easing: 'ease-out' });
}

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Colored sparks rise from every `sources` point into `target` and resolve once the last one landed. One-shot WAAPI on
 * transform and opacity, capped at 48 sparks, every spark removes itself.
 */
export function gatherSparks(sources: { x: number; y: number }[], target: Element, duration = 600): Promise<void> {
	const to = target.getBoundingClientRect();
	if (sources.length === 0 || !to.width || reducedMotion()) return Promise.resolve();

	const perSource = Math.max(1, Math.min(SPARKS_PER_SOURCE, Math.floor(MAX_SPARKS / sources.length)));
	const flights = sources.slice(0, MAX_SPARKS).flatMap(({ x, y }) =>
		Array.from({ length: perSource }, (_, i) => {
			const color = CHARGE_COLORS[i % CHARGE_COLORS.length];
			const size = 4 + Math.random() * 3;
			const spark = document.createElement('span');
			spark.style.cssText = `background:${color};border-radius:50%;box-shadow:0 0 6px ${color};height:${size}px;left:${x - size / 2}px;pointer-events:none;position:fixed;top:${y - size / 2}px;width:${size}px;z-index:100`;
			document.body.append(spark);

			const dx = to.left + Math.random() * to.width - x;
			const dy = to.top + to.height / 2 - y;
			/** The bow scales with the distance, so a short gather curls in instead of swinging wide. */
			const reach = Math.min(120, Math.hypot(dx, dy));
			const keyframes = arc(dx, dy, (Math.random() - 0.5) * reach, dy * 0.5 - (0.15 + Math.random() * 0.35) * reach, (t, translate) => ({
				opacity: t < 0.15 ? t / 0.15 : t > 0.9 ? 0.4 : 1,
				transform: `${translate} scale(${t < 0.15 ? 0.3 + (t / 0.15) * 0.9 : 1.2 - 0.6 * t})`,
			}));
			const animation = spark.animate(keyframes, { delay: Math.random() * 120, duration, easing: 'cubic-bezier(0.45, 0, 0.55, 1)', fill: 'backwards' });
			return animation.finished.then(() => {
				spark.remove();
				bump(target);
			});
		}),
	);
	return Promise.all(flights).then(() => undefined);
}

/**
 * Snapshots the icon inside `source` right away, since the claim button is gone by the time the server answers, and
 * returns a launcher that flies that many copies into the nav Quarks button along arcs. One-shot WAAPI on transform and
 * opacity, every flyer removes itself, so nothing outlives the flight.
 */
export function quarkFlight(source: Element): (count: number) => void {
	const icon = source.querySelector('svg');
	const from = icon?.getBoundingClientRect();

	return count => {
		const target = document.getElementById('nav-quarks');
		const to = target?.getBoundingClientRect();
		if (!icon || !from?.width || !target || !to?.width || count <= 0 || reducedMotion()) return;

		const dx = to.left + to.width / 2 - (from.left + from.width / 2);
		const dy = to.top + to.height / 2 - (from.top + from.height / 2);

		for (let i = 0; i < Math.min(count, MAX_FLYERS); i++) {
			const flyer = document.createElement('span');
			flyer.append(icon.cloneNode(true));
			flyer.style.cssText = `display:flex;left:${from.left}px;pointer-events:none;position:fixed;top:${from.top}px;z-index:100`;
			document.body.append(flyer);

			/** Each flyer bows out to a random side first, so a batch fans out instead of travelling as one dot. */
			const keyframes = arc(dx, dy, (Math.random() - 0.5) * 160, -40 - Math.random() * 80, (t, translate) => ({
				opacity: t > 0.85 ? (1 - t) / 0.15 : 1,
				transform: `${translate} scale(${1.4 - 0.6 * t})`,
			}));
			flyer.animate(keyframes, { delay: i * STAGGER_MS, duration: FLIGHT_MS, easing: 'cubic-bezier(0.45, 0, 0.8, 0.6)', fill: 'backwards' }).onfinish = () => {
				flyer.remove();
				bump(target);
			};
		}
	};
}
