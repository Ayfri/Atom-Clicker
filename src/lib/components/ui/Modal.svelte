<script module lang="ts">
	/** Escape only closes the topmost modal, a Login opened over Settings would otherwise close both. */
	const stack: symbol[] = [];
</script>

<script lang="ts">
	import { ui } from '#stores/ui.svelte.js';
	import { X } from '@lucide/svelte';
	import { onMount, type Snippet } from 'svelte';
	import type { ClassValue } from 'svelte/elements';
	import { innerHeight, innerWidth } from 'svelte/reactivity/window';
	import { fade, fly, scale } from 'svelte/transition';

	interface Props {
		children?: Snippet;
		/** Dialog only, replaces its default border and background. */
		class?: ClassValue;
		containerClass?: string;
		/** A centered card sized to its content, whose heading lives in its children while `title` names it for screen readers. */
		dialog?: boolean;
		header?: Snippet;
		onClose?: () => void;
		title?: string;
		width?: 'sm' | 'md' | 'lg' | 'xl';
	}

	let { children, class: className, containerClass, dialog = false, header, onClose = () => {}, title, width = 'md' }: Props = $props();

	const widthClasses = $derived({ lg: 'max-w-5xl', md: 'max-w-3xl', sm: 'max-w-xl', xl: 'max-w-7xl' }[width]);

	let modalHeight = $state(0);
	let modalWidth = $state(0);
	/** Phones show the modal fullscreen, the desktop one leaves the game visible around it. */
	const covers = $derived(modalWidth >= (innerWidth.current ?? Infinity) && modalHeight >= (innerHeight.current ?? Infinity));

	$effect(() => {
		if (covers) return ui.cover();
	});

	const id = Symbol();
	onMount(() => {
		stack.push(id);
		return () => stack.splice(stack.indexOf(id), 1);
	});
</script>

<svelte:window onkeydown={e => e.key === 'Escape' && stack.at(-1) === id && onClose()} />

{#snippet close(className: string, size: number)}
	<button aria-label="Close" class={['flex shrink-0 items-center justify-center rounded-lg transition-colors *:hover:stroke-3', className]} onclick={onClose} type="button">
		<X class="transition-all duration-300" {size} />
	</button>
{/snippet}

<div
	class={['overlay fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs', dialog && 'p-4']}
	onclick={e => e.target === e.currentTarget && onClose()}
	role="presentation"
	transition:fade={{ duration: 200 }}
>
	{#if dialog}
		<div
			aria-label={title}
			aria-modal="true"
			class={[
				'custom-scrollbar relative max-h-full w-full max-w-md overflow-y-auto rounded-2xl p-6 shadow-2xl',
				className ?? 'border border-white/10 bg-linear-to-b from-accent-800 to-accent-900',
			]}
			role="dialog"
			tabindex="-1"
			transition:scale={{ duration: 250, start: 0.9 }}
		>
			<div class="absolute top-3 right-3 z-10">{@render close('size-8 text-white/50 hover:text-white', 18)}</div>
			{@render children?.()}
		</div>
	{:else}
		<div
			aria-label={title}
			aria-modal="true"
			bind:offsetHeight={modalHeight}
			bind:offsetWidth={modalWidth}
			class="modal flex h-dvh w-screen md:h-[85vh] md:w-[85vw] {widthClasses} flex-col overflow-hidden md:rounded-2xl shadow-2xl bg-linear-to-br from-accent-900 to-accent-800"
			role="dialog"
			tabindex="-1"
			transition:fly={{ duration: 300, y: -100 }}
		>
			<div class="flex items-center justify-between gap-4 border-b border-white/10 bg-black/40 p-4 sm:px-6">
				{#if header}
					{@render header()}
				{:else if title}
					<h2 class="flex-1 text-2xl font-bold text-white">{title}</h2>
				{:else}
					<div class="flex-1"></div>
				{/if}
				{@render close('size-10', 24)}
			</div>

			<div class={['flex-1 overflow-y-auto p-4 sm:p-8', containerClass]}>
				{@render children?.()}
			</div>
		</div>
	{/if}
</div>
