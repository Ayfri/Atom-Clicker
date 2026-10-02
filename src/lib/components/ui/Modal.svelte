<script lang="ts">
	import { fade, fly } from 'svelte/transition';
	import { X } from '@lucide/svelte';
	import { ui } from '#stores/ui.svelte.js';
	import type { Snippet } from 'svelte';
	import { innerHeight, innerWidth } from 'svelte/reactivity/window';

	interface Props {
		children?: Snippet;
		containerClass?: string | undefined;
		header?: Snippet;
		onClose?: () => void;
		title?: string | undefined;
		width?: 'sm' | 'md' | 'lg' | 'xl';
	}

	let {
		children,
		containerClass = undefined,
		header,
		onClose = () => {},
		title = undefined,
		width = 'md',
	}: Props = $props();

	const widthClasses = $derived({
		sm: 'max-w-xl',
		md: 'max-w-3xl',
		lg: 'max-w-5xl',
		xl: 'max-w-7xl'
	}[width]);

	let modalHeight = $state(0);
	let modalWidth = $state(0);
	/** Phones show the modal fullscreen, the desktop one leaves the game visible around it. */
	const covers = $derived(modalWidth >= (innerWidth.current ?? Infinity) && modalHeight >= (innerHeight.current ?? Infinity));

	$effect(() => {
		if (covers) return ui.cover();
	});

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			onClose();
		}
	}
</script>

<svelte:window onkeydown={onKeydown} />

<div
	aria-modal="true"
	class="overlay fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs"
	onclick={onClose}
	onkeydown={onKeydown}
	role="dialog"
	tabindex="0"
	transition:fade={{ duration: 200 }}
>
	<div
		bind:offsetHeight={modalHeight}
		bind:offsetWidth={modalWidth}
		class="modal flex h-dvh w-screen md:h-[85vh] md:w-[85vw] {widthClasses} flex-col overflow-hidden md:rounded-2xl shadow-2xl bg-linear-to-br from-accent-900 to-accent-800"
		onclick={(e) => e.stopPropagation()}
		onkeydown={onKeydown}
		role="dialog"
		tabindex="0"
		transition:fly={{ y: -100, duration: 300 }}
	>
		<div class="flex items-center justify-between gap-4 border-b border-white/10 bg-black/40 p-4 sm:px-6">
			{#if header}
				{@render header?.()}
			{:else if title}
				<h2 class="flex-1 text-2xl font-bold text-white">{title}</h2>
			{:else}
				<div class="flex-1"></div>
			{/if}
			<button class="flex h-10 w-10 items-center justify-center rounded-lg transition-colors *:hover:stroke-3" onclick={onClose}>
				<X class="transition-all duration-300" />
			</button>
		</div>

		<div class="flex-1 overflow-y-auto p-4 sm:p-8 {containerClass}">
			{@render children?.()}
		</div>
	</div>
</div>
