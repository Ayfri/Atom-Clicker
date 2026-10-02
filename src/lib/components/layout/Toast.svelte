<script lang="ts">
	import type { Component } from 'svelte';
	import type { IconStackSpec } from '#helpers/iconStacks.js';
	import { toastStore, type Toast, type ToastStyle } from '#stores/toasts.svelte.js';
	import { Award, Coffee, Globe, Trophy, X } from '@lucide/svelte';
	import Discord from '#components/icons/Discord.svelte';
	import GitHub from '#components/icons/GitHub.svelte';
	import IconStack from '#components/ui/IconStack.svelte';

	const namedIcons = { Award, Coffee, Discord, GitHub, Globe, Trophy } as const;

	interface Props {
		config: ToastStyle;
		toast: Toast;
	}

	let { config, toast }: Props = $props();

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

<div class="toast relative flex w-full max-w-sm overflow-hidden rounded-xl border {config.border} bg-neutral-900/95 p-4 shadow-xl backdrop-blur-sm pointer-events-auto sm:w-85">
	<div class="flex w-full gap-4">
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

		<button
			class="absolute right-3 top-3 flex size-7 shrink-0 items-center justify-center rounded-lg text-neutral-500 transition-colors hover:bg-white/10 hover:text-white"
			onclick={() => toastStore.remove(toast.id)}
		>
			<X size={16} />
		</button>
	</div>

	{#if toast.duration > 0}
		<div class="absolute bottom-0 left-0 h-1 w-full bg-white/5">
			<!-- The bar's own animation is the toast's timer, so pausing it on hover or focus also holds the toast open. -->
			<div
				class="progress h-full opacity-40 {config.progressBarColor}"
				onanimationend={() => toastStore.remove(toast.id)}
				style:animation-duration="{toast.duration}ms"
			></div>
		</div>
	{/if}
</div>

<style>
	.progress {
		animation: progress linear forwards;
		transform-origin: left;
	}

	.toast:focus-within .progress {
		animation-play-state: paused;
	}

	@media (hover: hover) {
		.toast:hover .progress {
			animation-play-state: paused;
		}
	}

	@keyframes progress {
		from {
			transform: scaleX(0);
		}
	}
</style>
