<script lang="ts">
	import { onMount } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { linear } from 'svelte/easing';
	import { X } from 'lucide-svelte';
	import { fly } from 'svelte/transition';
	import type { Toast as ToastType } from '$stores/toasts';
	import { removeToast } from '$stores/toasts';

	interface Props {
		toast: ToastType;
		config: any;
	}

	let { toast, config }: Props = $props();

	const progress = new Tween(0, {
		duration: () => toast.duration,
		easing: linear
	});

	onMount(() => {
		if (!toast.is_infinite && toast.duration > 0) {
			progress.set(100);
		}
	});

</script>

<div
	class="relative flex w-full max-w-sm overflow-hidden rounded-xl border {config.border} bg-neutral-900/95 p-4 shadow-xl backdrop-blur-sm sm:w-85"
	transition:fly={{ duration: 400, x: 20 }}
>
	<div class="flex w-full gap-4">
		<!-- Icon Container -->
		<div class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white/5 border border-white/5">
			{#if toast.icon}
				<toast.icon size={24} class={config.iconColor} />
			{:else}
				<config.icon size={24} class={config.iconColor} />
			{/if}
		</div>

		<!-- Content Column -->
		<div class="flex-1 min-w-0 pr-6">
			<h3 class="font-bold tracking-tight {config.title} truncate">{toast.title}</h3>
			<p class="mt-1 text-sm leading-relaxed text-neutral-300 whitespace-pre-line">
				{toast.message}
			</p>
			{#if toast.action && toast.actionLabel}
				<button
					class="mt-3 inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/90 transition-colors hover:bg-white/10"
					onclick={() => {
						toast.action?.();
						removeToast(toast.id);
					}}
				>
					{toast.actionLabel}
				</button>
			{/if}
		</div>

		<!-- Close Button -->
		<button
			class="absolute right-3 top-3 flex size-7 shrink-0 items-center justify-center rounded-lg text-neutral-500 transition-colors hover:bg-white/10 hover:text-white"
			onclick={() => removeToast(toast.id)}
		>
			<X size={16} />
		</button>
	</div>

	<!-- Linear Progress -->
	{#if !toast.is_infinite && toast.duration > 0}
		<div class="absolute bottom-0 left-0 h-1 bg-white/5 w-full">
			<div
				class="h-full {config.progressBarColor} opacity-40"
				style="width: {progress.current}%"
			></div>
		</div>
	{/if}
</div>
