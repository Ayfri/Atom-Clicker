<script lang="ts">
	import QuarkIcon from '@components/icons/Quark.svelte';
	import { SKILL_UPGRADES } from '$data/skillTree';
	import NotificationDot from '@components/ui/NotificationDot.svelte';
	import { ELECTRONS_PROTONS_REQUIRED, PROTONS_ATOMS_REQUIRED } from '$lib/constants';
	import { changelog } from '$stores/changelog';
	import { gameManager } from '$helpers/GameManager.svelte';
	import { quarksManager } from '$helpers/QuarksManager.svelte';
	import { supabaseAuth } from '$stores/supabaseAuth.svelte';
	import { ui } from '$stores/ui.svelte';
	import { mobile } from '$stores/window.svelte';
	import { Atom, Network, Orbit, Settings as SettingsIcon, Trophy, Zap } from '@lucide/svelte';
	import { onDestroy, onMount, type Component } from 'svelte';

	type NavBarIcon = Component<{ class?: string; size?: number }>;
	type ModalLoader = () => Promise<{ default: Component<{ onClose: () => void }> }>;

	interface Link {
		condition?: () => boolean;
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

	const links: Link[] = [
		{
			icon: Trophy,
			id: 'leaderboard',
			label: 'Leaderboard',
			load: () => import('@components/modals/Leaderboard.svelte'),
		},
		{
			icon: Network,
			id: 'skill-tree',
			label: 'Skill Tree',
			load: () => import('@components/modals/SkillTree.svelte'),
			condition: () => gameManager.skillUpgrades.length > 0 || SKILL_TREE_ROOTS.some(root => gameManager.canAfford(root.cost)),
			notification: () => gameManager.hasAvailableSkillUpgrades,
		},
		{
			icon: Zap,
			id: 'boosts',
			label: 'Boosts',
			load: () => import('@components/modals/CurrencyBoosts.svelte'),
			condition: () => gameManager.totalProtonisesAllTime > 0,
			notification: () => gameManager.skillPointsAvailable > 0,
		},
		{
			icon: QuarkIcon,
			iconProps: { color: 'white', mono: true },
			id: 'quarks',
			label: 'Quarks',
			load: () => import('@components/modals/Quarks.svelte'),
			condition: () => quarksManager.balance > 0,
			notification: () => supabaseAuth.isAuthenticated && quarksManager.hasSynced && quarksManager.hasClaimableQuest,
		},
		{
			icon: Atom,
			id: 'protonise',
			label: 'Protonise',
			load: () => import('@components/prestige/Protonise.svelte'),
			condition: () => gameManager.atoms >= PROTONS_ATOMS_REQUIRED || gameManager.totalProtonisesAllTime > 0,
			notification: () => gameManager.protoniseProtonsGain > gameManager.protons,
		},
		{
			icon: Orbit,
			id: 'electronize',
			label: 'Electronize',
			load: () => import('@components/prestige/Electronize.svelte'),
			condition: () => gameManager.protons >= ELECTRONS_PROTONS_REQUIRED || gameManager.totalElectronizesAllTime > 0,
			notification: () => gameManager.electronizeElectronsGain > 0,
		},
	];

	const settingsLink: Link = {
		icon: SettingsIcon,
		id: 'settings',
		label: 'Parameters',
		load: settingsLoader,
		notification: () => $changelog.hasUnread,
	};

	let visibleComponents: Link[] = $state([]);

	let interval: ReturnType<typeof setInterval> | null = null;

	onMount(() => {
		ui.registerSettings(settingsLoader);
		// Reassigning unconditionally re-rendered the whole nav ten times a second, the visible set almost never changes.
		const updateVisible = () => {
			const next = links.filter(link => !link.condition || link.condition());
			if (next.length === visibleComponents.length && next.every((link, i) => link === visibleComponents[i])) return;
			visibleComponents = next;
		};
		updateVisible();
		interval = setInterval(updateVisible, 100);

		// Chunks are warmed once the page is idle, so the split costs nothing on the first open.
		const warm = () => [...links, settingsLink].forEach(link => ui.preloadModal(link.id, link.load));
		if ('requestIdleCallback' in window) requestIdleCallback(warm, { timeout: 5000 });
		else setTimeout(warm, 2000);
	});

	onDestroy(() => {
		if (interval) clearInterval(interval);
		document.documentElement.style.removeProperty('--mobile-nav-bottom');
	});

	// The phone nav floats over the realm, so anything else floating there reads this to dock below it instead of on top of it.
	let mobileNavHeight = $state(0);
	$effect(() => {
		if (!mobile.current) {
			document.documentElement.style.removeProperty('--mobile-nav-bottom');
			return;
		}
		document.documentElement.style.setProperty('--mobile-nav-bottom', `calc(33vh + ${mobileNavHeight / 2}px)`);
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
		bind:clientHeight={mobileNavHeight}
	>
		{#each visibleComponents as link}
			<NotificationDot hasNotification={link.notification ? link.notification() : false}>
				<button
					aria-label={link.label}
					class="flex items-center justify-center rounded-lg p-2 text-white/85 transition-all hover:text-white pointer-events-auto"
					id="nav-{link.label.toLowerCase().replace(/\s+/g, '-')}"
					onclick={() => ui.openModalLazy(link.id, link.load)}
				>
					<link.icon size={30} {...link.iconProps} />
				</button>
			</NotificationDot>
		{/each}

		<!-- Mobile Settings (add to grid or place separately? User said bottom of navbar, which implies desktop mostly, but let's add it here too if space permits or just keep it in flow) -->
		<!-- For mobile, just append it to the list effectively -->
		<NotificationDot hasNotification={settingsLink.notification ? settingsLink.notification() : false}>
			<button
				aria-label={settingsLink.label}
				class="flex items-center justify-center rounded-lg p-2 text-white/85 transition-all hover:text-white pointer-events-auto"
				id="nav-{settingsLink.label.toLowerCase().replace(/\s+/g, '-')}"
				onclick={() => ui.openModalLazy(settingsLink.id, settingsLink.load)}
			>
				<settingsLink.icon size={30} />
			</button>
		</NotificationDot>
	</div>
{:else}
	<nav
		class="fixed left-0 z-50 flex h-full flex-col items-center gap-5 bg-black/20 px-3 py-6 backdrop-blur-xs transition-all duration-300"
		style="top: var(--banner-height)"
	>
		{#each visibleComponents as link}
			<NotificationDot hasNotification={link.notification ? link.notification() : false}>
				<button
					class="group relative flex h-12 w-12 items-center justify-center rounded-lg text-white/85 transition-all hover:text-white"
					id="nav-{link.label.toLowerCase().replace(/\s+/g, '-')}"
					onclick={() => ui.openModalLazy(link.id, link.load)}
				>
					<link.icon size={32} {...link.iconProps} />
					<span
						class="label invisible absolute left-[calc(100%+1.25rem)] whitespace-nowrap rounded-xl bg-accent-950/95 backdrop-blur-md px-3 py-2 text-sm text-white/90 opacity-0 transition-all group-hover:visible group-hover:opacity-100 border border-white/10 shadow-2xl z-50"
					>
						{link.label}
					</span>
				</button>
			</NotificationDot>
		{/each}

		<div class="flex-1"></div>

		<NotificationDot hasNotification={settingsLink.notification ? settingsLink.notification() : false}>
			<button
				class="group relative flex h-12 w-12 items-center justify-center rounded-lg text-white/85 transition-all hover:text-white"
				id="nav-{settingsLink.label.toLowerCase().replace(/\s+/g, '-')}"
				onclick={() => ui.openModalLazy(settingsLink.id, settingsLink.load)}
			>
				<div class="transition-transform duration-500 group-hover:rotate-90">
					<settingsLink.icon size={32} />
				</div>
				<span
					class="label invisible absolute left-[calc(100%+1.25rem)] whitespace-nowrap rounded-xl bg-accent-950/95 backdrop-blur-md px-3 py-2 text-sm text-white/90 opacity-0 transition-all group-hover:visible group-hover:opacity-100 border border-white/10 shadow-2xl z-50"
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
		border-color: transparent var(--color-accent-950) transparent transparent;
	}
</style>
