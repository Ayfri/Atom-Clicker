<script lang="ts">
	import Modal from '#components/ui/Modal.svelte';
	import { autoSave } from '#stores/autoSave.svelte.js';
	import { CloudUpload } from '@lucide/svelte';

	interface Props {
		onClose: () => void;
	}

	let { onClose }: Props = $props();

	function enable() {
		autoSave.enabled = true;
		onClose();
	}
</script>

<Modal dialog {onClose} title="Turn on cloud save?">
	<div class="pointer-events-none absolute -top-28 left-1/2 size-56 -translate-x-1/2 rounded-full bg-accent-500/25 blur-3xl"></div>

	<div class="relative flex flex-col items-center text-center">
		<div class="mb-4 grid size-16 place-items-center rounded-full border border-accent-400/30 bg-accent-500/10 shadow-[0_0_40px] shadow-accent-500/30">
			<CloudUpload aria-hidden="true" class="text-accent-300" size={32} />
		</div>
		<h2 class="text-2xl font-bold text-white">Turn on cloud save?</h2>
		<p class="mt-1 text-sm text-balance text-white/60">
			Your progress goes to your account every 30 seconds, so a cleared browser never loses it and another device can pick it up.
		</p>
	</div>

	<div class="relative mt-5 flex flex-col gap-2">
		<button class="rounded-xl bg-accent-500 px-4 py-3 font-semibold text-white transition-colors hover:bg-accent-400" onclick={enable} type="button">Turn on</button>
		<button class="rounded-xl px-4 py-3 font-semibold text-white/70 transition-colors hover:bg-white/10 hover:text-white" onclick={onClose} type="button">Not now</button>
	</div>

	<p class="relative mt-3 text-center text-[11px] text-white/40">You can change it anytime in Settings, Cloud Save.</p>
</Modal>
