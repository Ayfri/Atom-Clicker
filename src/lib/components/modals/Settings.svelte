<script lang="ts">
	import Modal from '@components/ui/Modal.svelte';
	import Profile from '@components/settings/Profile.svelte';
	import GlobalStats from '@components/settings/Stats.svelte';
	import CloudSave from '@components/settings/CloudSave.svelte';
	import Changelog from '@components/settings/Changelog.svelte';
	import Credits from '@components/settings/Credits.svelte';
	import FeedbackForm from '@components/settings/Feedback.svelte';
	import { User, Activity, Cloud, Info, MessageSquare, FileText, ChevronLeft } from 'lucide-svelte';

	interface Props {
		onClose: () => void;
	}

	import { ui } from '$stores/ui.svelte';

	let { onClose }: Props = $props();

	let activeTab = $state(ui.activeTab || 'profile');
	let mounted = $state(false);

	$effect(() => {
		if (!mounted) {
			if (window.innerWidth < 768 && !ui.activeTab) {
				activeTab = 'home';
			}
			mounted = true;
		}
	});

	$effect(() => {
		ui.activeTab = activeTab;
	});

	const tabs = [
		{ id: 'profile', label: 'Profile', icon: User, component: Profile },
		{ id: 'stats', label: 'Stats', icon: Activity, component: GlobalStats },
		{ id: 'cloud', label: 'Cloud Save', icon: Cloud, component: CloudSave },
		{ id: 'changelog', label: 'Changelog', icon: FileText, component: Changelog },
		{ id: 'credits', label: 'Credits', icon: Info, component: Credits },
		{ id: 'feedback', label: 'Feedback', icon: MessageSquare, component: FeedbackForm },
	];
</script>

<Modal {onClose} title={activeTab === 'home' ? 'Settings' : tabs.find(t => t.id === activeTab)?.label || 'Settings'} width="xl" containerClass="!p-0 flex flex-col md:flex-row bg-transparent">
	<div class="flex flex-col md:flex-row h-full w-full overflow-hidden">
		<!-- Sidebar / Mobile Top Bar -->
		<div
			class="flex flex-row md:flex-col gap-1 overflow-x-auto md:overflow-visible p-2 md:p-3 md:w-64 shrink-0 border-b md:border-b-0 md:border-r border-white/10 bg-black/40 transition-all
			{activeTab === 'home' ? 'hidden md:flex' : 'flex'}"
		>
			{#if activeTab !== 'home'}
				<button
					class="md:hidden flex items-center justify-center p-3 text-white/50 hover:text-white transition-colors border border-transparent"
					onclick={() => activeTab = 'home'}
				>
					<ChevronLeft size={22} />
				</button>
			{/if}

			{#each tabs as tab}
				<button
					class="flex items-center gap-3 px-4 py-3 rounded-xl transition-all whitespace-nowrap text-left group
					{activeTab === tab.id
						? 'bg-accent/20 text-accent border border-accent/30 shadow-[0_0_15px_rgba(var(--color-accent),0.1)]'
						: 'hover:bg-white/5 text-white/50 hover:text-white border border-transparent'}"
					onclick={() => activeTab = tab.id}
				>
					<tab.icon size={20} class={activeTab === tab.id ? 'text-accent' : 'text-white/40 group-hover:text-white'} />
					<span class="font-medium md:block hidden">{tab.label}</span>
				</button>
			{/each}
		</div>

		<!-- Content -->
		<div class="flex-1 overflow-hidden relative bg-black/10">
			 <div class="absolute inset-0 overflow-y-auto custom-scrollbar {activeTab === 'feedback' ? 'p-0' : 'p-4 md:p-8'}">
				{#if activeTab === 'home'}
					<div class="grid grid-cols-2 gap-3 md:hidden h-full content-start">
						{#each tabs as tab}
							<button
								class="flex flex-col items-center justify-center gap-4 aspect-square rounded-2xl bg-linear-to-br from-white/10 to-transparent border border-white/10 active:scale-95 transition-all text-center group"
								onclick={() => activeTab = tab.id}
							>
								<div class="p-4 rounded-xl bg-white/5 border border-white/10 group-hover:bg-accent/20 group-hover:border-accent/30 transition-all">
									<tab.icon size={32} class="text-white/60 group-hover:text-accent transition-colors" />
								</div>
								<span class="font-semibold text-white/80 group-hover:text-white transition-colors">{tab.label}</span>
							</button>
						{/each}
					</div>
				{/if}

				{#each tabs as tab}
					{#if activeTab === tab.id}
						 <tab.component />
					{/if}
				{/each}
			 </div>
		</div>
	</div>
</Modal>
