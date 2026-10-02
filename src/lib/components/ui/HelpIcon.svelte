<script lang="ts">
	import Tooltip from '#components/ui/Tooltip.svelte';
	import { type TooltipPosition, type TooltipSize } from '#stores/tooltip.svelte.js';
	import { CircleHelp } from '@lucide/svelte';
	import type { Snippet } from 'svelte';

	interface Props {
		class?: string;
		content: Snippet;
		position?: TooltipPosition;
		size?: TooltipSize;
	}

	let { class: className = '', content, position = 'top', size = 'md' }: Props = $props();
</script>

<Tooltip {content} {position} {size} class="text-white/40 hover:text-white/80 transition-colors {className}">
	<CircleHelp aria-label="Help" size={15} />
</Tooltip>
