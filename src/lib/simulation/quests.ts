import { DAILY_QUEST_COUNT, type DailyQuest, getDailyCap, getQuestProgress, getQuestTarget, pickDailyQuests } from '#data/dailyQuests.js';
import { gameManager } from '#helpers/GameManager.svelte.js';
import { radiationManager } from '#helpers/RadiationManager.svelte.js';
import { statsConfig } from '#helpers/statConstants.js';
import type { QuestBehavior, QuestOutcome } from './types';

const DAY_MS = 24 * 3600 * 1000;

export class QuestTracker {
	private dayIndex = -1;
	private quests: DailyQuest[] = [];
	private targets: Record<string, number> = {};

	breakdown: Record<string, QuestOutcome> = {};
	completedToday = 0;
	completedTotal = 0;
	offeredTotal = 0;
	quarks = 0;

	constructor(private readonly behavior: QuestBehavior) {}

	get hasOpenDay(): boolean {
		return this.dayIndex !== -1;
	}

	/** Synthetic, deterministic day keys keep two runs of the same config reproducible. */
	checkDayRollover() {
		const dayIndex = Math.floor(gameManager.inGameTime / DAY_MS);
		if (dayIndex === this.dayIndex) return;

		if (this.dayIndex !== -1) this.settleDay();

		this.dayIndex = dayIndex;
		const context = gameManager.dailyQuestContext(false);
		this.quests = pickDailyQuests(`sim-${dayIndex}`, DAILY_QUEST_COUNT, context);
		this.targets = {};
		for (const quest of this.quests) this.targets[quest.id] = getQuestTarget(quest, context);

		gameManager.dailyStats = {
			...statsConfig.dailyStats.defaultValue,
			dayKey: `sim-${dayIndex}`,
			questIds: this.quests.map(quest => quest.id),
			questTargets: this.targets,
		};
	}

	/** Completion is measured for every archetype, claiming is gated by questBehavior. A run ending on a day boundary opens a day it never plays. */
	settleDay() {
		if (gameManager.inGameTime <= this.dayIndex * DAY_MS) return;
		this.offeredTotal += this.quests.length;
		const cap = getDailyCap(this.quests);
		let granted = 0;
		let completed = 0;

		for (const quest of this.quests) {
			const target = this.targets[quest.id] ?? quest.floor;
			const progress = getQuestProgress(quest.metric, gameManager.dailyStats);
			const outcome = (this.breakdown[quest.id] ??= { completed: 0, lastProgress: 0, lastTarget: 0, offered: 0 });
			outcome.offered += 1;
			outcome.lastProgress = progress;
			outcome.lastTarget = target;
			if (progress < target) continue;

			outcome.completed += 1;
			completed += 1;
			this.completedTotal += 1;

			if (this.behavior === 'ignore') continue;
			if (granted + quest.reward > cap) continue;
			granted += quest.reward;
			this.quarks += quest.reward;
		}

		this.completedToday = completed;
	}

	/** 'dedicated' bots grind out the last stretch of a click quest and inject the fuel a fuel quest still misses, instead of leaving them on the table. */
	steerDedicated() {
		if (this.behavior !== 'dedicated' || this.dayIndex === -1) return;
		if ((gameManager.inGameTime % DAY_MS) / DAY_MS < 0.7) return;

		for (const quest of this.quests) {
			const target = this.targets[quest.id] ?? quest.floor;
			if (quest.metric === 'clicks' && gameManager.dailyStats.clicks < target) gameManager.dailyStats.clicks += 5;
			if (quest.metric !== 'fuelInjected') continue;
			const missing = Math.ceil((target - gameManager.dailyStats.fuelInjected) / radiationManager.massPerElectron);
			if (missing > 0) gameManager.injectFuel(Math.min(Math.floor(gameManager.electrons), missing));
		}
	}
}
