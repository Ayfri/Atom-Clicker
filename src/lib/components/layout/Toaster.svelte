<script lang="ts">
	import { toasts, clearAllToasts } from '$stores/toasts';
	import { AlertCircle, AlertTriangle, CheckCircle, Info, Trash2 } from 'lucide-svelte';
	import { fade } from 'svelte/transition';
	import Toast from './Toast.svelte';

	const typeConfig = {
		error: {
			border: 'border-red-500/50',
			icon: AlertCircle,
			iconColor: 'text-red-500',
			progressBarColor: 'bg-red-500',
			title: 'text-red-400'
		},
		info: {
			border: 'border-blue-500/50',
			icon: Info,
			iconColor: 'text-blue-500',
			progressBarColor: 'bg-blue-500',
			title: 'text-blue-200'
		},
		success: {
			border: 'border-green-500/50',
			icon: CheckCircle,
			iconColor: 'text-green-500',
			progressBarColor: 'bg-green-500',
			title: 'text-green-200'
		},
		warning: {
			border: 'border-yellow-500/50',
			icon: AlertTriangle,
			iconColor: 'text-yellow-500',
			progressBarColor: 'bg-yellow-500',
			title: 'text-yellow-500'
		}
	} as const;
</script>

<div
	class="fixed bottom-0 right-0 z-100 flex flex-col gap-3 p-4 sm:bottom-8 sm:right-8 sm:p-0"
>
	{#each $toasts as toast (toast.id)}
		<Toast {toast} config={typeConfig[toast.type]} />
	{/each}

	{#if $toasts.length > 1}
		<button
			class="flex w-fit items-center self-end gap-2 rounded-lg bg-red-900/70 p-2 text-white transition-all duration-300 hover:bg-red-800/70"
			onclick={clearAllToasts}
			title="Clear All"
			transition:fade={{ duration: 400 }}
		>
			<Trash2 size={18} />
		</button>
	{/if}
</div>
