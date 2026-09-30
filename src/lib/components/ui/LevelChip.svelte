<script lang="ts">
	import { formatNumber } from '$lib/utils';

	interface Props {
		class?: string;
		level: number;
	}

	let { class: className = '', level }: Props = $props();
</script>

<span
	class="inline-flex shrink-0 items-center gap-1 bg-accent-500/30 px-2 py-px text-[11px] leading-4 font-bold text-accent-100 tabular-nums [clip-path:polygon(6px_0,calc(100%_-_6px)_0,100%_50%,calc(100%_-_6px)_100%,6px_100%,0_50%)] {className}"
	title="Level {level}"
>
	<span class="text-accent-300">Lv</span>{formatNumber(level, 0)}
</span>
