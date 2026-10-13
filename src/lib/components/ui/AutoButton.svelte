<script lang="ts">
	import { clock } from '#stores/clock.svelte.js';
	import { tooltip as tooltipStore, type TooltipPosition, type TooltipSize } from '#stores/tooltip.svelte.js';

	interface Props {
		/** What the automation does, the first line of its tooltip. */
		description: string;
		/** Period of a timed automation in ms: the tooltip shows it with a countdown to `nextFire`, in whole seconds. */
		interval?: number;
		nextFire?: number | null;
		onClick: (e: MouseEvent) => void;
		/** Live line of a continuous automation, shown while it runs. */
		status?: string | null;
		toggled?: boolean;
		tooltipPosition?: TooltipPosition;
		tooltipSize?: TooltipSize;
	}

	let { description, interval = 0, nextFire = null, onClick, status = null, toggled = false, tooltipPosition = 'top', tooltipSize = 'sm' }: Props = $props();

	let trigger = $state<HTMLButtonElement>();

	function showTooltip() {
		if (!trigger) return;
		tooltipStore.show({
			content,
			position: tooltipPosition,
			size: tooltipSize,
			triggerRect: trigger.getBoundingClientRect(),
		});
	}
</script>

{#snippet content()}
	<div class="flex flex-col gap-1">
		<p class="text-xs text-white/80">{description}</p>
		{#if toggled && interval > 0}
			<p class="text-xs text-white/60">
				Checks every {+(interval / 1000).toFixed(1)}s
				{#if nextFire}
					- next in {Math.max(0, Math.ceil((nextFire - clock.now) / 1000))}s
				{/if}
			</p>
		{:else if toggled && status}
			<p class="text-xs text-white/60">{status}</p>
		{/if}
	</div>
{/snippet}

<button
	bind:this={trigger}
	aria-pressed={toggled}
	class="px-1.5 py-0.5 rounded-sm text-[0.7rem] leading-[0.9rem] font-medium transition-colors duration-200 {toggled ? 'bg-blue-500/20 hover:bg-blue-500/30 text-blue-300' : 'bg-red-500/20 hover:bg-red-500/30 text-red-300'}"
	onblur={() => tooltipStore.hide()}
	onclick={onClick}
	onfocus={showTooltip}
	onmouseenter={showTooltip}
	onmouseleave={() => tooltipStore.hide()}
>
	Auto
</button>
