<script lang="ts">
	import { tooltip } from '$stores/tooltip.svelte';
	import { innerHeight, innerWidth } from 'svelte/reactivity/window';

	let tooltipElement = $state<HTMLDivElement>();

	const sizeClasses = $derived(
		{
			lg: 'min-w-[400px] text-base',
			md: 'min-w-[300px] text-sm',
			sm: 'min-w-[200px] text-xs',
		}[tooltip.size],
	);

	const position = $derived.by(() => {
		if (!tooltip.visible || !tooltip.triggerRect || !tooltipElement) {
			return { left: 0, top: 0 };
		}

		const triggerRect = tooltip.triggerRect;
		const tooltipRect = tooltipElement.getBoundingClientRect();
		const viewportWidth = innerWidth.current ?? window.innerWidth;
		const viewportHeight = innerHeight.current ?? window.innerHeight;

		let left = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
		let top = triggerRect.top - tooltipRect.height - 8;

		switch (tooltip.position) {
			case 'bottom':
				top = triggerRect.bottom + 8;
				break;
			case 'left':
				left = triggerRect.left - tooltipRect.width - 8;
				top = triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2;
				break;
			case 'right':
				left = triggerRect.right + 8;
				top = triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2;
				break;
		}

		return {
			left: Math.max(8, Math.min(left, viewportWidth - tooltipRect.width - 8)),
			top: Math.max(8, Math.min(top, viewportHeight - tooltipRect.height - 8)),
		};
	});

	const arrowClasses = $derived(
		{
			bottom: 'bottom-full left-1/2 -translate-x-1/2 border-x-8 border-b-8 border-x-transparent border-b-accent-950',
			left: 'left-full top-1/2 -translate-y-1/2 border-y-8 border-l-8 border-y-transparent border-l-accent-950',
			right: 'right-full top-1/2 -translate-y-1/2 border-y-8 border-r-8 border-y-transparent border-r-accent-950',
			top: 'top-full left-1/2 -translate-x-1/2 border-x-8 border-t-8 border-x-transparent border-t-accent-950',
		}[tooltip.position],
	);

	function handleGlobalClick(event: MouseEvent) {
		if (!tooltipElement) return;
		// If click is outside the tooltip, hide it
		if (!tooltipElement.contains(event.target as Node)) {
			tooltip.hide();
		}
	}
</script>

<svelte:window onpointerdown={handleGlobalClick} />

{#if tooltip.visible && tooltip.content}
	<div
		bind:this={tooltipElement}
		class="fixed z-99999 backdrop-blur-md bg-accent-950/95 border border-white/10 overflow-visible p-0 rounded-xl shadow-2xl text-white/90 {sizeClasses}"
		onmouseenter={() =>
			tooltip.show({ content: tooltip.content!, position: tooltip.position, size: tooltip.size, triggerRect: tooltip.triggerRect! })}
		onmouseleave={() => tooltip.hide()}
		role="tooltip"
		style="left: {position.left}px; top: {position.top}px;"
	>
		<div class="relative p-2.5">
			<button
				aria-label="Close"
				class="absolute -top-1 p-1.5 right-1 sm:hidden text-white/40 hover:text-white text-2xl"
				onclick={() => tooltip.hide()}
				type="button"
			>
				×
			</button>
			<div class="flex-1">
				{@render tooltip.content()}
			</div>
			<div class="absolute pointer-events-none size-0 {arrowClasses}"></div>
		</div>
	</div>
{/if}
