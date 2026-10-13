<script lang="ts">
	import type { RealmType } from '#data/realms.js';
	import { AmbientField, type Ambience } from '#helpers/AmbientField.js';
	import { particlesEnabled } from '#helpers/CanvasLoop.js';
	import { ui } from '#stores/ui.svelte.js';
	import { untrack } from 'svelte';

	interface Props {
		accent: string;
		ambience: Ambience;
		realm: RealmType;
	}

	let { accent, ambience, realm }: Props = $props();

	let field = $state.raw<AmbientField>();

	function mountField(canvas: HTMLCanvasElement) {
		if (!particlesEnabled) return;
		const instance = untrack(() => new AmbientField(canvas, realm, accent, ambience));
		field = instance;
		return () => {
			instance.destroy();
			field = undefined;
		};
	}

	$effect(() => {
		if (!field) return;
		field.accent = accent;
		field.setAmbience(ambience);
	});

	$effect(() => field?.setActive(!ui.covered));
</script>

<!-- Fixed inside the transformed realm panel, so it stays put while the realm scrolls, under everything but the realm backdrop. -->
<canvas aria-hidden="true" class="fixed inset-0 -z-50 size-full" {@attach mountField}></canvas>
