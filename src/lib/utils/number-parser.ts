/** Leaderboard atoms arrive as strings (plain, decimal or scientific), anything unreadable or infinite ranks as 0. */
function parseAtomsValue(atoms: string): number {
	const value = Number.parseFloat(atoms);
	return Number.isFinite(value) ? value : 0;
}

export function addRankToLeaderboard<T extends { atoms: string }>(entries: T[]): (T & { rank: number })[] {
	return entries
		.map(entry => ({ entry, value: parseAtomsValue(entry.atoms) }))
		.sort((a, b) => b.value - a.value)
		.map(({ entry }, index) => ({ ...entry, rank: index + 1 }));
}
