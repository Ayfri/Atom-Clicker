import { type DailyQuest, getDailyCap, getQuestTarget, pickDailyQuests } from '$data/dailyQuests';
import { gameManager } from '$helpers/GameManager.svelte';
import type { QuestBehavior } from './types';

const DAY_MS = 24 * 3600 * 1000;

export class QuestTracker {
	private dayIndex = -1;
	private quests: DailyQuest[] = [];
	private targets: Record<string, number> = {};

	completedToday = 0;
	completedTotal = 0;
	offeredTotal = 0;
	quarks = 0;

	constructor(private behavior: QuestBehavior) {}

	reset(behavior: QuestBehavior) {
		this.behavior = behavior;
		this.completedToday = 0;
		this.completedTotal = 0;
		this.dayIndex = -1;
		this.offeredTotal = 0;
		this.quarks = 0;
		this.quests = [];
		this.targets = {};
	}

	get hasOpenDay(): boolean {
		return this.dayIndex !== -1;
	}

	/** Synthetic, deterministic day keys keep two runs of the same config reproducible. */
	checkDayRollover() {
		const dayIndex = Math.floor(gameManager.inGameTime / DAY_MS);
		if (dayIndex === this.dayIndex) return;

		if (this.dayIndex !== -1) this.settleDay();

		this.dayIndex = dayIndex;
		this.quests = pickDailyQuests(`sim-${dayIndex}`);
		this.targets = {};
		const anchors = {
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
		};
		for (const quest of this.quests) this.targets[quest.id] = getQuestTarget(quest, anchors);
		this.offeredTotal += this.quests.length;

		gameManager.dailyStats = {
			achievementsUnlocked: 0,
			atomsEarned: 0,
			buildingsPurchased: 0,
			clicks: 0,
			dayKey: `sim-${dayIndex}`,
			electronizes: 0,
			higgsBosonsCollected: 0,
			otherDailyQuestsCompleted: 0,
			powerUpsCollected: 0,
			protonises: 0,
			questIds: this.quests.map(quest => quest.id),
			questTargets: this.targets,
			upgradesPurchased: 0,
		};
	}

	/** Completion is measured for every archetype, claiming is gated by questBehavior. */
	settleDay() {
		const cap = getDailyCap(this.quests);
		let granted = 0;
		let completed = 0;

		for (const quest of this.quests) {
			const target = this.targets[quest.id] ?? quest.floor;
			if ((gameManager.dailyStats[quest.metric] ?? 0) < target) continue;

			completed += 1;
			this.completedTotal += 1;

			if (this.behavior === 'ignore') continue;
			if (granted + quest.reward > cap) continue;
			granted += quest.reward;
			this.quarks += quest.reward;
		}

		this.completedToday = completed;
	}

	/** 'dedicated' bots grind out the last stretch of a close-but-incomplete click quest instead of leaving it on the table. */
	steerDedicated() {
		if (this.behavior !== 'dedicated' || this.dayIndex === -1) return;
		if ((gameManager.inGameTime % DAY_MS) / DAY_MS < 0.7) return;

		for (const quest of this.quests) {
			if (quest.metric !== 'clicks') continue;
			const target = this.targets[quest.id] ?? quest.floor;
			if (gameManager.dailyStats.clicks >= target) continue;
			gameManager.dailyStats.clicks += 5;
		}
	}
}
