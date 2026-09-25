<script lang="ts">
	import { browser } from '$app/environment';
	import { GA_ID, privacy } from '$stores/privacy.svelte';

	const beacon = { token: 'e8f7ea160f464f118b12dc2a395614d5' };
	let loaded = false;

	$effect(() => {
		if (!privacy.analytics || loaded) return;
		loaded = true;
		window.dataLayer = window.dataLayer || [];
		window.gtag = function () {
			/** gtag.js only recognizes the `arguments` object, not a spread array. */
			window.dataLayer.push(arguments);
		};
		window.gtag('js', new Date());
		window.gtag('config', GA_ID);
	});
</script>

{#if browser}
	<!-- Cloudflare Web Analytics -->
	<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon={JSON.stringify(beacon)}>
	</script>
	<!-- End Cloudflare Web Analytics -->

	{#if privacy.analytics}
		<!-- Google tag (gtag.js) -->
		<script async src="https://www.googletagmanager.com/gtag/js?id={GA_ID}"></script>
	{/if}
{/if}
