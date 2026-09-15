/**
 * The level curve is a pure function of the level, and `playerLevel` is re-derived on every tick because XP moves
 * with every atom earned. Walking the curve level by level made that O(level) with two `Math.pow` per step, so the
 * per-level cost and its running total are memoized once and the level itself comes out of a binary search.
 */
const XP_BASE = 100;
const XP_POLY = 1.1;
const XP_RATE = 1.55;

const levelCosts: number[] = [0];
const cumulativeCosts: number[] = [0];

/** XP(L) = base * L^poly * rate^(L-1): L^poly keeps early levels gentle, rate^(L-1) compounds each step. */
function computeXPForLevel(level: number): number {
	return Math.floor(XP_BASE * Math.pow(level, XP_POLY) * Math.pow(XP_RATE, level - 1));
}

function extendTo(level: number) {
	for (let i = levelCosts.length; i <= level; i++) {
		levelCosts[i] = computeXPForLevel(i);
		cumulativeCosts[i] = cumulativeCosts[i - 1] + levelCosts[i];
	}
}

export function xpForLevel(level: number): number {
	if (!Number.isFinite(level) || level < 1) return computeXPForLevel(level);
	extendTo(level);
	return levelCosts[level];
}

/** Total XP spent to sit at the start of `level`. */
export function totalXPForLevel(level: number): number {
	if (level < 1) return 0;
	extendTo(level);
	return cumulativeCosts[level];
}

export function levelFromTotalXP(totalXP: number): number {
	let level = 1;
	// The curve is exponential, so doubling reaches any reachable level in a handful of steps.
	extendTo(level);
	while (cumulativeCosts[level] <= totalXP) {
		level *= 2;
		extendTo(level);
	}

	let low = 0;
	let high = level;
	while (low < high) {
		const mid = (low + high + 1) >> 1;
		if (cumulativeCosts[mid] <= totalXP) low = mid;
		else high = mid - 1;
	}
	return low;
}
