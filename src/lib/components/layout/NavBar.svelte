<script lang="ts">
	import Changelog from '@components/modals/Changelog.svelte';
	import CloudSave from '@components/modals/CloudSave.svelte';
	import Credits from '@components/modals/Credits.svelte';
	import FeedbackForm from '@components/modals/FeedbackForm.svelte';
	import GlobalStats from '@components/modals/GlobalStats.svelte';
	import Leaderboard from '@components/modals/Leaderboard.svelte';
	import SkillTree from '@components/modals/SkillTree.svelte';
	import Electronize from '@components/prestige/Electronize.svelte';
	import Protonise from '@components/prestige/Protonise.svelte';
	import NotificationDot from '@components/ui/NotificationDot.svelte';
	import { PROTONS_ATOMS_REQUIRED, ELECTRONS_PROTONS_REQUIRED } from '$lib/constants';
	import { changelog } from '$stores/changelog';
	import { gameManager } from '$helpers/GameManager.svelte';
	import { remoteMessage } from '$stores/remoteMessage.svelte';
	import { mobile } from '$stores/window.svelte';
	import { ChartNoAxesColumn, Network, Info, Atom, Trophy, MessageSquare, Orbit, FileText, Cloud, type Icon as IconType } from 'lucide-svelte';
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
			icon: ChartNoAxesColumn,
			label: 'Stats',
			component: GlobalStats,
		},
		{
			icon: Trophy,
			label: 'Leaderboard',
			component: Leaderboard,
		},
		{
			icon: Network,
			label: 'Skill Tree',
			component: SkillTree,
			condition: () => gameManager.skillPointsTotal > 0,
			notification: () => gameManager.hasAvailableSkillUpgrades,
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
			icon: FileText,
			label: 'Changelog',
			component: Changelog,
			notification: () => $changelog.hasUnread,
		},
		{
			icon: Cloud,
			label: 'Cloud Save',
			component: CloudSave,
		},
		{
			icon: Info,
			label: 'Credits',
			component: Credits,
		},
		{
			icon: MessageSquare,
			label: 'Feedback',
			component: FeedbackForm
		},
	];

	let activeComponent: NavBarComponent | null = $state(null);
	let visibleComponents: Link[] = $state([]);

	let interval: ReturnType<typeof setInterval> | null = null;

	onMount(() => {
		visibleComponents = links.filter(link => !link.condition || link.condition());
		interval = setInterval(() => {
			visibleComponents = links.filter(link => !link.condition || link.condition());
		}, 100);
	});

	onDestroy(() => {
		if (interval) clearInterval(interval);
	});
</script>

{#if mobile.current}
	<div
		class="absolute top-[33vh] -translate-y-1/2 z-10 grid gap-3.5 w-full justify-between pointer-events-none"
		class:grid-cols-2={visibleComponents.length > 5}
		class:px-2={visibleComponents.length > 5}
		class:left-4={visibleComponents.length < 5}
		style:grid-template-columns={visibleComponents.length > 5 ? 'auto auto' : 'auto'}
	>
		{#each visibleComponents as link}
			<NotificationDot hasNotification={link.notification ? link.notification() : false}>
				<button
					class="flex items-center justify-center rounded-lg bg-accent/90 p-2 text-white transition-all hover:bg-accent pointer-events-auto"
					onclick={() => activeComponent = link.component}
				>
					<link.icon size={30} />
				</button>
			</NotificationDot>
		{/each}
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
					onclick={() => activeComponent = link.component}
				>
					<link.icon size={32} />
					<span
						class="label invisible absolute left-[calc(100%+1.25rem)] whitespace-nowrap rounded-lg bg-accent/90 px-3 py-2 text-sm opacity-0 transition-all group-hover:visible group-hover:opacity-100 bg-accent-900"
					>
						{link.label}
					</span>
				</button>
			</NotificationDot>
		{/each}
	</nav>
{/if}

{#if activeComponent}
	{@const SvelteComponent = activeComponent}
	<SvelteComponent onClose={() => (activeComponent = null)} />
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
