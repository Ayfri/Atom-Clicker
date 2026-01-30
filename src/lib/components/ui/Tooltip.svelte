<script lang="ts">
	import type { Snippet } from 'svelte';
	import { innerHeight, innerWidth } from 'svelte/reactivity/window';

	interface Props {
		children: Snippet;
		class?: string;
		content: Snippet;
		position?: 'bottom' | 'left' | 'right' | 'top';
		size?: 'lg' | 'md' | 'sm';
	}

	let {
		children,
		class: className = '',
		content,
		position = 'top',
		size = 'md'
	}: Props = $props();

	const tooltipId = `tt-${Math.random().toString(36).slice(2, 7)}`;
	let isVisible = $state(false);
	let tooltipElement = $state<HTMLDivElement>();
	let trigger = $state<HTMLElement>();

	const hasPopover = $derived.by(() => {
		if (import.meta.env.SSR) return true;
		return typeof HTMLElement !== 'undefined' && 'showPopover' in HTMLElement.prototype;
	});

	function syncPosition() {
		if (!trigger || !tooltipElement) return;

		const triggerRect = trigger.getBoundingClientRect();
		const tooltipRect = tooltipElement.getBoundingClientRect();

		let left = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
		let top = triggerRect.top - tooltipRect.height - 8;

		switch (position) {
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

		const viewportWidth = innerWidth.current ?? window.innerWidth;
		const viewportHeight = innerHeight.current ?? window.innerHeight;

		tooltipElement.style.left = `${Math.max(8, Math.min(left, viewportWidth - tooltipRect.width - 8))}px`;
		tooltipElement.style.top = `${Math.max(8, Math.min(top, viewportHeight - tooltipRect.height - 8))}px`;
		tooltipElement.style.visibility = 'visible';
	}

	function toggle(show: boolean) {
		if (!tooltipElement) return;
		isVisible = show;

		if (hasPopover) {
			if (show) {
				tooltipElement.showPopover();
				syncPosition();
			} else {
				tooltipElement.hidePopover();
			}
		} else if (show) {
			requestAnimationFrame(syncPosition);
		}
	}

	function handleToggle(event: ToggleEvent & { currentTarget: HTMLDivElement }) {
		if (event.currentTarget.matches(':popover-open')) {
			requestAnimationFrame(syncPosition);
		} else {
			if (tooltipElement) tooltipElement.style.visibility = 'hidden';
		}
	}

	const sizeClasses = $derived(({
		lg: 'min-w-[400px] text-base',
		md: 'min-w-[300px] text-sm',
		sm: 'min-w-[200px] text-xs'
	})[size]);

	const arrowClasses = $derived(({
		bottom: 'bottom-full left-1/2 -translate-x-1/2 border-x-8 border-b-8 border-x-transparent border-b-accent-950',
		left: 'left-full top-1/2 -translate-y-1/2 border-y-8 border-l-8 border-y-transparent border-l-accent-950',
		right: 'right-full top-1/2 -translate-y-1/2 border-y-8 border-r-8 border-y-transparent border-r-accent-950',
		top: 'top-full left-1/2 -translate-x-1/2 border-x-8 border-t-8 border-x-transparent border-t-accent-950'
	})[position]);
</script>

<div
	class="inline-block relative {className}"
	onmouseenter={() => toggle(true)}
	onmouseleave={() => toggle(false)}
	role="none"
>
	<button
		bind:this={trigger}
		class="cursor-help"
		onclick={(e) => {
			e.stopPropagation();
			if (hasPopover) {
				tooltipElement?.matches(':popover-open') ? toggle(false) : toggle(true);
			} else {
				toggle(!isVisible);
			}
		}}
		type="button"
	>
		{@render children()}
	</button>

	<div
		bind:this={tooltipElement}
		class="backdrop-blur-md bg-accent-950/95 border border-white/10 overflow-visible p-0 rounded-xl shadow-2xl text-white/90 {sizeClasses} {!hasPopover && !isVisible ? 'hidden' : ''} {!hasPopover ? 'fixed z-9999' : ''}"
		id={tooltipId}
		ontoggle={handleToggle}
		popover={hasPopover ? 'auto' : null}
	>
		<div class="relative p-2.5">
			<button
				aria-label="Close"
				class="absolute -top-1 p-1.5 right-1 sm:hidden text-white/40 hover:text-white text-2xl"
				onclick={() => toggle(false)}
				type="button"
			>
				×
			</button>
			<div class="flex-1">
				{@render content()}
			</div>
			<div class="absolute pointer-events-none size-0 {arrowClasses}"></div>
		</div>
	</div>
</div>
