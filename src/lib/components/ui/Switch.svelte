<script lang="ts">
	interface Props {
		checked: boolean;
		label: string;
		onchange?: (checked: boolean) => void;
	}

	let { checked = $bindable(), label, onchange }: Props = $props();
</script>

<button
	aria-checked={checked}
	aria-label={label}
	class="relative h-7 w-12 shrink-0 cursor-pointer rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-accent-300 {checked ? 'bg-accent' : 'bg-white/15'}"
	onclick={() => {
		checked = !checked;
		onchange?.(checked);
	}}
	role="switch"
	type="button"
>
	<span class="absolute top-1 left-1 size-5 rounded-full bg-white shadow transition-transform {checked ? 'translate-x-5' : ''}"></span>
</button>
