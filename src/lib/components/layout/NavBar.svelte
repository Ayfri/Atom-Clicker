<script lang="ts">
	import { CURRENCIES, CurrenciesTypes } from '$data/currencies';
	import { FeatureTypes } from '$data/features';
	import { SKILL_UPGRADES } from '$data/skillTree';
	import { colliderManager } from '$helpers/ColliderManager.svelte';
	import { currenciesManager } from '$helpers/CurrenciesManager.svelte';
	import { gameManager } from '$helpers/GameManager.svelte';
	import { quarksManager } from '$helpers/QuarksManager.svelte';
	import { radiationManager } from '$helpers/RadiationManager.svelte';
	import { reveal, reveals } from '$helpers/reveals.svelte';
	import { ELECTRONS_PROTONS_REQUIRED, PROTONS_ATOMS_REQUIRED } from '$lib/constants';
	import { supabaseAuth } from '$stores/supabaseAuth.svelte';
	import { ui } from '$stores/ui.svelte';
	import { mobile } from '$stores/window.svelte';
	import ElectronizeIcon from '@components/icons/Electronize.svelte';
	import IonizeIcon from '@components/icons/Ionize.svelte';
	import ProtoniseIcon from '@components/icons/Protonise.svelte';
	import QuarkIcon from '@components/icons/Quark.svelte';
	import NotificationDot from '@components/ui/NotificationDot.svelte';
	import { Medal, Network, Orbit, Settings as SettingsIcon, Zap } from '@lucide/svelte';
	import { onMount, type Component } from 'svelte';

	type NavBarIcon = Component<{ class?: string; size?: number; style?: string }>;
	type ModalLoader = () => Promise<{ default: Component<{ onClose: () => void }> }>;

	interface Link {
		condition?: () => boolean;
		/** Prestige actions are tinted and glow in this color when ready, and sit in their own group after the menus. */
		glow?: string;
		icon: NavBarIcon;
		iconProps?: Record<string, unknown>;
		id: string;
		label: string;
		/** Modals are code-split: none of their chunks (xyflow, virtua, marked) sit in the initial bundle. */
		load: ModalLoader;
		notification?: () => boolean;
	}

	const settingsLoader: ModalLoader = () => import('@components/modals/Settings.svelte');

	const SKILL_TREE_ROOTS = Object.values(SKILL_UPGRADES).filter(skill => !skill.requires || skill.requires.length === 0);
	const PROTON_COLOR = CURRENCIES[CurrenciesTypes.PROTONS].color;
	const ELECTRON_COLOR = CURRENCIES[CurrenciesTypes.ELECTRONS].color;
	const WHITE_LIGHT_COLOR = CURRENCIES[CurrenciesTypes.WHITE_LIGHT].color;

	const links: Link[] = [
		{
			icon: Medal,
			id: 'leaderboard',
			label: 'Leaderboard',
			load: () => import('@components/modals/Leaderboard.svelte'),
			condition: () => reveals.leaderboard,
		},
		{
			icon: Network,
			id: 'skill-tree',
			label: 'Skill Tree',
			load: () => import('@components/modals/SkillTree.svelte'),
			condition: () => gameManager.skillUpgrades.length > 0 || SKILL_TREE_ROOTS.some(root => currenciesManager.getEarnedAllTime(root.cost.currency) >= root.cost.amount),
			notification: () => gameManager.hasAvailableSkillUpgrades,
		},
		{
			icon: Zap,
			id: 'boosts',
			label: 'Boosts',
			load: () => import('@components/modals/CurrencyBoosts.svelte'),
			condition: () => gameManager.totalProtonisesAllTime > 0,
			notification: () => gameManager.boostPointsAvailable > 0,
		},
		{
			icon: QuarkIcon,
			iconProps: { mono: true },
			id: 'quarks',
			label: 'Quarks',
			load: () => import('@components/modals/Quarks.svelte'),
			condition: () => quarksManager.balance > 0,
			notification: () => supabaseAuth.isAuthenticated && quarksManager.hasSynced && quarksManager.hasClaimableQuest,
		},
		{
			icon: Orbit,
			id: 'collider',
			label: 'Collider',
			load: () => import('@components/modals/Collider.svelte'),
			condition: () => gameManager.features[FeatureTypes.COLLIDER],
			notification: () => supabaseAuth.isAuthenticated && colliderManager.ready,
		},
		{
			glow: PROTON_COLOR,
			icon: ProtoniseIcon,
			iconProps: { color: PROTON_COLOR },
			id: 'protonise',
			label: 'Protonise',
			load: () => import('@components/prestige/Protonise.svelte'),
			condition: () => gameManager.atoms >= PROTONS_ATOMS_REQUIRED || gameManager.totalProtonisesAllTime > 0,
			notification: () => gameManager.protoniseProtonsGain > gameManager.protons,
		},
		{
			glow: ELECTRON_COLOR,
			icon: ElectronizeIcon,
			iconProps: { color: ELECTRON_COLOR },
			id: 'electronize',
			label: 'Electronize',
			load: () => import('@components/prestige/Electronize.svelte'),
			condition: () => gameManager.protons >= ELECTRONS_PROTONS_REQUIRED || gameManager.totalElectronizesAllTime > 0,
			notification: () => gameManager.electronizeElectronsGain > 0,
		},
		{
			glow: WHITE_LIGHT_COLOR,
			icon: IonizeIcon,
			iconProps: { color: WHITE_LIGHT_COLOR },
			id: 'ionize',
			label: 'Ionize',
			load: () => import('@components/prestige/Ionize.svelte'),
			condition: () => radiationManager.unlocked || gameManager.totalIonizesAllTime > 0,
			notification: () => radiationManager.ionizeReady,
		},
	];

	const settingsLink: Link = {
		icon: SettingsIcon,
		iconProps: { class: 'transition-transform duration-500 group-hover:rotate-90' },
		id: 'settings',
		label: 'Settings',
		load: settingsLoader,
	};

	/**
	 * The conditions read live currencies, so the mask is re-evaluated on every atom commit, but as a string it only
	 * invalidates the link lists, and re-renders the nav, when a link actually appears or disappears.
	 */
	const visibleMask = $derived(links.map(link => (!link.condition || link.condition() ? '1' : '0')).join(''));
	const visibleLinks = $derived(links.filter((_, i) => visibleMask[i] === '1'));
	const menuLinks = $derived(visibleLinks.filter(link => !link.glow));
	const prestigeLinks = $derived(visibleLinks.filter(link => link.glow));

	onMount(() => {
		ui.registerSettings(settingsLoader);

		// Chunks are warmed once the page is idle, so the split costs nothing on the first open.
		const warm = () => [...links, settingsLink].forEach(link => ui.preloadModal(link.id, link.load));
		if ('requestIdleCallback' in window) requestIdleCallback(warm, { timeout: 5000 });
		else setTimeout(warm, 2000);
	});
</script>

{#snippet navButton(link: Link)}
	{const notification = $derived(link.notification?.() ?? false)}
	<button
		aria-label={link.label}
		class={[
			'group relative flex shrink-0 items-center justify-center rounded-xl transition-colors',
			mobile.current ? 'h-12 max-w-16 min-w-0 flex-1' : 'size-12',
			ui.activeModalId === link.id ? 'bg-white/10 text-white' : 'text-white/75 hover:bg-white/5 hover:text-white',
		]}
		id="nav-{link.id}"
		in:reveal={{ y: 0 }}
		onclick={() => ui.openModalLazy(link.id, link.load)}
	>
		<NotificationDot class="relative flex" color={link.glow} hasNotification={notification}>
			<link.icon
				size={mobile.current ? 26 : 30}
				style={link.glow && notification ? `filter: drop-shadow(0 0 6px ${link.glow})` : undefined}
				{...link.iconProps}
			/>
		</NotificationDot>
		{#if !mobile.current}
			<span
				class="label invisible absolute left-[calc(100%+1.25rem)] z-50 whitespace-nowrap rounded-xl border border-white/10 bg-accent-950/95 px-3 py-2 text-sm text-white/90 opacity-0 shadow-2xl backdrop-blur-md transition-all group-hover:visible group-hover:opacity-100"
			>
				{link.label}
			</span>
		{/if}
	</button>
{/snippet}

<!-- A single nav restyled between the phone dock and the desktop rail, so rotating a tablet never remounts its buttons. -->
<nav
	class={[
		'fixed bottom-0 flex',
		mobile.current ?
			'inset-x-0 z-40 h-(--mobile-nav-height) items-center justify-center gap-0.5 border-t border-white/10 bg-accent-950/95 px-1'
		:	'left-0 z-50 w-18 flex-col items-center gap-2 border-r border-white/5 bg-black/25 py-4 backdrop-blur-xs',
	]}
	style:top={mobile.current ? undefined : 'var(--banner-height)'}
>
	{#each menuLinks as link (link.id)}
		{@render navButton(link)}
	{/each}
	{#if menuLinks.length > 0 && prestigeLinks.length > 0}
		<div class={['shrink-0 bg-white/10', mobile.current ? 'mx-1 h-7 w-px' : 'my-2 h-px w-8']}></div>
	{/if}
	{#each prestigeLinks as link (link.id)}
		{@render navButton(link)}
	{/each}
	<div class={mobile.current ? 'mx-1 h-7 w-px shrink-0 bg-white/10' : 'flex-1'}></div>
	{@render navButton(settingsLink)}
</nav>

{#if ui.activeModal}
	{const ActiveModal = $derived(ui.activeModal)}
	<ActiveModal onClose={() => ui.closeModal()} />
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
		border-color: transparent var(--color-accent-950) transparent transparent;
	}
</style>
