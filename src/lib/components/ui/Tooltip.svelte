<script lang="ts">
	import { tooltip, type TooltipPosition, type TooltipSize } from '#stores/tooltip.svelte.js';
	import type { Snippet } from 'svelte';

	interface Props {
		children: Snippet;
		class?: string;
		content: Snippet;
		position?: TooltipPosition;
		size?: TooltipSize;
	}

	let { children, class: className = '', content, position = 'top', size = 'md' }: Props = $props();

	let trigger = $state<HTMLElement>();

	function show() {
		if (!trigger) return;
		tooltip.show({
			content,
			position,
			size,
			triggerRect: trigger.getBoundingClientRect(),
		});
	}

	function hide() {
		tooltip.hide();
	}

	function toggle() {
		if (tooltip.visible) {
			hide();
		} else {
			show();
		}
	}
</script>

<div
	class="inline-block relative {className}"
	onmouseenter={show}
	onmouseleave={hide}
	role="none"
>
	<button
		bind:this={trigger}
		class="cursor-help"
		onblur={hide}
		onclick={e => {
			e.stopPropagation();
			toggle();
		}}
		onfocus={e => e.currentTarget.matches(':focus-visible') && show()}
		type="button"
	>
		{@render children()}
	</button>
</div>
