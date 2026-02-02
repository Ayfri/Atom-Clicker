import { gameManager } from '$helpers/GameManager.svelte';
import { browser } from '$app/environment';
import { supabaseAuth } from '$stores/supabaseAuth.svelte';
import type { LeaderboardEntry } from '$lib/types/leaderboard';
import { obfuscateClientData } from '$lib/utils/obfuscation';

const REFRESH_INTERVAL = 1 * 60_000; // 1 minute between leaderboard refreshes
const MIN_UPDATE_INTERVAL = 30_000; // 30 seconds minimum between updates

const MIN_ATOMS_CHANGE_PERCENT = 0.05; // 5% minimum change in atoms

interface LeaderboardStats {
	totalUsers: number;
}

interface LeaderboardData {
	entries: LeaderboardEntry[];
	stats: LeaderboardStats;
}

export class LeaderboardStore {
	entries = $state<LeaderboardEntry[]>([]);
	stats = $state<LeaderboardStats>({ totalUsers: 0 });
	isUpdating = $state(false);

	async fetchLeaderboard() {
		try {
			const userId = supabaseAuth.isAuthenticated ? supabaseAuth.user?.id : '';
			const response = await fetch(`/api/leaderboard?userId=${userId}`);
			if (!response.ok) throw new Error('Failed to fetch leaderboard');
			const data: LeaderboardData = await response.json();
			this.entries = data.entries;
			this.stats = data.stats;
		} catch (error) {
			console.error('Error fetching leaderboard:', error);
		}
	}

	async updateScore(atoms: number, level: number) {
		if (!browser || this.isUpdating) return;

		try {
			this.isUpdating = true;
			if (!supabaseAuth.isAuthenticated || !supabaseAuth.user) return;

			const username = supabaseAuth.profile?.username ??
				supabaseAuth.user.user_metadata?.username ??
				supabaseAuth.user.user_metadata?.full_name ??
				supabaseAuth.user.email?.split('@')[0] ??
				'Anonymous';

			const data = {
				username,
				atoms,
				level,
				userId: supabaseAuth.user.id,
				picture: supabaseAuth.profile?.picture ?? supabaseAuth.user.user_metadata?.avatar_url ?? supabaseAuth.user.user_metadata?.picture
			};

			const obfuscatedData = obfuscateClientData(data);

			const response = await fetch('/api/leaderboard', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(obfuscatedData)
			});

			if (!response.ok) {
				const errorData = await response.json();
				if (response.status === 429) {
					console.log(`Leaderboard rate limited. Next update in ${errorData.nextUpdateIn} seconds`);
					return;
				}
				throw new Error('Failed to update leaderboard');
			}

			// Refresh leaderboard after update
			await this.fetchLeaderboard();
		} catch (error) {
			console.error('Error updating leaderboard:', error);
		} finally {
			this.isUpdating = false;
		}
	}

	constructor() {
		if (browser) {
			this.fetchLeaderboard();
			setInterval(() => this.fetchLeaderboard(), REFRESH_INTERVAL);

			let lastAtoms = 0;
			let lastLevel = 0;
			let lastUpdate = 0;

			$effect.root(() => {
				$effect(() => {
					const atoms = gameManager.atoms;
					const level = gameManager.playerLevel;

					if (!supabaseAuth.isAuthenticated) return;

					const now = Date.now();
					if (now - lastUpdate < MIN_UPDATE_INTERVAL) return;

					const atomsChange = Math.abs(atoms - lastAtoms) / Math.max(lastAtoms, 1);
					const shouldUpdate =
						lastAtoms === 0 || // First update
						atomsChange > MIN_ATOMS_CHANGE_PERCENT || // Significant change in atoms
						level !== lastLevel; // Level change

					if (shouldUpdate) {
						lastAtoms = atoms;
						lastLevel = level;
						lastUpdate = now;
						this.updateScore(atoms, level);
					}
				});
			});
		}
	}
}

export const leaderboard = new LeaderboardStore();
