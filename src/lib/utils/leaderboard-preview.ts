import { gameManager } from '$helpers/GameManager.svelte';
import type { LeaderboardEntry } from '$lib/types/leaderboard';
import { supabaseAuth } from '$stores/supabaseAuth.svelte';

export function createCurrentPlayerPreview(bannerId: string): LeaderboardEntry {
	return {
		atoms: gameManager.atoms,
		equippedBanner: bannerId,
		is_online: supabaseAuth.isAuthenticated,
		lastUpdated: Date.now(),
		level: gameManager.playerLevel,
		picture: supabaseAuth.avatarUrl ?? undefined,
		rank: 1,
		username: supabaseAuth.displayName ?? 'Preview Player',
	};
}
