import { browser, dev } from '$app/environment';
import { ACHIEVEMENTS } from '$data/achievements';
import {
	DAILY_QUEST_COUNT,
	type DailyQuest,
	type DailyQuestContext,
	getDailyQuestCount,
	getQuestTarget,
	pickDailyQuests,
	QUEST_POOL,
} from '$data/dailyQuests';
import { getQuarkShopItem } from '$data/quarkShop';
import { RealmTypes, type RealmType } from '$data/realms';
import type { Effect } from '$lib/types';
import { obfuscateClientData } from '$lib/utils/obfuscation';
import { gameManager } from '$helpers/GameManager.svelte';
import { supabaseAuth } from '$stores/supabaseAuth.svelte';
import { toastStore } from '$stores/toasts.svelte';

// NOTE: this manager may read `gameManager`, but `gameManager` never imports this module.
// src/lib/simulation/engine.ts and simulation.worker.ts import GameManager and run in a Web
// Worker with no auth context and no DOM - if QuarksManager got pulled into that import graph
// it would attempt to fetch() from inside the worker. GameManager instead exposes a plain
// `quarkBoostEffects` field that this manager pushes into, see GameManager.svelte.ts.

interface QuarksApiState {
	balance: number;
	claimedAchievementIds: string[];
	claimedQuestIds: string[];
	dailyCap: number;
	dayKey: string;
	entitlements: string[];
	equippedBanner: string | null;
	equippedThemes: Partial<Record<RealmType, string>>;
	quests: DailyQuest[];
}

export class QuarksManager {
	pendingActions = $state<string[]>([]);
	balance = $state(0);
	claimedAchievementIds = $state<string[]>([]);
	claimedQuestIds = $state<string[]>([]);
	dayKey = $state('');
	/**
	 * DevTools-only local override mode: every method operates purely in-memory and skips the
	 * network. Never persisted (not to the save blob, not to localStorage), and the setter is
	 * guarded by `dev` as defence in depth so it cannot survive into a production build.
	 */
	devOverride = $state(false);
	entitlements = $state<string[]>([]);
	equippedBanner = $state<string | null>(null);
	equippedThemes = $state<Partial<Record<RealmType, string>>>({});
	hasSynced = $state(false);
	lastSyncError = $state<string | null>(null);
	loading = $state(false);
	quests = $state<DailyQuest[]>(QUEST_POOL.slice(0, DAILY_QUEST_COUNT));
	private syncPromise: Promise<void> | null = null;

	dailyQuestCount = $derived(getDailyQuestCount(this.entitlements));

	dailyQuestContext = $derived<DailyQuestContext>({
		hasElectronized: gameManager.totalElectronizesAllTime > 0,
		hasPhotonRealm: gameManager.realms[RealmTypes.PHOTONS]?.unlocked ?? false,
		hasThirdQuestSlot: this.dailyQuestCount > DAILY_QUEST_COUNT,
		remainingAchievements: Object.keys(ACHIEVEMENTS).filter(id => !gameManager.achievements.includes(id)).length,
	});

	ownedBoostEffects = $derived.by<Effect[]>(() => {
		return this.entitlements
			.map(id => getQuarkShopItem(id))
			.filter(item => item?.type === 'boost' || item?.type === 'convenience')
			.flatMap(item => item?.effects ?? []);
	});

	hasClaimableQuest = $derived.by(() => {
		return this.quests.some(quest => !this.claimedQuestIds.includes(quest.id) && this.isQuestComplete(quest));
	});

	hasClaimableAchievement = $derived.by(() => {
		return gameManager.achievements.some(id => id in ACHIEVEMENTS && !this.claimedAchievementIds.includes(id));
	});

	setDevOverride(value: boolean) {
		if (!dev) return;
		this.devOverride = value;
	}

	isActionPending(actionId: string): boolean {
		return this.pendingActions.includes(actionId);
	}

	clear() {
		this.balance = 0;
		this.claimedAchievementIds = [];
		this.claimedQuestIds = [];
		this.dayKey = '';
		this.entitlements = [];
		this.equippedBanner = null;
		this.equippedThemes = {};
		this.hasSynced = false;
		this.lastSyncError = null;
		this.quests = QUEST_POOL.slice(0, DAILY_QUEST_COUNT);
		this.applyBoostEffects();
	}

	/** Pushes owned boost/convenience effects and entitlements into GameManager. Called whenever `entitlements` changes. */
	private applyBoostEffects() {
		gameManager.quarkBoostEffects = this.ownedBoostEffects;
		gameManager.quarkEntitlements = this.entitlements;
	}

	isQuestComplete(quest: DailyQuest): boolean {
		return this.getProgress(quest) >= this.getTarget(quest);
	}

	getTarget(quest: DailyQuest): number {
		const frozen = gameManager.dailyStats.questTargets[quest.id];
		if (typeof frozen === 'number') return frozen;
		// Not frozen yet (e.g. before the first sync), fall back to a live estimate.
		return getQuestTarget(quest, {
			achievementsUnlocked: 0,
			atomsEarned: gameManager.highestAPS,
			buildingsPurchased: 0,
			clicks: 0,
			electronizes: 0,
			higgsBosonsCollected: 0,
			otherDailyQuestsCompleted: 0,
			powerUpsCollected: 0,
			protonises: 0,
			upgradesPurchased: 0,
		});
	}

	getProgress(quest: DailyQuest): number {
		if (quest.metric === 'otherDailyQuestsCompleted') {
			return this.quests.filter(otherQuest => otherQuest.id !== quest.id && this.isQuestComplete(otherQuest)).length;
		}
		return gameManager.dailyStats[quest.metric] ?? 0;
	}

	private selectDailyQuests(dayKey: string): DailyQuest[] {
		const storedQuestIds = gameManager.dailyStats.dayKey === dayKey ? gameManager.dailyStats.questIds ?? [] : [];
		if (storedQuestIds.length === this.dailyQuestCount) {
			return storedQuestIds.map(id => QUEST_POOL.find(quest => quest.id === id)).filter((quest): quest is DailyQuest => !!quest);
		}
		return pickDailyQuests(dayKey, this.dailyQuestCount, this.dailyQuestContext);
	}

	private persistDailyQuestSelection(dayKey: string) {
		if (gameManager.dailyStats.dayKey !== dayKey || gameManager.dailyStats.questIds?.length === this.quests.length) return;

		const questTargets = { ...gameManager.dailyStats.questTargets };
		for (const quest of this.quests) {
			questTargets[quest.id] ??= this.getTarget(quest);
		}
		gameManager.dailyStats = { ...gameManager.dailyStats, questIds: this.quests.map(quest => quest.id), questTargets };
	}

	private async authHeaders(): Promise<Record<string, string> | null> {
		if (!browser || !supabaseAuth.isAuthenticated) return null;
		const accessToken = await supabaseAuth.getAccessToken();
		if (!accessToken) return null;
		return { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' };
	}

	private rolloverDailyStatsIfNeeded(serverDayKey: string) {
		if (gameManager.dailyStats.dayKey === serverDayKey) return;

		const questTargets: Record<string, number> = {};
		for (const quest of this.quests) {
			questTargets[quest.id] = this.getTarget(quest);
		}

		gameManager.dailyStats = {
			achievementsUnlocked: 0,
			atomsEarned: 0,
			buildingsPurchased: 0,
			clicks: 0,
			dayKey: serverDayKey,
			electronizes: 0,
			higgsBosonsCollected: 0,
			otherDailyQuestsCompleted: 0,
			powerUpsCollected: 0,
			protonises: 0,
			questIds: this.quests.map(quest => quest.id),
			questTargets,
			upgradesPurchased: 0,
		};
	}

	async sync() {
		if (this.syncPromise) return this.syncPromise;
		this.syncPromise = this.syncInternal();
		try {
			await this.syncPromise;
		} finally {
			this.syncPromise = null;
		}
	}

	private async syncInternal() {
		if (!browser) return;

		if (this.devOverride) {
			const dayKey = new Date().toISOString().slice(0, 10);
			this.dayKey = dayKey;
			this.quests = this.selectDailyQuests(dayKey);
			this.rolloverDailyStatsIfNeeded(dayKey);
			this.persistDailyQuestSelection(dayKey);
			return;
		}
		if (!supabaseAuth.isAuthenticated) {
			this.clear();
			return;
		}

		this.loading = true;
		this.hasSynced = false;
		try {
			const headers = await this.authHeaders();
			if (!headers) {
				this.clear();
				return;
			}
			const response = await fetch('/api/quarks', { headers: headers ?? undefined });
			if (!response.ok) throw new Error(`Sync failed with status ${response.status}`);

			const data: QuarksApiState = await response.json();
			this.balance = data.balance;
			this.claimedAchievementIds = data.claimedAchievementIds;
			this.claimedQuestIds = data.claimedQuestIds;
			this.dayKey = data.dayKey;
			this.entitlements = data.entitlements;
			this.equippedBanner = data.equippedBanner;
			this.equippedThemes = data.equippedThemes;
			// Quests carry a `description` function, which JSON can't transport - recompute them
			// client-side from the (deterministic, seeded) pool instead of trusting the wire payload.
			this.quests = this.selectDailyQuests(data.dayKey);
			this.persistDailyQuestSelection(data.dayKey);
			this.lastSyncError = null;
			this.hasSynced = true;
			this.applyBoostEffects();

			this.rolloverDailyStatsIfNeeded(data.dayKey);
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown sync error';
			this.lastSyncError = message;
			toastStore.error({ message: 'Could not sync Quarks with the server.', title: 'Quarks sync failed' });
		} finally {
			this.loading = false;
		}
	}

	private async postAction<T>(path: string, body: Record<string, unknown>, actionId: string): Promise<T | null> {
		if (this.isActionPending(actionId)) return null;
		this.pendingActions = [...this.pendingActions, actionId];
		try {
			const headers = await this.authHeaders();
			if (!headers) {
				toastStore.error({ message: 'Sign in to use Quarks.', title: 'Not signed in' });
				return null;
			}

			const response = await fetch(path, {
				body: JSON.stringify(obfuscateClientData(body)),
				headers,
				method: 'POST',
			});
			const result = await response.json();
			if (!response.ok) {
				toastStore.error({ message: result.error ?? 'Request failed.', title: 'Quarks' });
				return null;
			}
			return result as T;
		} catch (error) {
			toastStore.error({ message: 'Network error while talking to Quarks.', title: 'Quarks' });
			return null;
		} finally {
			this.pendingActions = this.pendingActions.filter(id => id !== actionId);
		}
	}

	async claimQuest(questId: string) {
		if (this.devOverride) {
			if (this.claimedQuestIds.includes(questId)) return;
			const quest = this.quests.find(q => q.id === questId);
			if (!quest) return;
			this.balance += quest.reward;
			this.claimedQuestIds = [...this.claimedQuestIds, questId];
			return;
		}

		const result = await this.postAction<{ balance: number; status: string }>('/api/quarks/claim', { questId }, `claim-quest:${questId}`);
		if (!result) return;

		if (result.status === 'ok') {
			this.balance = result.balance;
			this.claimedQuestIds = [...this.claimedQuestIds, questId];
			const quest = this.quests.find(q => q.id === questId);
			toastStore.info({ message: quest ? quest.description(this.getTarget(quest)) : 'Quest claimed.', title: '+1 Quark' });
		} else if (result.status === 'already_claimed') {
			this.claimedQuestIds = [...new Set([...this.claimedQuestIds, questId])];
		}
	}

	async claimAchievement(achievementId: string) {
		if (this.claimedAchievementIds.includes(achievementId)) return;
		const result = await this.postAction<{ balance: number; granted: number }>('/api/quarks/achievement', {
			achievementIds: [achievementId],
		}, `claim-achievement:${achievementId}`);
		if (!result) return;

		this.balance = result.balance;
		this.claimedAchievementIds = [...new Set([...this.claimedAchievementIds, achievementId])];
		if (result.granted > 0) {
			toastStore.info({ message: 'Achievement reward claimed.', title: '+1 Quark' });
		}
	}

	async claimAchievements(achievementIds: string[]) {
		const idsToClaim = achievementIds.filter(id => !this.claimedAchievementIds.includes(id));
		if (idsToClaim.length === 0) return;

		const result = await this.postAction<{ balance: number; granted: number }>('/api/quarks/achievement', { achievementIds: idsToClaim }, 'claim-achievements');
		if (!result) return;

		this.balance = result.balance;
		this.claimedAchievementIds = [...new Set([...this.claimedAchievementIds, ...idsToClaim])];
		if (result.granted > 0) {
			toastStore.info({ message: `${result.granted} achievement rewards claimed.`, title: `+${result.granted} Quarks` });
		}
	}

	async collectHiggsBoson() {
		if (this.devOverride) {
			if (Math.random() < 1 / 300) this.balance += 1;
			return;
		}
		if (!supabaseAuth.isAuthenticated) return;

		const result = await this.postAction<{ balance?: number; granted: number }>('/api/quarks/higgs', {}, 'collect-higgs');
		if (!result) return;

		if (typeof result.balance === 'number') this.balance = result.balance;
		if (result.granted > 0) {
			toastStore.info({ message: 'A Higgs Boson released a Quark.', title: '+1 Quark' });
		}
	}

	async purchase(itemId: string) {
		if (this.devOverride) {
			if (this.entitlements.includes(itemId)) return;
			const item = getQuarkShopItem(itemId);
			if (!item) return;
			this.balance -= item.cost;
			this.entitlements = [...this.entitlements, itemId];
			this.quests = this.selectDailyQuests(this.dayKey);
			this.applyBoostEffects();
			return;
		}

		const result = await this.postAction<{ balance: number; status: string }>('/api/quarks/purchase', { itemId }, `purchase:${itemId}`);
		if (!result) return;

		if (result.status === 'ok') {
			this.balance = result.balance;
			this.entitlements = [...this.entitlements, itemId];
			this.quests = this.selectDailyQuests(this.dayKey);
			this.applyBoostEffects();
		} else {
			toastStore.error({ message: result.status.replaceAll('_', ' '), title: 'Purchase failed' });
		}
	}

	async refund(itemId: string) {
		const item = getQuarkShopItem(itemId);
		if (item?.type === 'theme' || item?.type === 'banner') return;

		if (this.devOverride) {
			if (!this.entitlements.includes(itemId) || !item) return;
			this.balance += item.cost;
			this.entitlements = this.entitlements.filter(id => id !== itemId);
			this.quests = this.selectDailyQuests(this.dayKey);
			this.applyBoostEffects();
			return;
		}

		const result = await this.postAction<{ balance: number; refunded?: number; status: string }>('/api/quarks/refund', { itemId }, `refund:${itemId}`);
		if (!result) return;

		if (result.status === 'ok') {
			this.balance = result.balance;
			this.entitlements = this.entitlements.filter(id => id !== itemId);
			this.quests = this.selectDailyQuests(this.dayKey);
			this.applyBoostEffects();
		} else {
			toastStore.error({ message: result.status.replaceAll('_', ' '), title: 'Refund failed' });
		}
	}

	/** DevTools-only: previews a theme locally without touching the server. */
	previewTheme(realmId: RealmType, itemId: string | null) {
		if (!dev) return;
		const next = { ...this.equippedThemes };
		if (itemId) next[realmId] = itemId;
		else delete next[realmId];
		this.equippedThemes = next;
	}

	async equipTheme(realmId: RealmType, itemId: string | null) {
		if (this.devOverride) {
			const next = { ...this.equippedThemes };
			if (itemId) next[realmId] = itemId;
			else delete next[realmId];
			this.equippedThemes = next;
			return;
		}

		const result = await this.postAction<{ equippedThemes: Partial<Record<RealmType, string>> }>('/api/quarks/equip-theme', {
			itemId,
			realmId,
		}, `equip-theme:${realmId}`);
		if (!result) return;

		this.equippedThemes = result.equippedThemes;
	}

	/** DevTools-only: previews a banner locally without touching the server. */
	previewBanner(itemId: string | null) {
		if (!dev) return;
		this.equippedBanner = itemId;
	}

	async equipBanner(itemId: string | null) {
		if (this.devOverride) {
			this.equippedBanner = itemId;
			return;
		}

		const result = await this.postAction<{ equippedBanner: string | null }>('/api/quarks/equip-banner', { itemId }, 'equip-banner');
		if (!result) return;

		this.equippedBanner = result.equippedBanner;
	}
}

export const quarksManager = new QuarksManager();
