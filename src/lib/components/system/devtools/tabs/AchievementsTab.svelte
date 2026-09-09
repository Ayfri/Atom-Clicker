<script lang="ts">
	import { gameManager } from '$helpers/GameManager.svelte';
	import { ACHIEVEMENTS } from '$data/achievements';
	import { BUILDING_TYPES, BUILDINGS } from '$data/buildings';
	import { Atom as AtomIcon, Factory, Clock, Sparkles, Gift, Trophy, Check, X as XIcon, X, type LucideIcon } from '@lucide/svelte';
	import Tooltip from '@components/ui/Tooltip.svelte';
	import { formatNumber } from '$lib/utils';
	import type { Achievement } from '$lib/types';

	let searchQuery = $state('');
	let achievementFilter = $state<'all' | 'unlocked' | 'locked'>('all');

	const categorizedAchievements = $derived.by(() => {
		const categories: Record<string, { icon: LucideIcon; subcategories: Record<string, Array<[string, Achievement]>> }> = {
			'Atom Milestones': { icon: AtomIcon, subcategories: {} },
			'Building Goals': { icon: Factory, subcategories: {} },
			'Time & Progress': { icon: Clock, subcategories: {} },
			'Prestige': { icon: Sparkles, subcategories: {} },
			'Special & Hidden': { icon: Gift, subcategories: { 'General': [] } }
		};

		const unlockedSet = new Set(gameManager.achievements);
		const query = searchQuery.toLowerCase();

		Object.entries(ACHIEVEMENTS).forEach(([id, achievement]) => {
			const isUnlocked = unlockedSet.has(id);

			const matchesFilter = achievementFilter === 'all' ||
				(achievementFilter === 'unlocked' && isUnlocked) ||
				(achievementFilter === 'locked' && !isUnlocked);
			if (!matchesFilter) return;

			const matchesSearch = !query ||
				id.toLowerCase().includes(query) ||
				achievement.name.toLowerCase().includes(query) ||
				achievement.description.toLowerCase().includes(query);
			if (!matchesSearch) return;

			let category = 'Special & Hidden';
			let subcategory = 'General';

			if (id.startsWith('atoms_')) {
				category = 'Atom Milestones';
				subcategory = 'Atoms';
			} else if (id.startsWith('aps_')) {
				category = 'Atom Milestones';
				subcategory = 'Atoms per Second';
			} else if (id.startsWith('clicks_')) {
				category = 'Time & Progress';
				subcategory = 'Clicks';
			} else if (id.startsWith('levels_')) {
				category = 'Time & Progress';
				subcategory = 'Player Level';
			} else if (id.includes('time') || id.includes('play')) {
				category = 'Time & Progress';
				subcategory = 'Time';
			} else if (id.startsWith('total_')) {
				category = 'Building Goals';
				subcategory = 'Total Count';
			} else if (id.startsWith('buildings_levels_')) {
				category = 'Building Goals';
				subcategory = 'Total Levels';
			} else if (id.startsWith('protonises_')) {
				category = 'Prestige';
				subcategory = 'Protonises';
			} else if (id.startsWith('electronizes_')) {
				category = 'Prestige';
				subcategory = 'Electronizes';
			} else if (id.startsWith('photons_')) {
				category = 'Prestige';
				subcategory = 'Photons';
			} else if (id.startsWith('excited_photons_')) {
				category = 'Prestige';
				subcategory = 'Excited Photons';
			} else if (id.startsWith('bonus_higgs_boson_clicked_')) {
				category = 'Prestige';
				subcategory = 'Higgs Boson';
			} else if (id === 'photon_collector') {
				category = 'Prestige';
				subcategory = 'Upgrades';
			} else {
				// Try building subcategory
				// Sort by length descending to match "neutronstar" before "star"
				const buildingId = [...BUILDING_TYPES]
					.sort((a, b) => b.length - a.length)
					.find(b => id.toLowerCase().includes(b.toLowerCase()));
				if (buildingId) {
					category = 'Building Goals';
					subcategory = BUILDINGS[buildingId].name;
				}
			}

			if (!categories[category].subcategories[subcategory]) {
				categories[category].subcategories[subcategory] = [];
			}
			categories[category].subcategories[subcategory].push([id, achievement]);
		});

		return categories;
	});

	function toggleAchievement(id: string) {
		if (gameManager.achievements.includes(id)) {
			gameManager.achievements = gameManager.achievements.filter(a => a !== id);
		} else {
			gameManager.achievements = [...gameManager.achievements, id];
		}
	}

	function toggleAllAchievements() {
		const allIds = Object.keys(ACHIEVEMENTS);
		if (gameManager.achievements.length === allIds.length) {
			gameManager.achievements = [];
		} else {
			gameManager.achievements = allIds;
		}
	}

	function getDisplayValue(id: string) {
		// Special cases first
		if (id === 'first_atom') return '1';
		if (id === 'photon_collector') return '50';
		if (id.includes('play_time')) {
			const match = id.match(/(\d+)(min|h)/);
			if (match) return match[1] + match[2];
		}
		if (id.includes('time_since_start')) {
			const match = id.match(/(\d+)d/);
			if (match) return match[1] + 'D';
		}

		const parts = id.split('_');
		// Try to find a part that is a number or a formatted number
		// Improved regex to handle decimals and suffixes (like 1.00k)
		const milestoneValue = parts.find(p => {
			if (['aps', 'total', 'buildings', 'levels', 'clicks', 'protonises', 'electronizes', 'photons', 'bonus'].includes(p)) return false;
			return !isNaN(Number(p)) || /^[\d.]+[a-z]+$/i.test(p);
		});

		if (milestoneValue) {
			const num = Number(milestoneValue);
			if (!isNaN(num)) {
				return formatNumber(num, 0).toUpperCase();
			}
			// For values like "1.00k", remove the .00 and uppercase
			return milestoneValue.replace(/\.00/g, '').toUpperCase();
		}

		return '★';
	}
</script>

{#snippet achievementItem(id: string, achievement: Achievement)}
	{@const isUnlocked = gameManager.achievements.includes(id)}
	{@const displayValue = getDisplayValue(id)}

	<Tooltip size="sm">
		{#snippet children()}
			<button
				class="size-7 rounded-lg flex items-center justify-center text-[10px] font-black transition-all cursor-pointer border-2
				{isUnlocked
					? 'bg-yellow-500/20 text-yellow-400 border-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.3)]'
					: 'bg-white/5 text-white/20 border-white/10 hover:border-white/30 hover:bg-white/10'}"
				onclick={() => toggleAchievement(id)}
				aria-label={achievement.name}
			>
				{displayValue}
			</button>
		{/snippet}
		{#snippet content()}
			<div class="space-y-1">
				<div class="flex items-center justify-between gap-4">
					<span class="font-bold text-accent-300">{achievement.name}</span>
					<span class="text-[10px] font-mono text-white/40">{id}</span>
				</div>
				<p class="text-xs text-white/70 leading-relaxed">{achievement.description}</p>
				<div class="pt-1 flex items-center gap-1.5">
					<div class="size-1.5 rounded-full {isUnlocked ? 'bg-yellow-500' : 'bg-red-500'}"></div>
					<span class="text-[10px] uppercase tracking-wider font-bold {isUnlocked ? 'text-yellow-400' : 'text-red-400'}">
						{isUnlocked ? 'Unlocked' : 'Locked'}
					</span>
				</div>
			</div>
		{/snippet}
	</Tooltip>
{/snippet}

<div class="space-y-4">
	<!-- Search and Filters -->
	<div class="bg-white/5 rounded-xl p-3 border border-white/5">
		<div class="flex flex-wrap gap-2 mb-2">
			<input
				type="text"
				class="flex-1 min-w-48 bg-black/20 rounded-lg px-3 py-1.5 text-sm border border-white/5 focus:border-accent-500/50 focus:outline-none transition-colors text-white placeholder:text-white/40"
				placeholder="Search achievements..."
				bind:value={searchQuery}
			/>
			<select
				class="bg-black/20 rounded-lg px-3 py-1.5 text-sm cursor-pointer border border-white/5 focus:border-accent-500/50 focus:outline-none transition-colors text-white"
				bind:value={achievementFilter}
			>
				<option value="all">All</option>
				<option value="unlocked">Unlocked</option>
				<option value="locked">Locked</option>
			</select>
			<button
				class="flex items-center gap-2 bg-yellow-600/80 hover:bg-yellow-600 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all cursor-pointer shadow-lg"
				onclick={toggleAllAchievements}
			>
				{#if gameManager.achievements.length === Object.keys(ACHIEVEMENTS).length}
					<XIcon size={14} />
					<span>Clear</span>
				{:else}
					<Trophy size={14} />
					<span>All</span>
				{/if}
			</button>
		</div>
		<div class="text-xs text-white/40 flex items-center gap-3">
			<span>Total: {Object.keys(ACHIEVEMENTS).length}</span>
			<span>Unlocked: {gameManager.achievements.length}</span>
		</div>
	</div>

	<!-- Achievements by Category -->
	<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
		{#each Object.entries(categorizedAchievements) as [category, { icon, subcategories }]}
			{#if Object.values(subcategories).some(items => items.length > 0)}
				{@const Icon = icon}
				<div class="bg-white/5 rounded-lg p-3 border border-white/5 flex flex-col gap-4">
					<h3 class="text-sm font-bold flex items-center gap-2 text-accent-300 border-b border-white/10 pb-2">
						<Icon size={16} />
						<span class="truncate">{category}</span>
					</h3>

					<div class="space-y-4">
						{#each Object.entries(subcategories) as [subName, items]}
							{#if items.length > 0}
								<div class="space-y-1.5">
									{#if subName !== 'General'}
										<h4 class="text-[10px] uppercase tracking-widest text-white/40 font-bold">{subName}</h4>
									{/if}

									{#if category === 'Special & Hidden'}
										<div class="flex flex-col gap-1">
											{#each items as [id, achievement] (id)}
												{@const isUnlocked = gameManager.achievements.includes(id)}
												<Tooltip size="sm">
													{#snippet children()}
														<button
															class="w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition-all cursor-pointer border
															{isUnlocked
																? 'bg-yellow-500/10 text-yellow-300 border-yellow-500/40 hover:bg-yellow-500/20'
																: 'bg-white/5 text-white/50 border-white/10 hover:border-white/20 hover:bg-white/10'}"
															onclick={() => toggleAchievement(id)}
														>
															<span>{achievement.name}</span>
															<div class="size-1.5 rounded-full {isUnlocked ? 'bg-yellow-500 shadow-[0_0_5px_rgba(234,179,8,0.8)]' : 'bg-white/20'}"></div>
														</button>
													{/snippet}
													{#snippet content()}
														<div class="space-y-1">
															<div class="flex items-center justify-between gap-4">
																<span class="font-bold text-accent-300">{achievement.name}</span>
																<span class="text-[10px] font-mono text-white/40">{id}</span>
															</div>
															<p class="text-xs text-white/70 leading-relaxed">{achievement.description}</p>
															<div class="pt-1 flex items-center gap-1.5">
																<div class="size-1.5 rounded-full {isUnlocked ? 'bg-yellow-500' : 'bg-red-500'}"></div>
																<span class="text-[10px] uppercase tracking-wider font-bold {isUnlocked ? 'text-yellow-400' : 'text-red-400'}">
																	{isUnlocked ? 'Unlocked' : 'Locked'}
																</span>
															</div>
														</div>
													{/snippet}
												</Tooltip>
											{/each}
										</div>
									{:else}
										<div class="flex flex-wrap gap-1.5">
											{#each items as [id, achievement] (id)}
												{@render achievementItem(id, achievement)}
											{/each}
										</div>
									{/if}
								</div>
							{/if}
						{/each}
					</div>
				</div>
			{/if}
		{/each}
	</div>
</div>
