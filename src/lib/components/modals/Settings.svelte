<script lang="ts">
	import Changelog from '@components/settings/Changelog.svelte';
	import CloudSave from '@components/settings/CloudSave.svelte';
	import Credits from '@components/settings/Credits.svelte';
	import FeedbackForm from '@components/settings/Feedback.svelte';
	import Legal from '@components/settings/Legal.svelte';
	import Profile from '@components/settings/Profile.svelte';
	import GlobalStats from '@components/settings/Stats.svelte';
	import Modal from '@components/ui/Modal.svelte';
	import { ui } from '$stores/ui.svelte';
	import { Activity, ChevronLeft, ChevronRight, Cloud, FileText, Info, MessageSquare, Scale, User } from '@lucide/svelte';
	import type { Component } from 'svelte';
	import { MediaQuery } from 'svelte/reactivity';

	interface Props {
		onClose: () => void;
	}

	interface SettingsTab {
		component: Component;
		description: string;
		icon: typeof User;
		id: string;
		label: string;
	}

	let { onClose }: Props = $props();

	const groups: { label: string; tabs: SettingsTab[] }[] = [
		{
			label: 'Account',
			tabs: [
				{ component: Profile, description: 'Account, username and gameplay options', icon: User, id: 'profile', label: 'Profile' },
				{ component: CloudSave, description: 'Sync your progress or reset it', icon: Cloud, id: 'cloud', label: 'Cloud Save' },
			],
		},
		{
			label: 'Game',
			tabs: [
				{ component: GlobalStats, description: 'Your progress in numbers', icon: Activity, id: 'stats', label: 'Stats' },
				{ component: Changelog, description: 'What changed in each update', icon: FileText, id: 'changelog', label: 'Changelog' },
			],
		},
		{
			label: 'About',
			tabs: [
				{ component: FeedbackForm, description: 'Report a bug or share an idea', icon: MessageSquare, id: 'feedback', label: 'Feedback' },
				{ component: Credits, description: 'Creator, links and thanks', icon: Info, id: 'credits', label: 'Credits' },
				{ component: Legal, description: 'Legal notice, privacy and terms', icon: Scale, id: 'legal', label: 'Legal & Privacy' },
			],
		},
	];
	const tabs = groups.flatMap(group => group.tabs);

	/** The `home` tab is the phone-only tab list, desktop always shows the sidebar next to a tab. */
	const narrow = new MediaQuery('(width < 48rem)', true);

	let activeTab = $state(ui.activeTab ?? (narrow.current ? 'home' : 'profile'));
	const shownTab = $derived(!narrow.current && activeTab === 'home' ? 'profile' : activeTab);
	const current = $derived(tabs.find(tab => tab.id === shownTab));

	$effect(() => {
		ui.activeTab = shownTab;
	});
</script>

<Modal {onClose} containerClass="!p-0" width="xl">
	{#snippet header()}
		<div class="flex min-w-0 flex-1 items-center gap-1">
			{#if current && narrow.current}
				<button aria-label="Back to settings" class="-ml-2 flex size-10 items-center justify-center rounded-lg text-white/60 transition-colors hover:text-white" onclick={() => (activeTab = 'home')}>
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
							class="group flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors
							{shownTab === tab.id ? 'border-accent/30 bg-accent/20 text-accent' : 'border-transparent text-white/60 hover:bg-white/5 hover:text-white'}"
							onclick={() => (activeTab = tab.id)}
						>
							<tab.icon class={shownTab === tab.id ? 'text-accent' : 'text-white/40 group-hover:text-white'} size={18} />
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
										<button class="flex w-full items-center gap-4 p-4 text-left transition-colors active:bg-white/10" onclick={() => (activeTab = tab.id)}>
											<span class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent">
												<tab.icon size={20} />
											</span>
											<span class="flex min-w-0 flex-1 flex-col">
												<span class="font-semibold text-white">{tab.label}</span>
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
