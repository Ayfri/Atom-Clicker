<script lang="ts">
	import type { Component } from 'svelte';
	import type { IconStackSpec } from '$helpers/iconStacks';
	import { toastStore, type Toast, type ToastStyle } from '$stores/toasts.svelte';
	import { Award, Coffee, Globe, Trophy, X } from '@lucide/svelte';
	import Discord from '@components/icons/Discord.svelte';
	import GitHub from '@components/icons/GitHub.svelte';
	import IconStack from '@components/ui/IconStack.svelte';
	import { linear } from 'svelte/easing';
	import { Tween } from 'svelte/motion';
	import { onMount } from 'svelte';
	import { fly } from 'svelte/transition';

	const namedIcons = { Award, Coffee, Discord, GitHub, Globe, Trophy } as const;

	interface Props {
		config: ToastStyle;
		toast: Toast;
	}

	let { config, toast }: Props = $props();

	const progress = new Tween(0, {
		duration: () => toast.duration,
		easing: linear,
	});

	onMount(() => {
		if (!toast.is_infinite && toast.duration > 0) {
			progress.set(100);
		}
	});

	function isIconStack(icon: Toast['icon']): icon is IconStackSpec {
		return typeof icon === 'object' && icon !== null && 'icon' in icon;
	}

	function resolveIcon(icon: Toast['icon'], fallback: Component): Component {
		if (typeof icon === 'string') {
			if (icon in namedIcons) return namedIcons[icon as keyof typeof namedIcons];
			return fallback;
		}
		if (isIconStack(icon)) return fallback;
		return icon ?? fallback;
	}

	const iconStack = $derived(isIconStack(toast.icon) ? toast.icon : undefined);
	const IconComponent = $derived(resolveIcon(toast.icon, config.icon));
</script>

<div
	class="relative flex w-full max-w-sm overflow-hidden rounded-xl border {config.border} bg-neutral-900/95 p-4 shadow-xl backdrop-blur-sm pointer-events-auto sm:w-85"
	transition:fly={{ duration: 400, x: 20 }}
>
	<div class="flex w-full gap-4">
		<!-- Icon Container -->
		<div class="flex size-10 shrink-0 items-center justify-center border border-white/5 rounded-lg bg-white/5">
			{#if iconStack}
				<IconStack
					color={iconStack.color}
					count={iconStack.count}
					icon={iconStack.icon}
					label={iconStack.label}
					size={26}
				/>
			{:else}
				<IconComponent
					class={config.iconColor}
					size={24}
				/>
			{/if}
		</div>

		<!-- Content Column -->
		<div class="flex-1 min-w-0 pr-6">
			<h3 class="font-bold tracking-tight truncate {config.title}">{toast.title}</h3>
			<p class="mt-1 leading-relaxed text-neutral-300 text-sm whitespace-pre-line">
				{toast.message}
			</p>
			{#if toast.action && toast.actionLabel}
				<button
					class="mt-3 inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/5 font-semibold px-3 py-1.5 text-white/90 text-xs transition-colors hover:bg-white/10"
					onclick={() => {
						toast.action?.();
						toastStore.remove(toast.id);
					}}
				>
					{toast.actionLabel}
				</button>
			{/if}
		</div>

		<!-- Close Button -->
		<button
			class="absolute right-3 top-3 flex size-7 shrink-0 items-center justify-center rounded-lg text-neutral-500 transition-colors hover:bg-white/10 hover:text-white"
			onclick={() => toastStore.remove(toast.id)}
		>
			<X size={16} />
		</button>
	</div>

	<!-- Linear Progress -->
	{#if !toast.is_infinite && toast.duration > 0}
		<div class="absolute bottom-0 left-0 h-1 w-full bg-white/5">
			<div
				class="h-full opacity-40 {config.progressBarColor}"
				style="width: {progress.current}%"
			></div>
		</div>
	{/if}
</div>
