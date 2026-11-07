<script lang="ts">
	import { untrack } from 'svelte';

	interface Props {
		/** Full fill time. */
		duration: number;
		/** Part of `duration` already run when the line mounts, read once so a ticking value never restarts the animation. */
		elapsed?: number;
	}

	let { duration, elapsed = 0 }: Props = $props();

	const delay = untrack(() => -elapsed);
</script>

<!-- A thin line along the top edge of its positioned parent, filled on the compositor with `scale`. -->
<span
	aria-hidden="true"
	class="fill-line pointer-events-none absolute inset-x-0 top-0 h-0.5 origin-left bg-[#8ff5ff]"
	style:animation-delay="{delay}ms"
	style:animation-duration="{duration}ms"
></span>

<style>
	.fill-line {
		animation: fill-line linear both;
	}

	@keyframes fill-line {
		from {
			scale: 0 1;
		}
	}
</style>
