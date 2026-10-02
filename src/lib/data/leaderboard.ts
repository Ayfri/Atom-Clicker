/** Gold, silver and bronze, indexed by rank - 1. */
const PODIUM_COLORS = ['#facc15', '#d1d5db', '#d97706'] as const;

export function podiumColor(rank: number): string | null {
	return PODIUM_COLORS[rank - 1] ?? null;
}
