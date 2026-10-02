import { gameManager } from '#helpers/GameManager.svelte.js';
import type { LeaderboardEntry } from '#lib/types/leaderboard.js';
import { supabaseAuth } from '#stores/supabaseAuth.svelte.js';

export function createCurrentPlayerPreview(bannerId: string): LeaderboardEntry {
	return {
		atoms: gameManager.atoms,
		equippedBanner: bannerId,
		is_online: supabaseAuth.isAuthenticated,
		lastSeen: Date.now(),
		level: gameManager.playerLevel,
		picture: supabaseAuth.avatarUrl ?? undefined,
		rank: 1,
		username: supabaseAuth.displayName ?? 'Preview Player',
	};
}
