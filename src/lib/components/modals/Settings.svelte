<script lang="ts">
	import Changelog from '#components/settings/Changelog.svelte';
	import CloudSave from '#components/settings/CloudSave.svelte';
	import Credits from '#components/settings/Credits.svelte';
	import FeedbackForm from '#components/settings/Feedback.svelte';
	import Gameplay from '#components/settings/Gameplay.svelte';
	import Install from '#components/settings/Install.svelte';
	import Legal from '#components/settings/Legal.svelte';
	import Profile from '#components/settings/Profile.svelte';
	import GlobalStats from '#components/settings/Stats.svelte';
	import Modal from '#components/ui/Modal.svelte';
	import NotificationDot from '#components/ui/NotificationDot.svelte';
	import { APP_PRODUCTION_PERCENT } from '#lib/constants.js';
	import { changelog } from '#stores/changelog.svelte.js';
	import { installStore } from '#stores/install.svelte.js';
	import { ui } from '#stores/ui.svelte.js';
	import { ChartLine, ChevronLeft, ChevronRight, Cloud, FileText, Gavel, Heart, MessageSquare, MonitorDown, SlidersHorizontal, User } from '@lucide/svelte';
	import type { Component } from 'svelte';
	import { MediaQuery } from 'svelte/reactivity';

	interface Props {
		onClose: () => void;
	}

	interface SettingsTab {
		component: Component;
		description: string;
		/** Drawn in its own color, for a tab that offers something rather than settings. */
		highlight?: boolean;
		icon: typeof User;
		id: string;
		label: string;
		notification?: () => boolean;
		/** Tabs hidden while this returns false, like the install tab on a browser that can't install. */
		visible?: () => boolean;
	}

	let { onClose }: Props = $props();

	/** Read once, so the Install tab stays after the browser's dialog used up the prompt. */
	const canInstall = installStore.canInstall;

	const allGroups: { label: string; tabs: SettingsTab[] }[] = [
		{
			label: 'Account',
			tabs: [
				{ component: Profile, description: 'Your account, name and picture', icon: User, id: 'profile', label: 'Profile' },
				{ component: CloudSave, description: 'Sync your progress or reset it', icon: Cloud, id: 'cloud', label: 'Cloud Save' },
			],
		},
		{
			label: 'Game',
			tabs: [
				{ component: Gameplay, description: 'Offline progress, numbers and tips', icon: SlidersHorizontal, id: 'gameplay', label: 'Gameplay' },
				{ component: GlobalStats, description: 'Your progress in numbers', icon: ChartLine, id: 'stats', label: 'Stats' },
				{ component: Changelog, description: 'What changed in each update', icon: FileText, id: 'changelog', label: 'Changelog', notification: () => changelog.unread },
				{ component: Install, description: `Install as an app for +${APP_PRODUCTION_PERCENT}% production`, highlight: true, icon: MonitorDown, id: 'install', label: 'Install', visible: () => canInstall },
			],
		},
		{
			label: 'About',
			tabs: [
				{ component: FeedbackForm, description: 'Report a bug or share an idea', icon: MessageSquare, id: 'feedback', label: 'Feedback' },
				{ component: Credits, description: 'Creator, links and thanks', icon: Heart, id: 'credits', label: 'Credits' },
				{ component: Legal, description: 'Legal notice, privacy and terms', icon: Gavel, id: 'legal', label: 'Legal & Privacy' },
			],
		},
	];
	const groups = $derived(allGroups.map(group => ({ ...group, tabs: group.tabs.filter(tab => tab.visible?.() ?? true) })));
	const tabs = $derived(groups.flatMap(group => group.tabs));

	/** The `home` tab is the phone-only tab list, desktop always shows the sidebar next to a tab. */
	const narrow = new MediaQuery('(width < 48rem)', true);

	/** Lives in `ui` so anything, like the Profile's stats link, can switch tabs through `ui.openSettings`. A tab that just got hidden falls back to the first visible one. */
	const shownTab = $derived(
		ui.activeTab === 'home' && narrow.current ? 'home' : tabs.some(tab => tab.id === ui.activeTab) ? ui.activeTab : narrow.current ? 'home' : tabs[0].id,
	);
	const current = $derived(tabs.find(tab => tab.id === shownTab));
</script>

<Modal {onClose} containerClass="!p-0" width="xl">
	{#snippet header()}
		<div class="flex min-w-0 flex-1 items-center gap-1">
			{#if current && narrow.current}
				<button aria-label="Back to settings" class="-ml-2 flex size-10 items-center justify-center rounded-lg text-white/60 transition-colors hover:text-white" onclick={() => (ui.activeTab = 'home')}>
					<ChevronLeft size={24} />
				</button>
			{/if}
			<h2 class="truncate text-xl font-bold text-white md:text-2xl">{narrow.current ? (current?.label ?? 'Settings') : 'Settings'}</h2>
		</div>
	{/snippet}

	<div class="flex h-full">
		<nav class="custom-scrollbar hidden w-60 shrink-0 flex-col gap-5 overflow-y-auto border-r border-white/10 bg-black/40 p-3 md:flex">
			{#each groups as group (group.label)}
				<div class="flex flex-col gap-1">
					<p class="px-3 pb-1 text-xs font-semibold tracking-wider text-white/40 uppercase">{group.label}</p>
					{#each group.tabs as tab (tab.id)}
						<button
							aria-current={shownTab === tab.id ? 'page' : undefined}
							class={[
								'group flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors',
								shownTab === tab.id
									? 'border-accent/30 bg-accent/20 text-accent'
									: tab.highlight
										? 'border-transparent bg-accent/5 text-accent hover:bg-accent/10'
										: 'border-transparent text-white/60 hover:bg-white/5 hover:text-white',
							]}
							onclick={() => (ui.activeTab = tab.id)}
						>
							<NotificationDot class="relative flex" hasNotification={tab.notification?.() ?? false}>
								<tab.icon class={shownTab === tab.id || tab.highlight ? 'text-accent' : 'text-white/40 group-hover:text-white'} size={18} />
							</NotificationDot>
							<span class="font-medium">{tab.label}</span>
						</button>
					{/each}
				</div>
			{/each}
		</nav>

		<div class="relative flex-1 bg-black/10">
			<div class="custom-scrollbar absolute inset-0 overflow-y-auto {shownTab === 'feedback' ? '' : 'p-4 md:p-8'}">
				{#if current}
					<current.component />
				{:else}
					<div class="flex flex-col gap-6">
						{#each groups as group (group.label)}
							<section>
								<p class="px-1 pb-2 text-xs font-semibold tracking-wider text-white/40 uppercase">{group.label}</p>
								<div class="divide-y divide-white/10 overflow-hidden rounded-xl border border-white/10 bg-black/20">
									{#each group.tabs as tab (tab.id)}
										<button class={['flex w-full items-center gap-4 p-4 text-left transition-colors active:bg-white/10', tab.highlight && 'bg-accent/5']} onclick={() => (ui.activeTab = tab.id)}>
											<NotificationDot class="relative flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent" hasNotification={tab.notification?.() ?? false}>
												<tab.icon size={20} />
											</NotificationDot>
											<span class="flex min-w-0 flex-1 flex-col">
												<span class={['font-semibold', tab.highlight ? 'text-accent' : 'text-white']}>{tab.label}</span>
												<span class="truncate text-sm text-white/50">{tab.description}</span>
											</span>
											<ChevronRight class="shrink-0 text-white/30" size={20} />
										</button>
									{/each}
								</div>
							</section>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	</div>
</Modal>
