const MAX_FLYERS = 12;
const FLIGHT_MS = 720;
const STAGGER_MS = 55;
const ARC_STEPS = 12;

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
		if (!icon || !from?.width || !to?.width || count <= 0 || matchMedia('(prefers-reduced-motion: reduce)').matches) return;

		const dx = to.left + to.width / 2 - (from.left + from.width / 2);
		const dy = to.top + to.height / 2 - (from.top + from.height / 2);

		for (let i = 0; i < Math.min(count, MAX_FLYERS); i++) {
			const flyer = document.createElement('span');
			flyer.append(icon.cloneNode(true));
			flyer.style.cssText = `display:flex;left:${from.left}px;pointer-events:none;position:fixed;top:${from.top}px;z-index:100`;
			document.body.append(flyer);

			/** Each flyer bows out to a random side first, so a batch fans out instead of travelling as one dot. */
			const bowX = (Math.random() - 0.5) * 160;
			const bowY = -40 - Math.random() * 80;
			const keyframes: Keyframe[] = Array.from({ length: ARC_STEPS + 1 }, (_, step) => {
				const t = step / ARC_STEPS;
				const x = 2 * (1 - t) * t * bowX + t * t * dx;
				const y = 2 * (1 - t) * t * bowY + t * t * dy;
				return { opacity: t > 0.85 ? (1 - t) / 0.15 : 1, transform: `translate(${x}px, ${y}px) scale(${1.4 - 0.6 * t})` };
			});
			flyer.animate(keyframes, { delay: i * STAGGER_MS, duration: FLIGHT_MS, easing: 'cubic-bezier(0.45, 0, 0.8, 0.6)', fill: 'backwards' }).onfinish = () => {
				flyer.remove();
				target?.animate([{ scale: 1 }, { scale: 1.2 }, { scale: 1 }], { duration: 220, easing: 'ease-out' });
			};
		}
	};
}
