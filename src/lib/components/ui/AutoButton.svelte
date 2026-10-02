<script lang="ts">
	import { tooltip as tooltipStore, type TooltipPosition, type TooltipSize } from '#stores/tooltip.svelte.js';
	import type { Snippet } from 'svelte';

	interface Props {
		onClick: (e: MouseEvent) => void;
		toggled?: boolean;
		tooltipContent?: Snippet;
		tooltipPosition?: TooltipPosition;
		tooltipSize?: TooltipSize;
	}

	let { onClick, toggled = false, tooltipContent, tooltipPosition = 'top', tooltipSize = 'sm' }: Props = $props();

	let trigger = $state<HTMLButtonElement>();

	function showTooltip() {
		if (!trigger || !tooltipContent) return;
		tooltipStore.show({
			content: tooltipContent,
			position: tooltipPosition,
			size: tooltipSize,
			triggerRect: trigger.getBoundingClientRect(),
		});
	}

	function hideTooltip() {
		if (tooltipContent) tooltipStore.hide();
	}
</script>

<button
	bind:this={trigger}
	class="px-1.5 py-0.5 rounded-sm text-[0.7rem] leading-[0.9rem] font-medium transition-colors duration-200 {toggled ? 'bg-blue-500/20 hover:bg-blue-500/30 text-blue-300' : 'bg-red-500/20 hover:bg-red-500/30 text-red-300'}"
	onclick={onClick}
	onmouseenter={showTooltip}
	onmouseleave={hideTooltip}
>
	Auto
</button>
