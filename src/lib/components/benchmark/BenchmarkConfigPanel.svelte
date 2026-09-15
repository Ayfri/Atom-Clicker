<script lang="ts">
	import Tooltip from '@components/ui/Tooltip.svelte';
	import { Code, Info, Pause, Play, RotateCcw, Settings, Zap } from '@lucide/svelte';
	import {
		ACTIVITY_PRESETS,
		BOT_PROFILES,
		PLAYSTYLE_PRESETS,
		PRESTIGE_PRESETS,
		buildBenchmarkConfig,
		type ActivityPresetId,
		type PlaystylePresetId,
		type PrestigePresetId,
	} from '$lib/simulation/presets';
	import type { BenchmarkConfig, QuestBehavior } from '$lib/simulation/types';

	const QUEST_BEHAVIOR_OPTIONS: { id: QuestBehavior; label: string }[] = [
		{ id: 'ignore', label: 'Ignore (never claims)' },
		{ id: 'passive', label: 'Passive (claims what completes)' },
		{ id: 'dedicated', label: 'Dedicated (steers toward targets)' },
	];

	let {
		activityId = $bindable(),
		playstyleId = $bindable(),
		prestigeId = $bindable(),
		questBehavior = $bindable(),
		snapshotInterval = $bindable(),
		targetHours = $bindable(),
		isRunning,
		runSimulation,
		stopSimulation,
	} = $props<{
		activityId: ActivityPresetId;
		playstyleId: PlaystylePresetId;
		prestigeId: PrestigePresetId;
		questBehavior: QuestBehavior;
		snapshotInterval: number;
		targetHours: number;
		isRunning: boolean;
		runSimulation: () => void;
		stopSimulation: () => void;
	}>();

	const SNAPSHOT_PRESETS = [
		{ label: '1s', value: 1 },
		{ label: '5s', value: 5 },
		{ label: '15s', value: 15 },
		{ label: '30s', value: 30 },
		{ label: '1m', value: 60 },
		{ label: '2m', value: 120 },
		{ label: '5m', value: 300 },
		{ label: '10m', value: 600 },
	] as const;

	const currentConfig = $derived<BenchmarkConfig>(
		buildBenchmarkConfig(activityId, playstyleId, prestigeId, targetHours, snapshotInterval, questBehavior),
	);

	function applyQuickProfile(profileKey: keyof typeof BOT_PROFILES) {
		const p = BOT_PROFILES[profileKey];
		activityId = p.activityId;
		playstyleId = p.playstyleId;
		prestigeId = p.prestigeId;
		questBehavior = PLAYSTYLE_PRESETS[p.playstyleId].questBehavior;
	}
</script>

<section class="simulation-config backdrop-blur-xl bg-white/5 border border-white/10 p-6 rounded-2xl">
	<div class="flex gap-3 items-center mb-6 text-gray-400">
		<Settings size={20} />
		<h2 class="font-semibold text-gray-200 text-xl">Simulation Config</h2>
	</div>

	<div class="gap-8 grid grid-cols-1 mb-8 md:grid-cols-2 lg:grid-cols-3">
		<!-- Core Config: min width so selects aren't squeezed -->
		<div class="flex min-w-65 flex-col gap-4">
			<h3 class="flex gap-2 items-center text-gray-400 text-sm uppercase">
				<Settings size={14} /> Config
			</h3>
			<p class="text-gray-500 text-sm">Mix activity, playstyle and prestige. Or pick a quick profile.</p>
			<div class="flex flex-col gap-4">
				<div class="flex flex-wrap gap-2">
					{#each Object.entries(BOT_PROFILES) as [key, preset] (key)}
						<button
							class="cursor-pointer px-3 py-1.5 rounded-lg text-xs transition-colors {activityId === preset.activityId &&
							playstyleId === preset.playstyleId &&
							prestigeId === preset.prestigeId
								? 'bg-cyan-500/30 text-cyan-400'
								: 'bg-white/5 hover:bg-white/10 text-gray-400'}"
							disabled={isRunning}
							onclick={() => applyQuickProfile(key as keyof typeof BOT_PROFILES)}
							type="button"
						>
							{key === 'afk'
								? 'AFK'
								: key === 'automated'
									? 'Automated'
									: key === 'balanced'
										? 'Balanced'
										: 'Tryhard'}
						</button>
					{/each}
				</div>
				<div class="flex min-w-0 flex-col gap-4">
					<div class="flex flex-col gap-1.5 min-w-50">
						<label class="text-gray-500 text-sm" for="activity">Activity</label>
						<select
							bind:value={activityId}
							class="simulation-config-select bg-slate-800 border border-white/10 disabled:cursor-not-allowed disabled:opacity-50 focus:border-green-400 focus:outline-none px-3 py-2 rounded-lg text-gray-200 text-sm w-full"
							disabled={isRunning}
							id="activity"
						>
							{#each Object.entries(ACTIVITY_PRESETS) as [id, a] (id)}
								<option value={id} class="text-gray-200 bg-slate-900">{a.name}</option>
							{/each}
						</select>
					</div>
					<div class="flex flex-col gap-1.5 min-w-50">
						<label class="text-gray-500 text-sm" for="playstyle">Playstyle</label>
						<select
							bind:value={playstyleId}
							class="simulation-config-select bg-slate-800 border border-white/10 disabled:cursor-not-allowed disabled:opacity-50 focus:border-green-400 focus:outline-none px-3 py-2 rounded-lg text-gray-200 text-sm w-full"
							disabled={isRunning}
							id="playstyle"
						>
							{#each Object.entries(PLAYSTYLE_PRESETS) as [id, p] (id)}
								<option value={id} class="text-gray-200 bg-slate-900">{p.name}</option>
							{/each}
						</select>
					</div>
					<div class="flex flex-col gap-1.5 min-w-50">
						<label class="text-gray-500 text-sm" for="prestige">Prestige</label>
						<select
							bind:value={prestigeId}
							class="simulation-config-select bg-slate-800 border border-white/10 disabled:cursor-not-allowed disabled:opacity-50 focus:border-green-400 focus:outline-none px-3 py-2 rounded-lg text-gray-200 text-sm w-full"
							disabled={isRunning}
							id="prestige"
						>
							{#each Object.entries(PRESTIGE_PRESETS) as [id, p] (id)}
								<option value={id} class="text-gray-200 bg-slate-900">{p.name}</option>
							{/each}
						</select>
					</div>
					<div class="flex flex-col gap-1.5 min-w-50">
						<label class="text-gray-500 text-sm" for="quest-behavior">Quest Behavior</label>
						<select
							bind:value={questBehavior}
							class="simulation-config-select bg-slate-800 border border-white/10 disabled:cursor-not-allowed disabled:opacity-50 focus:border-green-400 focus:outline-none px-3 py-2 rounded-lg text-gray-200 text-sm w-full"
							disabled={isRunning}
							id="quest-behavior"
						>
							{#each QUEST_BEHAVIOR_OPTIONS as option (option.id)}
								<option value={option.id} class="text-gray-200 bg-slate-900">{option.label}</option>
							{/each}
						</select>
					</div>
				</div>
				<div class="flex flex-col gap-1.5">
					<label class="text-gray-500 text-sm" for="hours">Target Duration</label>
					<div class="flex gap-2 items-center">
						<input
							bind:value={targetHours}
							class="bg-black/30 border border-white/10 disabled:cursor-not-allowed disabled:opacity-50 focus:border-green-400 focus:outline-none px-3 py-2 rounded-lg text-gray-200 text-sm w-full"
							disabled={isRunning}
							id="hours"
							min="1"
							type="number"
						/>
						<span class="text-gray-500 text-sm">hours</span>
					</div>
				</div>
			</div>
		</div>

		<!-- Bot Behavior -->
		<div class="flex flex-col gap-3">
			<h3 class="flex gap-2 items-center text-gray-400 text-sm uppercase">
				<Zap size={14} /> Bot Behavior
			</h3>
			<p class="text-gray-500 text-sm leading-relaxed">
				Buy priority, knowledge, limits. Human-like playstyles cap actions (e.g. 1-2 prestiges per active session).
			</p>
			<div class="gap-x-6 gap-y-4 grid grid-cols-2 lg:grid-cols-3">
				<div class="flex flex-col gap-1">
					<span class="flex gap-1 items-center text-gray-500 text-sm">
						Strategy
						<Tooltip size="lg">
							<Info size={14} class="text-gray-500 opacity-70" />
							{#snippet content()}
								<div class="prose prose-invert prose-sm max-w-xs">
									<h4 class="mb-2 text-sm font-semibold">Strategy</h4>
									<p class="mb-2">How the bot chooses which building or upgrade to buy next.</p>
									<ul class="list-inside list-disc space-y-1 text-xs">
										<li><strong>cheapest</strong> - buy the cheapest affordable</li>
										<li><strong>balanced</strong> - prefer new types, then best rate</li>
										<li><strong>mostEfficient</strong> - best production/cost ratio</li>
									</ul>
								</div>
							{/snippet}
						</Tooltip>
					</span>
					<span class="capitalize font-medium text-green-400 text-base">{currentConfig.botBehavior.buyStrategy}</span>
				</div>
				<div class="flex flex-col gap-1">
					<span class="flex gap-1 items-center text-gray-500 text-sm">
						Knowledge
						<Tooltip size="lg">
							<Info size={14} class="text-gray-500 opacity-70" />
							{#snippet content()}
								<div class="prose prose-invert prose-sm max-w-xs">
									<h4 class="mb-2 text-sm font-semibold">Knowledge</h4>
									<p class="mb-2">How well the bot ranks buildings.</p>
									<ul class="list-inside list-disc space-y-1 text-xs">
										<li>0% = base rate per atom only, ignores upgrades and levels</li>
										<li>100% = real production gained per atom spent</li>
										<li>In between, the two rankings are blended</li>
									</ul>
								</div>
							{/snippet}
						</Tooltip>
					</span>
					<span class="font-medium text-cyan-400 text-base">{Math.round(currentConfig.botBehavior.gameKnowledge * 100)}%</span>
				</div>
				<div class="flex flex-col gap-1">
					<span class="flex gap-1 items-center text-gray-500 text-sm">
						Clicks
						<Tooltip size="lg">
							<Info size={14} class="text-gray-500 opacity-70" />
							{#snippet content()}
								<div class="prose prose-invert prose-sm max-w-xs">
									<h4 class="mb-2 text-sm font-semibold">Clicks</h4>
									<p>Simulates manual clicks on the atom when the bot is active. Each click generates atoms based on <strong>click power</strong>. With AFK patterns, clicks only occur during active windows.</p>
								</div>
							{/snippet}
						</Tooltip>
					</span>
					<span class="font-medium text-amber-500 text-base">
						{currentConfig.botBehavior.clicksPerSecond}/s
						{#if currentConfig.botBehavior.activityPattern}
							<span class="text-gray-500 font-normal text-sm"
								>({currentConfig.botBehavior.activityPattern.activeMinutes} min/h)</span
							>
						{/if}
					</span>
				</div>
				<div class="flex flex-col gap-1">
					<span class="flex gap-1 items-center text-gray-500 text-sm">
						Decision Flow
						<Tooltip size="lg">
							<Info size={14} class="text-gray-500 opacity-70" />
							{#snippet content()}
								<div class="prose prose-invert prose-sm max-w-xs">
									<h4 class="mb-2 text-sm font-semibold">Decision Flow</h4>
									<p><strong>Reactive</strong> - bot auto-buys buildings, upgrades, skills, etc. every simulation tick. <strong>Manual</strong> - no auto-buy, only clicks and prestige.</p>
								</div>
							{/snippet}
						</Tooltip>
					</span>
					<span class="font-medium text-purple-400 text-base">{currentConfig.botBehavior.autoBuy ? 'Reactive' : 'Manual'}</span>
				</div>
				{#if currentConfig.botBehavior.maxActionsPerTick != null}
					{@const actionsPerSec = Math.round(
						(currentConfig.botBehavior.maxActionsPerTick! * 1000) / currentConfig.tickRate,
					)}
					<div class="flex flex-col gap-1">
						<span class="flex gap-1 items-center text-gray-500 text-sm">
							Actions/s
							<Tooltip size="lg">
								<Info size={14} class="text-gray-500 opacity-70" />
								{#snippet content()}
									<div class="prose prose-invert prose-sm max-w-xs">
										<h4 class="mb-2 text-sm font-semibold">Actions/s</h4>
										<p>Max number of <strong>buy + prestige</strong> actions per second. Human-like playstyles cap this to mimic a real player who can't spam dozens of prestiges in one second. Derived from actions per tick and tick rate.</p>
									</div>
								{/snippet}
							</Tooltip>
						</span>
						<span class="font-medium text-amber-400 text-base">≤{actionsPerSec}</span>
					</div>
					<div class="flex flex-col gap-1">
						<span class="flex gap-1 items-center text-gray-500 text-sm">
							Prestiges / session
							<Tooltip size="lg">
								<Info size={14} class="text-gray-500 opacity-70" />
								{#snippet content()}
									<div class="prose prose-invert prose-sm max-w-xs">
										<h4 class="mb-2 text-sm font-semibold">Prestiges per session</h4>
										<p class="mb-2">Max <strong>protonises + electronizes</strong> the bot can do in one active session.</p>
										<ul class="list-inside list-disc space-y-1 text-xs">
											<li><strong>With AFK</strong> - resets each active block (e.g. every 15 min)</li>
											<li><strong>Always active</strong> - applies to the full run</li>
										</ul>
										<p class="mt-2 text-xs opacity-90">A real player typically does 1-2 prestiges then checks the game, hence the cap.</p>
									</div>
								{/snippet}
							</Tooltip>
						</span>
						<span class="font-medium text-cyan-400 text-base"
							>≤{currentConfig.botBehavior.maxPrestigesPerActiveWindow ?? '-'}</span
						>
					</div>
				{:else}
					<div class="flex flex-col gap-1">
						<span class="flex gap-1 items-center text-gray-500 text-sm">
							Limits
							<Tooltip size="lg">
								<Info size={14} class="text-gray-500 opacity-70" />
								{#snippet content()}
									<div class="prose prose-invert prose-sm max-w-xs">
										<h4 class="mb-2 text-sm font-semibold">No limits</h4>
										<p>Automated playstyle has <strong>no caps</strong> on actions or prestiges. Use for pure optimization benchmarks - the bot runs at max speed with no human-like constraints.</p>
									</div>
								{/snippet}
							</Tooltip>
						</span>
						<span class="font-medium text-green-400 text-base">None</span>
					</div>
				{/if}
			</div>
		</div>

		<!-- Prestige & Engine (compact row) -->
		<div class="flex flex-col gap-4 md:flex-row md:gap-8">
			<div class="flex flex-col gap-3">
				<h3 class="flex gap-2 items-center text-gray-400 text-sm uppercase">
					<RotateCcw size={14} /> Prestige
				</h3>
				<p class="flex gap-1 items-center text-gray-500 text-sm leading-relaxed">
					Prestige when gain ≥ threshold. Higher = more efficient.
					<Tooltip size="lg">
						<Info size={14} class="text-gray-500 opacity-70" />
						{#snippet content()}
							<div class="prose prose-invert prose-sm max-w-xs">
								<h4 class="mb-2 text-sm font-semibold">Prestige threshold</h4>
								<p class="mb-2">The bot only prestiges when the <strong>gain</strong> (protons/electrons you'd earn) is <em>≥ threshold × current</em>.</p>
								<p class="text-xs opacity-90">Higher threshold = fewer prestiges, but each one is more impactful. 1x = early & often, 100x = late & efficient.</p>
							</div>
						{/snippet}
					</Tooltip>
				</p>
				<div class="flex gap-6">
					<div class="flex flex-col gap-1">
						<span class="flex gap-1 items-center text-gray-500 text-sm">Protonise</span>
						<span class="font-medium text-amber-400 text-base">
							{currentConfig.prestigeStrategy.autoProtonise ?
								`${currentConfig.prestigeStrategy.protoniseThreshold}x`
							:	'Manual'}
						</span>
					</div>
					<div class="flex flex-col gap-1">
						<span class="text-gray-500 text-sm">Electronize</span>
						<span class="font-medium text-blue-400 text-base">
							{currentConfig.prestigeStrategy.autoElectronize ?
								`${currentConfig.prestigeStrategy.electronizeThreshold}x`
							:	'Manual'}
						</span>
					</div>
				</div>
			</div>
			<div class="flex flex-col gap-4 min-w-45">
				<h3 class="flex gap-2 items-center text-gray-400 text-sm uppercase">
					<Code size={14} /> Engine
				</h3>
				<p class="flex gap-1 items-center text-gray-500 text-sm leading-relaxed">
					Simulation resolution.
					<Tooltip size="lg">
						<Info size={14} class="text-gray-500 opacity-70" />
						{#snippet content()}
							<div class="prose prose-invert prose-sm max-w-xs">
								<h4 class="mb-2 text-sm font-semibold">Simulation resolution</h4>
								<ul class="list-inside list-disc space-y-1 text-xs">
									<li><strong>Tick rate</strong> - how often the game state updates (ms). Lower = more accurate, slower</li>
									<li><strong>Snapshot interval</strong> - how often data is saved for charts</li>
									<li><strong>Resolution</strong> - chart data points per game-hour</li>
								</ul>
								<p class="mt-2 text-xs opacity-90">Higher resolution = smoother graphs but longer run time.</p>
							</div>
						{/snippet}
					</Tooltip>
				</p>
				<div class="flex flex-col gap-3">
					<div class="flex flex-col gap-1">
						<span class="text-gray-500 text-sm">Tick rate</span>
						<span class="font-mono text-gray-300 text-base">{currentConfig.tickRate}ms</span>
					</div>
					<div class="flex flex-col gap-2">
						<span class="text-gray-500 text-sm">Snapshot interval</span>
						<div class="flex flex-wrap gap-1.5">
							{#each SNAPSHOT_PRESETS as preset (preset.value)}
								<button
									class="cursor-pointer px-2.5 py-1 rounded-md text-xs font-mono transition-colors disabled:cursor-not-allowed disabled:opacity-50 {snapshotInterval === preset.value
										? 'bg-green-500/25 text-green-400 border border-green-500/40'
										: 'bg-white/5 hover:bg-white/10 text-gray-400 border border-transparent'}"
									disabled={isRunning}
									onclick={() => (snapshotInterval = preset.value)}
									type="button"
								>
									{preset.label}
								</button>
							{/each}
						</div>
						<div class="flex gap-2 items-center">
							<input
								bind:value={snapshotInterval}
								class="bg-black/30 border border-white/10 disabled:cursor-not-allowed disabled:opacity-50 focus:border-green-400 focus:outline-none px-2 py-1 rounded-md text-gray-200 text-sm font-mono w-20"
								disabled={isRunning}
								min="5"
								max="3600"
								type="number"
							/>
							<span class="text-gray-500 text-xs">s / {(3600 / snapshotInterval).toFixed(1)} pts/h</span>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>

	{#if isRunning}
		<button
			class="bg-linear-to-r cursor-pointer flex font-semibold from-red-500 gap-3 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-red-500/30 items-center justify-center orange-500 px-8 py-4 rounded-xl text-lg text-white to-orange-500 transition-all w-full"
			onclick={stopSimulation}
		>
			<Pause size={20} />
			Stop Simulation
		</button>
	{:else}
		<button
			class="bg-linear-to-r cursor-pointer cyan-400 flex font-semibold from-green-400 gap-3 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-green-400/30 items-center justify-center px-8 py-4 rounded-xl text-gray-900 text-lg to-cyan-400 transition-all w-full"
			onclick={runSimulation}
		>
			<Play size={20} />
			Run Simulation
		</button>
	{/if}
</section>
