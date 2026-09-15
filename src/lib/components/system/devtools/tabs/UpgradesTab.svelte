<script lang="ts">
	import { gameManager } from '$helpers/GameManager.svelte';
	import { UPGRADES } from '$data/upgrades';
	import { PHOTON_UPGRADES, EXCITED_PHOTON_UPGRADES } from '$data/photonUpgrades';
	import { BUILDING_TYPES, BUILDINGS } from '$data/buildings';
	import { RADIATION_UPGRADES } from '$data/radiationUpgrades';
	import { radiationManager } from '$helpers/RadiationManager.svelte';
	import {
		Target,
		MousePointer,
		Globe,
		Building2,
		Sparkles,
		Check,
		X as XIcon,
		type LucideIcon,
		Atom,
		Zap,
		Shield,
		Activity,
	} from '@lucide/svelte';
	import DevPhotonUpgrade from './DevPhotonUpgrade.svelte';
	import DevRadiationUpgrade from './DevRadiationUpgrade.svelte';
	import DevUpgrade from './DevUpgrade.svelte';

	let searchQuery = $state('');
	let upgradeFilter = $state<'all' | 'owned' | 'not-owned'>('all');

	const upgradeCategories = {
		special: (id: string) => id.startsWith('feature_'),
		click: (id: string) => id.startsWith('click_power'),
		global: (id: string) => id.startsWith('global_boost') || id.startsWith('level_boost_'),
		powerup: (id: string) => id.includes('power_up_interval'),
		proton: (id: string) => id.startsWith('proton'),
		electron: (id: string) => id.startsWith('electron'),
		stability: (id: string) => id.startsWith('stability'),
	};

	const sortedBuildings = [...BUILDING_TYPES].sort((a, b) => b.length - a.length);
	const buildingDataForUpgrades = sortedBuildings.map(bId => ({
		id: bId,
		lowId: bId.toLowerCase(),
		name: BUILDINGS[bId].name,
	}));

	function formatSubName(name: string) {
		const clean = name.replace(
			/^(click_power_|protonise_|proton_|electron_|stability_|global_boost_|level_boost_|auto_buy_speed_|auto_buy_)/g,
			'',
		);
		const label = clean.replace(/_/g, ' ').trim() || 'General';
		return label.charAt(0).toUpperCase() + label.slice(1);
	}

	const categorizedUpgradesList = $derived.by(() => {
		const categories: Record<
			string,
			{
				icon: LucideIcon;
				subcategories: Record<
					string,
					Array<{ id: string; name: string; description: string; isOwned: boolean; displayIndex: string }>
				>;
			}
		> = {};
		const query = searchQuery.toLowerCase();
		const ownedSet = new Set(gameManager.upgrades);

		Object.entries(UPGRADES).forEach(([id, upgrade]) => {
			const isOwned = ownedSet.has(id);
			const matchesFilter =
				upgradeFilter === 'all' || (upgradeFilter === 'owned' && isOwned) || (upgradeFilter === 'not-owned' && !isOwned);
			if (!matchesFilter) return;

			const matchesSearch = !query || [id, upgrade.name, upgrade.description].some(s => s.toLowerCase().includes(query));
			if (!matchesSearch) return;

			let cat = 'Global Boosts',
				icon = Globe,
				sub = id.replace(/_\d+$/, '');

			if (upgradeCategories.special(id)) {
				cat = 'Special Features';
				icon = Target;
				sub = 'General';
			} else if (upgradeCategories.click(id)) {
				cat = 'Click Power';
				icon = MousePointer;
			} else if (upgradeCategories.powerup(id)) {
				cat = 'Power-up Upgrades';
				icon = Sparkles;
			} else if (upgradeCategories.proton(id)) {
				cat = 'Proton Upgrades';
				icon = Atom;
			} else if (upgradeCategories.electron(id)) {
				cat = 'Electron Upgrades';
				icon = Zap;
			} else if (upgradeCategories.stability(id)) {
				cat = 'Stability Upgrades';
				icon = Shield;
			} else {
				const lowId = id.toLowerCase();
				for (const building of buildingDataForUpgrades) {
					if (lowId.startsWith(building.lowId + '_') || lowId.endsWith(building.lowId)) {
						cat = `${building.name} Upgrades`;
						icon = Building2;
						sub =
							id.includes('auto_buy_speed') ? 'auto_speed'
							: id.includes('auto_buy') ? 'auto_unlock'
							: 'production';
						break;
					}
				}
			}

			if (!categories[cat]) categories[cat] = { icon: icon as LucideIcon, subcategories: {} };
			if (!categories[cat].subcategories[sub]) categories[cat].subcategories[sub] = [];

			const idParts = id.split('_');
			const index = idParts[idParts.length - 1];
			const displayIndex = isNaN(Number(index)) ? '★' : index;

			categories[cat].subcategories[sub].push({
				id,
				name: upgrade.name,
				description: upgrade.description,
				isOwned,
				displayIndex,
			});
		});

		return Object.entries(categories)
			.map(([name, data]) => ({
				name,
				icon: data.icon,
				subcategories: Object.entries(data.subcategories)
					.map(([subId, items]) => ({
						id: subId,
						displayName: formatSubName(subId),
						items,
					}))
					.filter(sub => sub.items.length > 0),
			}))
			.filter(cat => cat.subcategories.length > 0)
			.sort((a, b) => a.name.localeCompare(b.name));
	});

	function toggleUpgrade(id: string) {
		if (gameManager.upgrades.includes(id)) {
			gameManager.upgrades = gameManager.upgrades.filter(u => u !== id);
		} else {
			gameManager.upgrades = [...gameManager.upgrades, id];
		}
	}

	function toggleAllUpgrades() {
		const allIds = Object.keys(UPGRADES);
		if (gameManager.upgrades.length === allIds.length) {
			gameManager.upgrades = [];
		} else {
			gameManager.upgrades = allIds;
		}
	}
</script>

<div class="space-y-4">
	<!-- Search and Filters -->
	<div class="bg-white/5 rounded-xl p-3 border border-white/5">
		<div class="flex flex-wrap gap-2 mb-2">
			<input
				type="text"
				class="flex-1 min-w-48 bg-black/20 rounded-lg px-3 py-1.5 text-sm border border-white/5 focus:border-accent-500/50 focus:outline-none transition-colors text-white placeholder:text-white/40"
				placeholder="Search upgrades..."
				bind:value={searchQuery}
			/>
			<select
				class="bg-black/20 rounded-lg px-3 py-1.5 text-sm border border-white/5 focus:border-accent-500/50 focus:outline-none transition-colors text-white cursor-pointer"
				bind:value={upgradeFilter}
			>
				<option value="all">All</option>
				<option value="owned">Owned</option>
				<option value="not-owned">Not Owned</option>
			</select>
			<button
				class="flex items-center gap-2 bg-realm-600/80 hover:bg-realm-600 px-3 py-1.5 rounded text-sm font-semibold transition-all cursor-pointer shadow-lg"
				onclick={toggleAllUpgrades}
			>
				{#if gameManager.upgrades.length === Object.keys(UPGRADES).length}
					<XIcon size={14} />
					<span>Clear</span>
				{:else}
					<Check size={14} />
					<span>All</span>
				{/if}
			</button>
		</div>
		<div class="text-xs text-white/40 flex items-center gap-3">
			<span>Total: {Object.keys(UPGRADES).length}</span>
			<span>Owned: {gameManager.upgrades.length}</span>
		</div>
	</div>

	<!-- Normal Upgrades by Category -->
	<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
		{#each categorizedUpgradesList as category (category.name)}
			{@const Icon = category.icon}
			<div class="bg-white/5 rounded-lg p-3 border border-white/5 flex flex-col gap-4">
				<h3 class="text-sm font-bold flex items-center gap-2 text-accent-300 border-b border-white/10 pb-2">
					<Icon size={16} />
					<span class="truncate">{category.name}</span>
				</h3>

				<div class="space-y-4">
					{#each category.subcategories as sub (sub.id)}
						<div class="space-y-1.5">
							{#if sub.id !== 'General' && sub.id !== 'production'}
								<h4 class="text-[10px] uppercase tracking-widest text-white/40 font-bold">{sub.displayName}</h4>
							{/if}

							<div class={category.name === 'Special Features' ? 'flex flex-col gap-1' : 'flex flex-wrap gap-1.5'}>
								{#each sub.items as item (item.id)}
									<DevUpgrade
										id={item.id}
										isOwned={item.isOwned}
										isSpecial={category.name === 'Special Features'}
										upgrade={UPGRADES[item.id]}
									/>
								{/each}
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/each}
	</div>

	<!-- Photon Upgrades -->
	<div class="bg-realm-900/10 rounded-lg p-4 border border-realm-600/20">
		<h3 class="text-base font-bold mb-4 flex items-center gap-2 text-realm-300 border-b border-realm-600/20 pb-2">
			<Sparkles size={18} />
			Photon Upgrades
		</h3>
		<div class="space-y-6">
			<!-- Normal Photon Upgrades -->
			<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
				{#each Object.entries(PHOTON_UPGRADES) as [id, upgrade]}
					<DevPhotonUpgrade
						{id}
						{upgrade}
					/>
				{/each}
			</div>

			<!-- Excited Photon Upgrades -->
			<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
				{#each Object.entries(EXCITED_PHOTON_UPGRADES) as [id, upgrade]}
					<DevPhotonUpgrade
						{id}
						{upgrade}
						isExcited
					/>
				{/each}
			</div>
		</div>
	</div>

	<!-- Radiation Upgrades -->
	<div class="bg-green-950/20 rounded-lg p-4 border border-green-500/20">
		<h3 class="text-base font-bold mb-4 flex items-center gap-2 text-green-300 border-b border-green-500/20 pb-2">
			<Activity size={18} />
			Radiation Upgrades
		</h3>
		<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
			{#each Object.entries(RADIATION_UPGRADES) as [id, upgrade]}
				<DevRadiationUpgrade
					{id}
					{upgrade}
					level={radiationManager.upgradeLevels[id] || 0}
				/>
			{/each}
		</div>
	</div>
</div>
