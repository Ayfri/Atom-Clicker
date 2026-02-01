<script lang="ts">
	import CurrencyBoosts from '@components/modals/CurrencyBoosts.svelte';
	import Leaderboard from '@components/modals/Leaderboard.svelte';
	import Settings from '@components/modals/Settings.svelte';
	import SkillTree from '@components/modals/SkillTree.svelte';
	import Electronize from '@components/prestige/Electronize.svelte';
	import Protonise from '@components/prestige/Protonise.svelte';
	import NotificationDot from '@components/ui/NotificationDot.svelte';
	import { ELECTRONS_PROTONS_REQUIRED, PROTONS_ATOMS_REQUIRED } from '$lib/constants';
	import { changelog } from '$stores/changelog';
	import { gameManager } from '$helpers/GameManager.svelte';
	import { remoteMessage } from '$stores/remoteMessage.svelte';
	import { ui } from '$stores/ui.svelte';
	import { mobile } from '$stores/window.svelte';
	import { Atom, Network, Orbit, Settings as SettingsIcon, Trophy, Zap, type Icon as IconType } from 'lucide-svelte';
	import { onDestroy, onMount, type Component } from 'svelte';


	type NavBarComponent = Component<{ onClose: () => void }>;

	interface Link {
		component: NavBarComponent;
		condition?: () => boolean;
		icon: typeof IconType;
		label: string;
		notification?: () => boolean;
	}

	const links: Link[] = [
		{
			icon: Trophy,
			label: 'Leaderboard',
			component: Leaderboard,
		},
		{
			icon: Network,
			label: 'Skill Tree',
			component: SkillTree,
			condition: () => gameManager.atoms >= 5000 || gameManager.skillPointsTotal > 0,
			notification: () => gameManager.hasAvailableSkillUpgrades,
		},
		{
			icon: Zap,
			label: 'Boosts',
			component: CurrencyBoosts,
			condition: () => gameManager.totalProtonisesAllTime > 0,
			notification: () => gameManager.skillPointsAvailable > 0,
		},
		{
			icon: Atom,
			label: 'Protonise',
			component: Protonise,
			condition: () => gameManager.atoms >= PROTONS_ATOMS_REQUIRED || gameManager.protons > 0,
			notification: () => gameManager.protoniseProtonsGain > gameManager.protons,
		},
		{
			icon: Orbit,
			label: 'Electronize',
			component: Electronize,
			condition: () => gameManager.protons >= ELECTRONS_PROTONS_REQUIRED || gameManager.electrons > 0,
			notification: () => gameManager.electronizeElectronsGain > 0,
		},
		{
			icon: SettingsIcon,
			label: 'Parameters',
			component: Settings,
			notification: () => $changelog.hasUnread,
		},
	];

	/* Filter out Settings from main links - we want it always at the bottom */
	const mainLinks = links.filter(l => l.component !== Settings);
	const settingsLink = links.find(l => l.component === Settings)!;

	let visibleComponents: Link[] = $state([]);

	let interval: ReturnType<typeof setInterval> | null = null;

	onMount(() => {
		ui.registerSettings(Settings);
		const updateVisible = () => {
			visibleComponents = mainLinks.filter(link => !link.condition || link.condition());
		};
		updateVisible();
		interval = setInterval(updateVisible, 100);
	});

	onDestroy(() => {
		if (interval) clearInterval(interval);
	});
</script>

{#if mobile.current}
	<div
		class="absolute top-[33vh] -translate-y-1/2 z-10 grid gap-3.5 pointer-events-none"
		class:grid-cols-2={visibleComponents.length + 1 >= 5}
		class:inset-x-0={visibleComponents.length + 1 >= 5}
		class:justify-between={visibleComponents.length + 1 >= 5}
		class:left-4={visibleComponents.length + 1 < 5}
		class:px-4={visibleComponents.length + 1 >= 5}
		class:w-full={visibleComponents.length + 1 >= 5}
		style:grid-template-columns={visibleComponents.length + 1 >= 5 ? 'auto auto' : 'auto'}
	>
		{#each visibleComponents as link}
			<NotificationDot hasNotification={link.notification ? link.notification() : false}>
				<button
					class="flex items-center justify-center rounded-lg bg-accent/90 p-2 text-white transition-all hover:bg-accent pointer-events-auto"
					onclick={() => ui.openModal(link.component)}
				>
					<link.icon size={30} />
				</button>
			</NotificationDot>
		{/each}

		<!-- Mobile Settings (add to grid or place separately? User said bottom of navbar, which implies desktop mostly, but let's add it here too if space permits or just keep it in flow) -->
		<!-- For mobile, just append it to the list effectively -->
		<NotificationDot hasNotification={settingsLink.notification ? settingsLink.notification() : false}>
			<button
				class="flex items-center justify-center rounded-lg bg-accent/90 p-2 text-white transition-all hover:bg-accent pointer-events-auto"
				onclick={() => ui.openModal(settingsLink.component)}
			>
				<settingsLink.icon size={30} />
			</button>
		</NotificationDot>
	</div>
{:else}
	<nav
		class="fixed left-0 z-50 flex h-full flex-col items-center gap-5 bg-black/20 px-3 py-6 backdrop-blur-xs transition-all duration-300"
		style="top: {remoteMessage.message && remoteMessage.isVisible ? '1.5rem' : '0'}"
	>
		{#each visibleComponents as link}
			<NotificationDot hasNotification={link.notification ? link.notification() : false}>
				<button
					class="group relative flex h-12 w-12 items-center justify-center rounded-lg bg-accent/90 text-white transition-all hover:bg-accent"
					onclick={() => ui.openModal(link.component)}
				>
					<link.icon size={32} />
					<span
						class="label invisible absolute left-[calc(100%+1.25rem)] whitespace-nowrap rounded-lg bg-accent/90 px-3 py-2 text-sm opacity-0 transition-all group-hover:visible group-hover:opacity-100 bg-accent-900 border border-white/10 shadow-xl z-50"
					>
						{link.label}
					</span>
				</button>
			</NotificationDot>
		{/each}

		<div class="flex-1"></div>

		<NotificationDot hasNotification={settingsLink.notification ? settingsLink.notification() : false}>
			<button
				class="group relative flex h-12 w-12 items-center justify-center rounded-lg bg-accent/90 text-white transition-all hover:bg-accent"
				onclick={() => ui.openModal(settingsLink.component)}
			>
				<div class="transition-transform duration-500 group-hover:rotate-90">
					<settingsLink.icon size={32} />
				</div>
				<span
					class="label invisible absolute left-[calc(100%+1.25rem)] whitespace-nowrap rounded-lg bg-accent/90 px-3 py-2 text-sm opacity-0 transition-all group-hover:visible group-hover:opacity-100 bg-accent-900 border border-white/10 shadow-xl z-50"
				>
					{settingsLink.label}
				</span>
			</button>
		</NotificationDot>
	</nav>
{/if}

{#if ui.activeModal}
	{@const SvelteComponent = ui.activeModal}
	<SvelteComponent onClose={() => ui.closeModal()} />
{/if}

<style>
	/* Label anchor, small triangle */
	.label::after {
		content: '';
		position: absolute;
		left: -0.85rem;
		top: 50%;
		transform: translateY(-50%);
		border-width: 0.5rem;
		border-style: solid;
		border-color: transparent var(--color-accent-900) transparent transparent;
	}
</style>
