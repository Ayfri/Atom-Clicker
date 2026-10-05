import { gameManager } from '#helpers/GameManager.svelte.js';
import { browser } from '$app/env';
import { supabaseAuth } from '#stores/supabaseAuth.svelte.js';
import type { LeaderboardEntry } from '#lib/types/leaderboard.js';
import { obfuscateClientData } from '#lib/utils/obfuscation.js';
import { getJSON, setItem } from '#lib/utils/safeLocalStorage.js';
import { toastStore } from '#stores/toasts.svelte.js';

export const REFRESH_INTERVAL = 60_000; // 1 minute between leaderboard refreshes
const RANKS_KEY = 'atomic-clicker-leaderboard-ranks';
/** Above the server's 20 s per-player limit, so an honest client never meets a 429 from a single tab. */
const MIN_UPDATE_INTERVAL = 30_000;
/** A run the audit refuses keeps failing until it changes a lot, retrying it every 30 s only costs a full audit each time. */
const REJECTED_RETRY_INTERVAL = 5 * 60_000;

const MIN_ATOMS_CHANGE_PERCENT = 0.05; // 5% minimum change in atoms

interface LeaderboardStats {
	/** Players with a score, which a leaderboard reset brings far below the account count. */
	rankedPlayers: number;
	/** Every account, the community upgrade scales with it. */
	totalUsers: number;
}

type ScoreVerdict = 'outdated' | 'rejected' | 'rolled_back' | 'valid';

interface LeaderboardData {
	entries: LeaderboardEntry[];
	stats: LeaderboardStats;
}

export class LeaderboardStore {
	entries = $state.raw<LeaderboardEntry[]>([]);
	/** Bumped on every successful fetch, restarts the header's refresh countdown. */
	fetchedAt = $state(0);
	stats = $state<LeaderboardStats>({ rankedPlayers: 0, totalUsers: 0 });
	isUpdating = $state(false);
	onlineCount = $derived(this.entries.reduce((count, entry) => count + (entry.is_online ? 1 : 0), 0));
	playerIndex = $derived(this.entries.findIndex((entry) => entry.self));
	playerRank = $derived(this.playerIndex >= 0 ? this.entries[this.playerIndex].rank : null);
	playerPercentile = $derived(this.percentile(this.playerRank));
	/** Ranks from the previous time the leaderboard was open, null on a first visit so no row claims to be new. */
	previousRanks = $state.raw<Record<string, number> | null>(null);

	private hasFetched = false;
	/** Pushed back by every submission and by the server's answers (429 delay, 409 outdated game), the effect waits for it. */
	private nextSubmitAt = 0;
	private notified = new Set<ScoreVerdict>();
	private visiting = false;

	/** Rank 1 of 100 is the top 1%, never shown as 0%. */
	percentile(rank: number | null): number | null {
		return rank && this.stats.rankedPlayers
			? Math.max(1, Math.ceil(rank / this.stats.rankedPlayers * 100))
			: null;
	}

	/** Places climbed since the previous visit, positive when moving up, null for a player absent back then. */
	rankDelta(entry: LeaderboardEntry): number | null {
		const previous = entry.userId ? this.previousRanks?.[entry.userId] : undefined;
		return previous === undefined ? null : previous - entry.rank;
	}

	startVisit() {
		this.visiting = true;
		this.previousRanks = getJSON<Record<string, number> | null>(RANKS_KEY, null);
	}

	endVisit() {
		this.visiting = false;
	}

	private saveRanks() {
		setItem(RANKS_KEY, JSON.stringify(Object.fromEntries(this.entries.filter((entry) => entry.userId).map((entry) => [entry.userId, entry.rank]))));
	}

	/** Nothing on the main screen shows leaderboard data, so the list is only pulled once a panel asks for it. */
	async ensureLoaded() {
		if (this.hasFetched) return;
		await this.fetchLeaderboard();
	}

	async fetchLeaderboard() {
		this.hasFetched = true;
		try {
			const response = await fetch('/api/leaderboard');
			if (!response.ok) throw new Error('Failed to fetch leaderboard');
			const data: LeaderboardData = await response.json();
			/** The server caches one board for everyone, so the player's own row is marked here. */
			const userId = supabaseAuth.isAuthenticated ? supabaseAuth.user?.id : undefined;
			this.entries = userId ? data.entries.map((entry) => (entry.userId === userId ? { ...entry, self: true } : entry)) : data.entries;
			this.stats = data.stats;
			this.fetchedAt = Date.now();
			if (this.visiting) this.saveRanks();
		} catch (error) {
			console.error('Error fetching leaderboard:', error);
		}
	}

	/** A run that fails keeps failing on every submission until the next Protonize, so each verdict is told once per session. */
	private notifyOnce(key: ScoreVerdict, message: string) {
		if (this.notified.has(key)) return;
		this.notified.add(key);
		toastStore.warning({ duration: 15_000, message, title: 'Leaderboard' });
	}

	/** Sends the whole game state, the server audits it and reads the score from it, see /api/leaderboard. */
	async updateScore() {
		if (!browser || this.isUpdating) return;
		// Skip submission for saves flagged by the integrity checks, see plausibility.ts.
		if (gameManager.integrityFlagged || gameManager.saveIntegrityWarnings.length > 0) return;

		try {
			this.isUpdating = true;
			if (!supabaseAuth || !supabaseAuth.isAuthenticated || !supabaseAuth.user) return;

			const accessToken = await supabaseAuth.getAccessToken();
			if (!accessToken) return;
			this.nextSubmitAt = Date.now() + MIN_UPDATE_INTERVAL;

			const { dailyStats, settings, tutorial, ...state } = gameManager.getCurrentState();
			const data = {
				picture: supabaseAuth.avatarUrl ?? undefined,
				state,
				username: supabaseAuth.displayName ?? 'Anonymous',
			};

			const response = await fetch('/api/leaderboard', {
				body: JSON.stringify(obfuscateClientData(data)),
				headers: {
					'Authorization': `Bearer ${accessToken}`,
					'Content-Type': 'application/json',
				},
				method: 'POST',
			});

			if (response.status === 409) {
				this.nextSubmitAt = Infinity;
				this.notifyOnce('outdated', 'The game was updated, reload the page to keep submitting your score.');
				return;
			}
			if (response.status === 429) {
				const { nextUpdateIn } = (await response.json()) as { nextUpdateIn: number };
				this.nextSubmitAt = Date.now() + nextUpdateIn * 1000;
				return;
			}
			if (!response.ok) throw new Error('Failed to update leaderboard');

			const { issues, status } = (await response.json()) as { issues: string[]; status: ScoreVerdict };
			if (status !== 'valid') this.nextSubmitAt = Date.now() + REJECTED_RETRY_INTERVAL;
			if (status === 'rolled_back') {
				this.notifyOnce(status, "This run couldn't be verified, so your leaderboard entry went back to your last verified score. Your next Protonize starts a run that counts again.");
			} else if (status === 'rejected') {
				this.notifyOnce(status, "This run couldn't be verified, so it isn't submitted. Your leaderboard entry stays as it was.");
			}
			if (issues.length > 0) console.warn('Leaderboard checks failed:', issues);

			if (this.hasFetched) await this.fetchLeaderboard();
		} catch (error) {
			console.error('Error updating leaderboard:', error);
		} finally {
			this.isUpdating = false;
		}
	}

	constructor() {
		if (browser) {
			let lastAtoms = 0;
			let lastLevel = 0;

			$effect.root(() => {
				$effect(() => {
					const atoms = gameManager.atoms;
					const level = gameManager.playerLevel;
					if (!supabaseAuth.isAuthenticated || this.isUpdating || Date.now() < this.nextSubmitAt) return;

					const atomsChange = Math.abs(atoms - lastAtoms) / Math.max(lastAtoms, 1);
					if (lastAtoms !== 0 && atomsChange <= MIN_ATOMS_CHANGE_PERCENT && level === lastLevel) return;

					lastAtoms = atoms;
					lastLevel = level;
					this.updateScore();
				});
			});
		}
	}
}

export const leaderboard = new LeaderboardStore();
