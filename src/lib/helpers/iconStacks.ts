import type { IconName } from '$data/icons';
import { formatNumber } from '$lib/utils';

/** Beyond this many copies a stack stops reading as "several" and just looks noisy, so the count moves into the label. */
export const MAX_STACK_COUNT = 3;

export interface IconStackSpec {
	/** Tint applied to every copy (and the label). Defaults to the icon's own color when omitted. */
	color?: string;
	/** How many copies to draw, clamped to `MAX_STACK_COUNT`. */
	count?: number;
	icon: IconName;
	/** Short text badge drawn under the stack, for amounts too large to draw. */
	label?: string;
}

/**
 * Turns "the Nth tier of a series" into a stack: the first tiers grow by drawing one more copy of the
 * icon (1 Molecule, 2 Molecules, 3 Molecules), and every tier past that keeps the full 3-copy stack but
 * spells the amount out in a small badge instead of drawing an unreadable pile.
 */
export function tierIconStack(icon: IconName, tierIndex: number, tierValue?: number, color?: string): IconStackSpec {
	const count = Math.min(tierIndex + 1, MAX_STACK_COUNT);
	const label = tierIndex >= MAX_STACK_COUNT && tierValue !== undefined ? formatNumber(tierValue, 0) : undefined;
	return { color, count, icon, label };
}
