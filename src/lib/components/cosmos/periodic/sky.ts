import { wavelengthColor } from '#data/elements.js';
import type { SiteId } from '#data/sites.js';

/** What each nucleosynthesis site looks like from the Earth, as a round disc. */
export const SKY: Record<SiteId, string> = {
	accelerator:
		'radial-gradient(circle, #e6ecff 0 4%, transparent 7%), radial-gradient(circle, transparent 52%, #8a93a6 55%, #5b6375 58%, transparent 61%), radial-gradient(circle, #1a2030, #0b0f1c)',
	bigbang:
		'radial-gradient(circle at 30% 35%, #ffcf9a88 0, transparent 30%), radial-gradient(circle at 68% 62%, #8fb4ff99 0, transparent 34%), radial-gradient(circle at 62% 26%, #ff9f8a66 0, transparent 24%), radial-gradient(circle at 34% 72%, #9db8ff77 0, transparent 26%), radial-gradient(circle, #2c2350, #0b0f1c)',
	cosmic:
		'repeating-linear-gradient(118deg, transparent 0 7px, #6ff0c477 7px 8px, transparent 8px 15px), radial-gradient(circle at 50% 135%, #3d8bd6 0 52%, #9fd3ff 54%, transparent 57%), radial-gradient(circle, #10283a, #0b0f1c)',
	decay: 'radial-gradient(circle, #e9ffb0 0 7%, #c6f36b 14%, #c6f36b55 32%, transparent 60%), radial-gradient(circle at 60% 70%, #3a3a2a, #0b0f1c)',
	lowmass: 'radial-gradient(circle, #fff3d6 0 8%, #ffb36b 20%, #ff7a3d 36%, #ff7a3d33 52%, transparent 70%), #0b0f1c',
	massive:
		'radial-gradient(circle, #ffffff 0 4%, #ffb3c3 10%, transparent 22%), conic-gradient(from 10deg, #ff6b8b55, transparent 8%, #ff6b8b44 18%, transparent 27%, #ffa06b55 40%, transparent 50%, #ff6b8b55 63%, transparent 72%, #b98aff44 85%, transparent 94%), radial-gradient(circle, #3a1730, #0b0f1c 72%)',
	neutron:
		'radial-gradient(circle at 42% 50%, #ffffff 0 5%, transparent 8%), radial-gradient(circle at 58% 50%, #ffffff 0 5%, transparent 8%), radial-gradient(ellipse 70% 35%, #e5d6ff 0 12%, #b98aff88 30%, transparent 62%), radial-gradient(circle, #1f1636, #0b0f1c)',
	reactor: 'radial-gradient(circle, #e8f7ff 0 6%, #7fc8ff 18%, #3b6cff 36%, #3b6cff33 56%, transparent 72%), #0b0f1c',
	whitedwarf:
		'radial-gradient(circle, #ffffff 0 5%, #e6ecff55 9%, transparent 14%), radial-gradient(circle, transparent 40%, #e6ecff66 47%, #9db8ff33 53%, transparent 60%), radial-gradient(circle, #141a2e, #0b0f1c)',
};

/** The visible spectrum from violet to red. */
export const SPECTRUM = `linear-gradient(90deg, ${[380, 420, 450, 480, 510, 550, 580, 610, 650, 700, 780].map(wavelengthColor).join(', ')})`;
