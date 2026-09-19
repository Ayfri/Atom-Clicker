/**
 * Parse atoms value to a comparable number
 * Handles scientific notation, decimal numbers, and string representations
 */
export function parseAtomsValue(atoms: string): number {
	if (!atoms || atoms === '0' || atoms === 'NaN' || atoms === 'Infinity') {
		return 0;
	}

	if (atoms.includes('e') || atoms.includes('E')) {
		try {
			return parseFloat(atoms);
		} catch {
			return 0;
		}
	}

	if (atoms.includes('.')) {
		try {
			return parseFloat(atoms);
		} catch {
			return 0;
		}
	}

	try {
		// For very large numbers, use parseFloat to avoid BigInt issues
		return parseFloat(atoms);
	} catch {
		return 0;
	}
}

function sortLeaderboardByAtoms<T extends { atoms: string }>(entries: T[]): T[] {
	return [...entries].sort((a, b) => {
		const atomsA = parseAtomsValue(a.atoms);
		const atomsB = parseAtomsValue(b.atoms);

		return atomsB - atomsA;
	});
}

export function addRankToLeaderboard<T extends { atoms: string }>(
	entries: T[]
): (T & { rank: number })[] {
	const sorted = sortLeaderboardByAtoms(entries);

	return sorted.map((entry, index) => ({
		...entry,
		rank: index + 1
	}));
}
