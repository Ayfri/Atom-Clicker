<script lang="ts">
	import type { Orbit } from '@lucide/svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	interface Props extends HTMLButtonAttributes {
		active?: boolean;
		badge?: number;
		icon: typeof Orbit;
		label: string;
		labelled?: 'always' | 'md';
	}

	let { active = false, badge = 0, class: className, icon: Icon, label, labelled, ...rest }: Props = $props();
</script>

<button
	class={[
		'relative flex h-11 min-w-11 items-center justify-center gap-2 rounded-lg text-xs font-semibold ring-1 transition-colors disabled:cursor-not-allowed disabled:opacity-40 md:h-10 md:min-w-10',
		!labelled && 'w-11 md:w-10',
		labelled === 'md' && 'px-3 max-md:w-11 max-md:px-0',
		labelled === 'always' && 'px-3',
		active ? 'bg-accent-600 text-white ring-accent-400/60' : 'bg-accent-900/80 text-accent-300 ring-accent-500/30 enabled:hover:bg-accent-800',
		className,
	]}
	aria-label={label}
	type="button"
	{...rest}
>
	<Icon size={18} />
	{#if labelled}
		<span class={labelled === 'md' ? 'max-md:hidden' : undefined}>{label}</span>
	{/if}
	{#if badge > 0}
		<span class="absolute -top-1.5 -right-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-amber-300 px-1 text-[10px] font-black text-cosmos-sky">{badge}</span>
	{/if}
</button>
