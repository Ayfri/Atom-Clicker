<script lang="ts" generics="T extends number | string">
	import { reveal } from '#helpers/reveals.svelte.js';
	import type { Component, Snippet } from 'svelte';
	import type { ClassValue } from 'svelte/elements';

	interface Tab {
		hint?: string;
		icon?: Component<{ class?: string }>;
		id: T;
		label?: string;
		title?: string;
	}

	interface Props {
		accent?: string;
		buttonClass?: ClassValue;
		class?: ClassValue;
		/** Replaces the icon and label, for tabs showing something else like a currency icon. */
		item?: Snippet<[tab: Tab]>;
		label?: string;
		onselect: (id: T) => void;
		role?: 'radiogroup' | 'tablist';
		selected: T;
		tabs: readonly Tab[];
	}

	let {
		accent = 'var(--color-accent-400)',
		buttonClass = 'px-1 py-1.5 text-xs sm:text-sm',
		class: className,
		item,
		label,
		onselect,
		role = 'tablist',
		selected,
		tabs,
	}: Props = $props();

	const radio = $derived(role === 'radiogroup');
</script>

<!-- No backdrop blur: the ambient dust behind moves every frame, so the blur would be recomputed every frame too. -->
<div class={['rounded-xl bg-black/25 p-1', className]} style:--c={accent}>
	<div aria-label={label} class="relative grid auto-cols-fr grid-flow-col" {role}>
		<!-- One pill slides under the tabs with `translate` only, the tabs themselves never repaint a background. -->
		<div
			aria-hidden="true"
			class="pointer-events-none absolute inset-y-0 left-0 w-[calc(100%/var(--n))] translate-x-[calc(var(--i)*100%)] rounded-lg border border-(--c)/45 bg-(--c)/20 shadow-[0_0_14px_-5px_var(--c)] transition-[translate] duration-300 ease-[cubic-bezier(0.34,1.3,0.64,1)]"
			style:--i={tabs.findIndex(tab => tab.id === selected)}
			style:--n={tabs.length}
		></div>
		{#each tabs as tab (tab.id)}
			{const active = $derived(selected === tab.id)}
			<button
				aria-checked={radio ? active : undefined}
				aria-label={tab.label ? undefined : tab.title}
				aria-selected={radio ? undefined : active}
				class={[
					'group relative flex cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-lg font-medium transition-colors',
					active ? 'text-white' : 'text-white/55 hover:text-white/85',
					buttonClass,
				]}
				data-hint={tab.hint}
				in:reveal={{ y: 0 }}
				onclick={() => onselect(tab.id)}
				role={radio ? 'radio' : 'tab'}
				title={tab.title}
				type="button"
			>
				{#if item}
					{@render item(tab)}
				{:else}
					{#if tab.icon}
						<tab.icon class="size-4 shrink-0 transition-transform duration-300 max-[22rem]:hidden {active ? 'scale-110 text-(--c)' : 'group-hover:scale-110'}" />
					{/if}
					{tab.label}
				{/if}
			</button>
		{/each}
	</div>
</div>
