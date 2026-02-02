<script lang="ts">
	import { ACHIEVEMENTS } from '$data/achievements';
	import { BUILDING_TYPES, BUILDINGS } from '$data/buildings';
	import { CurrenciesTypes, type CurrencyName } from '$data/currencies';
	import { FEATURES, type FeatureType } from '$data/features';
	import { ALL_PHOTON_UPGRADES } from '$data/photonUpgrades';
	import { RealmTypes, type RealmType } from '$data/realms';
	import { SKILL_UPGRADES } from '$data/skillTree';
	import { UPGRADES } from '$data/upgrades';
	import OfflineProgress from '@components/modals/OfflineProgress.svelte';
	import { currenciesManager } from '$helpers/CurrenciesManager.svelte';
	import { gameManager } from '$helpers/GameManager.svelte';
	import { applyOfflineProgress } from '$helpers/offlineProgress';
	import { SAVE_KEY } from '$helpers/saves';
	import { prestigeStore } from '$stores/prestige.svelte';
	import { ui } from '$stores/ui.svelte';
	import { error, info, success, warning } from '$stores/toasts';
	import {
		Atom,
		Clock,
		Coins,
		Download,
		Factory,
		MessageSquare,
		Save,
		Sparkles,
		ToggleLeft,
		Trash2,
		Unlock,
		Upload,
		Zap,
	} from 'lucide-svelte';

	// Get skills that unlock features
	const featureSkills = Object.values(SKILL_UPGRADES).filter(skill => skill.feature);

	function isFeatureEnabled(feature: FeatureType) {
		return gameManager.features[feature] === true;
	}

	function toggleFeature(skillId: string) {
		if (gameManager.skillUpgrades.includes(skillId)) {
			gameManager.skillUpgrades = gameManager.skillUpgrades.filter(u => u !== skillId);
		} else {
			gameManager.skillUpgrades = [...gameManager.skillUpgrades, skillId];
		}
		gameManager.syncFeatures();
	}

	function toggleRealm(id: RealmType) {
		gameManager.realms[id].unlocked = !gameManager.realms[id].unlocked;
	}
</script>

<div class="space-y-4">
	<!-- Feature Toggles -->
	<div class="rounded-xl border border-white/5 bg-white/5 p-3">
		<h3 class="mb-3 flex items-center gap-2 text-base font-bold text-accent-300">
			<ToggleLeft size={18} />
			<span>Feature Toggles</span>
		</h3>
		<div class="grid grid-cols-1 gap-2 md:grid-cols-2">
			{#each featureSkills as skill (skill.id)}
				<label
					class="flex cursor-pointer items-center justify-between rounded-lg border border-white/5 bg-black/20 p-2 transition-colors hover:bg-black/30"
				>
					<span class="text-sm text-white/80">{skill.name}</span>
					<input
						checked={skill.feature ? isFeatureEnabled(skill.feature as FeatureType) : false}
						class="h-4 w-4 cursor-pointer rounded border-white/10 bg-black/20 text-accent-500 focus:ring-accent-500/50"
						onchange={() => toggleFeature(skill.id)}
						type="checkbox"
					/>
				</label>
			{/each}
		</div>
	</div>

	<!-- Realm Management -->
	<div class="rounded-xl border border-white/5 bg-white/5 p-3">
		<h3 class="mb-3 flex items-center gap-2 text-base font-bold text-accent-300">
			<Sparkles size={18} />
			<span>Realm Management</span>
		</h3>
		<div class="grid grid-cols-1 gap-2 md:grid-cols-2">
			{#each Object.values(RealmTypes) as id (id)}
				<label
					class="flex cursor-pointer items-center justify-between rounded-lg border border-white/5 bg-black/20 p-2 transition-colors hover:bg-black/30"
				>
					<span class="text-sm capitalize text-white/80">{id} Realm</span>
					<input
						type="checkbox"
						checked={gameManager.realms[id].unlocked}
						onchange={() => toggleRealm(id)}
						class="h-4 w-4 cursor-pointer rounded border-white/10 bg-black/20 text-accent-500 focus:ring-accent-500/50"
					/>
				</label>
			{/each}
		</div>
	</div>

	<!-- Game State Actions -->
	<div class="rounded-xl border border-white/5 bg-white/5 p-3">
		<h3 class="mb-3 flex items-center gap-2 text-base font-bold text-accent-300">
			<Save size={18} />
			<span>Game State Management</span>
		</h3>
		<div class="grid grid-cols-2 gap-2">
			<button
				class="flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-red-600/80 px-4 py-2 text-sm font-semibold shadow-lg transition-all hover:bg-red-600"
				onclick={() => {
					if (confirm('Are you sure you want to hard reset? This will delete ALL progress!')) {
						localStorage.removeItem(SAVE_KEY);
						location.reload();
					}
				}}
			>
				<Trash2 size={16} />
				<span>Hard Reset</span>
			</button>
			<button
				class="flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-green-600/80 px-4 py-2 text-sm font-semibold shadow-lg transition-all hover:bg-green-600"
				onclick={() => {
					gameManager.save();
					alert('Game saved successfully!');
				}}
			>
				<Save size={16} />
				<span>Force Save</span>
			</button>
			<button
				class="flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-blue-600/80 px-4 py-2 text-sm font-semibold shadow-lg transition-all hover:bg-blue-600"
				onclick={() => {
					const summary = applyOfflineProgress(gameManager, 12 * 60 * 60 * 1000);
					if (summary) {
						gameManager.offlineProgressSummary = summary;
						ui.openModal(OfflineProgress);
					} else {
						info({ title: 'Offline progress', message: 'Offline progress is not available with current settings.' });
					}
				}}
			>
				<Clock size={16} />
				<span>Simulate 12h Offline</span>
			</button>
		</div>
	</div>

	<!-- Quick Unlock Actions -->
	<div class="rounded-xl border border-white/5 bg-white/5 p-3">
		<h3 class="mb-3 flex items-center gap-2 text-base font-bold text-accent-300">
			<Zap size={18} />
			<span>Quick Unlock & Boost</span>
		</h3>
		<div class="grid grid-cols-1 gap-2 md:grid-cols-2">
			<button
				class="flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-realm-600/80 px-4 py-2 text-sm font-semibold shadow-lg transition-all hover:bg-realm-600"
				onclick={() => {
					gameManager.upgrades = Object.keys(UPGRADES);
					gameManager.skillUpgrades = Object.keys(SKILL_UPGRADES);
					gameManager.achievements = Object.keys(ACHIEVEMENTS);
					gameManager.photonUpgrades = Object.fromEntries(Object.keys(ALL_PHOTON_UPGRADES).map(key => [key, 100]));
					gameManager.syncFeatures();
					alert('Everything unlocked!');
				}}
			>
				<Unlock size={16} />
				<span>Unlock Everything</span>
			</button>
			<button
				class="flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-accent-600/80 px-4 py-2 text-sm font-semibold shadow-lg transition-all hover:bg-accent-600"
				onclick={() => {
					Object.keys(CurrenciesTypes).forEach(currency => {
						currenciesManager.add(currency as CurrencyName, 1e300);
					});
					alert('Resources maxed!');
				}}
			>
				<Coins size={16} />
				<span>Max Resources</span>
			</button>
			<button
				class="flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-green-600/80 px-4 py-2 text-sm font-semibold shadow-lg transition-all hover:bg-green-600"
				onclick={() => {
					BUILDING_TYPES.forEach(id => {
						if (!gameManager.buildings[id]) {
							gameManager.buildings[id] = {
								count: 100,
								level: 10,
								unlocked: true,
								cost: { ...BUILDINGS[id].cost },
								rate: BUILDINGS[id].rate,
							};
						} else {
							const b = gameManager.buildings[id]!;
							b.count += 100;
							b.level += 10;
						}
					});
					gameManager.buildings = { ...gameManager.buildings };
					alert('Buildings maxed!');
				}}
			>
				<Factory size={16} />
				<span>Max Buildings</span>
			</button>
			<button
				class="flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-yellow-600/80 px-4 py-2 text-sm font-semibold shadow-lg transition-all hover:bg-yellow-600"
				onclick={() => {
					window.dispatchEvent(new CustomEvent('force-bonus'));
				}}
			>
				<Sparkles size={16} />
				<span>Force Bonus</span>
			</button>
		</div>
	</div>

	<!-- Import/Export -->
	<div class="rounded-xl border border-white/5 bg-white/5 p-3">
		<h3 class="mb-3 flex items-center gap-2 text-base font-bold text-accent-300">
			<Download size={18} />
			<span>Import / Export</span>
		</h3>
		<div class="grid grid-cols-2 gap-2">
			<button
				class="flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold transition-all hover:bg-white/20"
				onclick={() => {
					const data = localStorage.getItem(SAVE_KEY);
					if (data) {
						navigator.clipboard.writeText(data);
						alert('Save data copied to clipboard!');
					} else {
						alert('No save data found!');
					}
				}}
			>
				<Download size={16} />
				<span>Export Save</span>
			</button>
			<button
				class="flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold transition-all hover:bg-white/20"
				onclick={() => {
					const data = prompt('Paste your save data here:');
					if (data) {
						try {
							JSON.parse(data);
							localStorage.setItem(SAVE_KEY, data);
							location.reload();
						} catch (e) {
							alert('Invalid save data!');
						}
					}
				}}
			>
				<Upload size={16} />
				<span>Import Save</span>
			</button>
		</div>
	</div>

	<!-- UI Testing -->
	<div class="rounded-xl border border-white/5 bg-white/5 p-3">
		<h3 class="mb-3 flex items-center gap-2 text-base font-bold text-accent-300">
			<MessageSquare size={18} />
			<span>UI Testing & Toasts</span>
		</h3>
		<div class="grid grid-cols-2 gap-2 lg:grid-cols-4">
			<button
				class="flex cursor-pointer items-center justify-center rounded-lg border border-green-500/30 bg-green-600/20 p-2 text-xs font-semibold text-green-300 transition-all hover:bg-green-600/40"
				onclick={() => success({ title: 'Test Success', message: 'This is a success notification message.' })}
			>
				Success
			</button>
			<button
				class="flex cursor-pointer items-center justify-center rounded-lg border border-red-500/30 bg-red-600/20 p-2 text-xs font-semibold text-red-300 transition-all hover:bg-red-600/40"
				onclick={() => error({ title: 'Test Error', message: 'This is an error notification message.' })}
			>
				Error
			</button>
			<button
				class="flex cursor-pointer items-center justify-center rounded-lg border border-blue-500/30 bg-blue-600/20 p-2 text-xs font-semibold text-blue-300 transition-all hover:bg-blue-600/40"
				onclick={() => info({ title: 'Test Info', message: 'This is an information notification message.' })}
			>
				Info
			</button>
			<button
				class="flex cursor-pointer items-center justify-center rounded-lg border border-yellow-500/30 bg-yellow-600/20 p-2 text-xs font-semibold text-yellow-300 transition-all hover:bg-yellow-600/40"
				onclick={() => warning({ title: 'Test Infinite', message: 'This is an infinite warning.', duration: 0, is_infinite: true })}
			>
				Warn Inf
			</button>
			<button
				class="flex cursor-pointer items-center justify-center rounded-lg border border-yellow-500/30 bg-yellow-600/20 p-2 text-xs font-semibold text-yellow-300 transition-all hover:bg-yellow-600/40"
				onclick={() => warning({ title: 'Test Normal', message: 'This is a 5s warning.', duration: 5000 })}
			>
				Warn 5s
			</button>
		</div>
	</div>

	<!-- Prestige Testing -->
	<div class="rounded-xl border border-white/5 bg-white/5 p-3">
		<h3 class="mb-3 flex items-center gap-2 text-base font-bold text-accent-300">
			<Sparkles size={18} />
			<span>Prestige Animation Testing</span>
		</h3>
		<div class="grid grid-cols-2 gap-2">
			<button
				class="flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-yellow-600/80 px-4 py-2 text-sm font-semibold shadow-lg transition-all hover:bg-yellow-600"
				onclick={() => {
					prestigeStore.trigger('protonise');
				}}
			>
				<Atom size={16} />
				<span>Test Protonise</span>
			</button>
			<button
				class="flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-green-600/80 px-4 py-2 text-sm font-semibold shadow-lg transition-all hover:bg-green-600"
				onclick={() => {
					prestigeStore.trigger('electronize');
				}}
			>
				<Zap size={16} />
				<span>Test Electronize</span>
			</button>
		</div>
	</div>
</div>
