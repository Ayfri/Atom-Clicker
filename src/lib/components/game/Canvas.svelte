<script lang="ts">
	import { particlesEnabled } from '#helpers/CanvasLoop.js';
	import { ClickParticles } from '#helpers/particles.js';
	import { ui } from '#stores/ui.svelte.js';

	$effect(() => {
		if (!particlesEnabled) return;
		const canvas = document.createElement('canvas');
		/**
		 * Appended to the body, out of the transformed realms, and sized by CSS: a pixel width taken from innerWidth in landscape
		 * kept the page that wide after rotating back, phones then zoomed out to fit it and innerWidth never shrank again.
		 */
		canvas.style.cssText = 'height: 100%; inset: 0; position: fixed; width: 100%;';
		document.body.appendChild(canvas);
		const field = new ClickParticles(canvas);
		$effect(() => field.setActive(!ui.covered));
		return () => {
			field.destroy();
			canvas.remove();
		};
	});
</script>
