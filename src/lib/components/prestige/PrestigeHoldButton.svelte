<script lang="ts">
	import HoldButton from '#components/ui/HoldButton.svelte';

	interface Props {
		disabled: boolean;
		/** Seconds for the gradient to drift from one end to the other. */
		drift: number;
		/** Background of the button, drawn on a layer the compositor slides, a drifting `background-position` would repaint it. */
		gradient: string;
		label: string;
		onHoldComplete: () => void;
		/** The `--hold-*` variables of the progress fill. */
		style: string;
	}

	let { disabled, drift, gradient, label, onHoldComplete, style }: Props = $props();
</script>

<HoldButton
	class="isolate w-full rounded-lg py-4 text-lg font-bold uppercase tracking-wide text-white [text-shadow:0_1px_3px_rgb(0_0_0/0.6)] hover:enabled:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
	{disabled}
	{onHoldComplete}
	{style}
>
	<span
		class="pointer-events-none absolute inset-y-0 left-0 -z-10 w-[200%] {disabled ? '' : 'drift'}"
		style:animation-duration="{drift}s"
		style:background-image={gradient}
	></span>
	<span class="relative z-10">{label}</span>
</HoldButton>

<style>
	.drift {
		animation: drift ease-in-out infinite alternate;
	}

	@keyframes drift {
		to {
			transform: translateX(-50%);
		}
	}
</style>
