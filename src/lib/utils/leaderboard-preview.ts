import { gameManager } from '#helpers/GameManager.svelte.js';
import type { LeaderboardEntry } from '#lib/types/leaderboard.js';
import { supabaseAuth } from '#stores/supabaseAuth.svelte.js';
import { untrack } from 'svelte';

/** Atoms are read untracked, otherwise every 50 Hz commit rebuilds each banner preview row. */
export function createCurrentPlayerPreview(bannerId: string): LeaderboardEntry {
	return {
		atoms: untrack(() => gameManager.atoms),
		equippedBanner: bannerId,
		is_online: supabaseAuth.isAuthenticated,
		lastSeen: Date.now(),
		level: gameManager.playerLevel,
		picture: supabaseAuth.avatarUrl ?? undefined,
		rank: 1,
		username: supabaseAuth.displayName ?? 'Preview Player',
	};
}
