<script lang="ts">
	import Tooltip from '@components/ui/Tooltip.svelte';
	import { Dices, Info, Pause, Play, Settings, Zap } from '@lucide/svelte';
	import {
		ACTIVITY_PRESETS,
		BOT_PROFILES,
		PLAYSTYLE_PRESETS,
		PRESTIGE_PRESETS,
		profileForm,
		type BenchmarkForm,
		type BotProfileId,
	} from '$lib/simulation/presets';
	import type { BenchmarkConfig, QuestBehavior } from '$lib/simulation/types';
	import { formatNumber } from '$lib/utils';

	interface Props {
		config: BenchmarkConfig;
		form: BenchmarkForm;
		isRunning: boolean;
		onRun: () => void;
		onStop: () => void;
	}

	let { config, form = $bindable(), isRunning, onRun, onStop }: Props = $props();

	const DURATION_PRESETS = [24, 72, 168] as const;
	const QUEST_BEHAVIOR_OPTIONS: { id: QuestBehavior; label: string }[] = [
		{ id: 'ignore', label: 'Ignore (never claims)' },
		{ id: 'passive', label: 'Passive (claims what completes)' },
		{ id: 'dedicated', label: 'Dedicated (steers toward targets)' },
	];
	const SNAPSHOT_PRESETS = [
		{ label: '15s', value: 15 },
		{ label: '1m', value: 60 },
		{ label: '2m', value: 120 },
		{ label: '5m', value: 300 },
		{ label: '10m', value: 600 },
	] as const;
	/** Past this many points the live charts start to lag and saved reports weigh megabytes. */
	const SNAPSHOT_WARNING = 20_000;

	const snapshotCount = $derived(Math.floor((form.targetHours * 3600) / Math.max(1, form.snapshotInterval)));
	const isProfile = (id: BotProfileId) => {
		const profile = BOT_PROFILES[id];
		return form.activityId === profile.activityId && form.playstyleId === profile.playstyleId && form.prestigeId === profile.prestigeId;
	};

	function onPlaystyleChange() {
		const { questBehavior, snapshotInterval } = PLAYSTYLE_PRESETS[form.playstyleId];
		form.questBehavior = questBehavior;
		form.snapshotInterval = snapshotInterval;
	}

	const chip = (active: boolean) =>
		`cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 px-2.5 py-1 rounded-md text-xs transition-colors ${active ? 'bg-green-500/25 border border-green-500/40 text-green-400' : 'bg-white/5 border border-transparent hover:bg-white/10 text-gray-400'}`;
	const field =
		'bg-slate-800 border border-white/10 disabled:cursor-not-allowed disabled:opacity-50 focus:border-green-400 focus:outline-none px-3 py-2 rounded-lg text-gray-200 text-sm w-full';
</script>

{#snippet stat(label: string, value: string, color: string, help?: string)}
	<div class="flex flex-col gap-1">
		<span class="flex gap-1 items-center text-gray-500 text-sm">
			{label}
			{#if help}
				<Tooltip size="lg">
					<Info
						class="opacity-70 text-gray-500"
						size={14}
					/>
					{#snippet content()}
						<p class="max-w-xs text-sm">{help}</p>
					{/snippet}
				</Tooltip>
			{/if}
		</span>
		<span class="font-medium text-base {color}">{value}</span>
	</div>
{/snippet}

<section class="backdrop-blur-xl bg-white/5 border border-white/10 flex flex-col gap-8 p-6 rounded-2xl">
	<div class="gap-10 grid grid-cols-1 lg:grid-cols-[3fr_2fr]">
		<div class="flex flex-col gap-5">
			<h2 class="flex font-semibold gap-3 items-center text-gray-200 text-xl">
				<Settings
					class="text-gray-400"
					size={20}
				/>
				Simulation Config
			</h2>

			<div class="flex flex-wrap gap-2">
				{#each Object.entries(BOT_PROFILES) as [id, profile] (id)}
					<button
						class="cursor-pointer disabled:opacity-50 px-3 py-1.5 rounded-lg text-xs transition-colors {isProfile(id as BotProfileId) ? 'bg-cyan-500/30 text-cyan-400' : 'bg-white/5 hover:bg-white/10 text-gray-400'}"
						disabled={isRunning}
						onclick={() => (form = profileForm(id as BotProfileId, form.targetHours, form.seed))}
						type="button"
					>
						{profile.name}
					</button>
				{/each}
			</div>

			<div class="gap-4 grid grid-cols-1 sm:grid-cols-2">
				<label class="flex flex-col gap-1.5 text-gray-500 text-sm">
					Activity
					<select
						bind:value={form.activityId}
						class={field}
						disabled={isRunning}
					>
						{#each Object.entries(ACTIVITY_PRESETS) as [id, preset] (id)}
							<option value={id}>{preset.name}</option>
						{/each}
					</select>
				</label>
				<label class="flex flex-col gap-1.5 text-gray-500 text-sm">
					Playstyle
					<select
						bind:value={form.playstyleId}
						class={field}
						disabled={isRunning}
						onchange={onPlaystyleChange}
					>
						{#each Object.entries(PLAYSTYLE_PRESETS) as [id, preset] (id)}
							<option value={id}>{preset.name}</option>
						{/each}
					</select>
				</label>
				<label class="flex flex-col gap-1.5 text-gray-500 text-sm">
					Prestige
					<select
						bind:value={form.prestigeId}
						class={field}
						disabled={isRunning}
					>
						{#each Object.entries(PRESTIGE_PRESETS) as [id, preset] (id)}
							<option value={id}>{preset.name}</option>
						{/each}
					</select>
				</label>
				<label class="flex flex-col gap-1.5 text-gray-500 text-sm">
					Daily quests
					<select
						bind:value={form.questBehavior}
						class={field}
						disabled={isRunning}
					>
						{#each QUEST_BEHAVIOR_OPTIONS as option (option.id)}
							<option value={option.id}>{option.label}</option>
						{/each}
					</select>
				</label>
			</div>

			<div class="gap-4 grid grid-cols-1 sm:grid-cols-3">
				<div class="flex flex-col gap-1.5">
					<label
						class="text-gray-500 text-sm"
						for="hours">Duration (hours)</label
					>
					<input
						bind:value={form.targetHours}
						class={field}
						disabled={isRunning}
						id="hours"
						min="1"
						type="number"
					/>
					<div class="flex gap-1.5">
						{#each DURATION_PRESETS as hours (hours)}
							<button
								class={chip(form.targetHours === hours)}
								disabled={isRunning}
								onclick={() => (form.targetHours = hours)}
								type="button">{hours === 168 ? '1 week' : `${hours}h`}</button
							>
						{/each}
					</div>
				</div>

				<div class="flex flex-col gap-1.5">
					<label
						class="text-gray-500 text-sm"
						for="snapshot-interval">Snapshot every (s)</label
					>
					<input
						bind:value={form.snapshotInterval}
						class={field}
						disabled={isRunning}
						id="snapshot-interval"
						max="3600"
						min="1"
						type="number"
					/>
					<div class="flex flex-wrap gap-1.5">
						{#each SNAPSHOT_PRESETS as preset (preset.value)}
							<button
								class={chip(form.snapshotInterval === preset.value)}
								disabled={isRunning}
								onclick={() => (form.snapshotInterval = preset.value)}
								type="button">{preset.label}</button
							>
						{/each}
					</div>
					<span class="text-xs {snapshotCount > SNAPSHOT_WARNING ? 'text-amber-400' : 'text-gray-600'}"
						>{formatNumber(snapshotCount)} chart points</span
					>
				</div>

				<div class="flex flex-col gap-1.5">
					<label
						class="flex gap-1 items-center text-gray-500 text-sm"
						for="seed"
					>
						Seed
						<Tooltip size="lg">
							<Info
								class="opacity-70 text-gray-500"
								size={14}
							/>
							{#snippet content()}
								<p class="max-w-xs text-sm">Drives power-up timing, power-up types and reactor rolls. Same config and seed give the exact same run, so keep it fixed to compare a balance change.</p>
							{/snippet}
						</Tooltip>
					</label>
					<div class="flex gap-2">
						<input
							bind:value={form.seed}
							class={field}
							disabled={isRunning}
							id="seed"
							type="number"
						/>
						<button
							aria-label="Random seed"
							class="bg-white/5 cursor-pointer disabled:opacity-50 hover:bg-white/10 px-2.5 rounded-lg text-gray-400"
							disabled={isRunning}
							onclick={() => (form.seed = Math.floor(Math.random() * 2 ** 32))}
							type="button"
						>
							<Dices size={16} />
						</button>
					</div>
				</div>
			</div>
		</div>

		<div class="flex flex-col gap-5">
			<h3 class="flex gap-2 items-center text-gray-400 text-sm uppercase">
				<Zap size={14} /> What the bot does
			</h3>
			<div class="gap-x-6 gap-y-4 grid grid-cols-2">
				{@render stat(
					'Strategy',
					config.botBehavior.buyStrategy,
					'text-green-400',
					'cheapest buys the cheapest affordable generator, balanced buys each new type once then the best rate, mostEfficient always buys the best production per atom.',
				)}
				{@render stat(
					'Knowledge',
					`${Math.round(config.botBehavior.gameKnowledge * 100)}%`,
					'text-cyan-400',
					'How the bot ranks generators: 0% looks at base rate per atom only, 100% at the real production gained per atom spent, in between blends the two.',
				)}
				{@render stat(
					'Clicks',
					`${config.botBehavior.clicksPerSecond}/s${config.botBehavior.activityPattern ? `, ${config.botBehavior.activityPattern.activeMinutes} min/h` : ''}`,
					'text-amber-500',
					'Manual clicks while active, split across the unlocked realms. Every automation (auto-click, auto-buy, auto-upgrade) runs all the time once unlocked.',
				)}
				{@render stat(
					'Actions / s',
					config.botBehavior.maxActionsPerTick == null ? 'unlimited' : `≤ ${Math.round((config.botBehavior.maxActionsPerTick * 1000) / config.tickRate)}`,
					'text-amber-400',
					'Max buy and prestige actions per second, so a human-like bot cannot spam dozens of purchases at once.',
				)}
				{@render stat(
					'Prestiges / session',
					`≤ ${config.botBehavior.maxPrestigesPerActiveWindow ?? '∞'}`,
					'text-cyan-400',
					'Max protonises plus electronizes per active window, or per simulated hour when always active.',
				)}
				{@render stat(
					'Prestige at',
					`${config.prestigeStrategy.protoniseThreshold}× / ${config.prestigeStrategy.electronizeThreshold}×`,
					'text-blue-400',
					'The bot protonises (then electronizes) once the gain is at least this many times the previous reset gain.',
				)}
				{@render stat('Tick', `${config.tickRate} ms`, 'font-mono text-gray-300', 'Simulated time per step. Lower is more accurate and slower.')}
			</div>
		</div>
	</div>

	<button
		class="bg-linear-to-r cursor-pointer flex font-semibold gap-3 hover:-translate-y-0.5 hover:shadow-lg items-center justify-center px-8 py-4 rounded-xl text-lg transition-all w-full {isRunning ? 'from-red-500 hover:shadow-red-500/30 text-white to-orange-500' : 'from-green-400 hover:shadow-green-400/30 text-gray-900 to-cyan-400'}"
		onclick={isRunning ? onStop : onRun}
	>
		{#if isRunning}
			<Pause size={20} />
			Stop Simulation
		{:else}
			<Play size={20} />
			Run Simulation
		{/if}
		<kbd class="font-mono font-normal opacity-60 text-xs">Ctrl+Enter</kbd>
	</button>
</section>
