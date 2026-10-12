<script lang="ts">
	import { dev } from '$app/env';
	import { page } from '$app/state';
	import Atom from '#components/icons/Atom.svelte';
	import { House, RotateCw } from '@lucide/svelte';

	const crashed = $derived(page.status >= 500);
	const title = $derived(page.status === 404 ? 'Oops, nothing here' : crashed ? 'Oops, something crashed' : "Oops, that didn't work");
	const subtitle = $derived(
		page.status === 404
			? 'This page drifted off into the void.'
			: crashed
				? 'An atom split the wrong way. Your progress is saved, a reload usually fixes it.'
				: 'The game could not handle this request.'
	);
</script>

<svelte:head>
	<title>Oops - Atom Clicker</title>
</svelte:head>

<main class="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 py-12 text-center">
	<Atom
		size={72}
		class="rotate-20"
	/>
	<div class="flex max-w-xl flex-col gap-2">
		<h1 class="text-3xl font-bold">{title}</h1>
		<p class="text-slate-300">{subtitle}</p>
		<p class="text-sm text-white/40">Error {page.status} · {page.error?.message}</p>
	</div>
	<div class="flex flex-wrap justify-center gap-3">
		{#if crashed}
			<button
				class="flex cursor-pointer items-center gap-2 rounded-lg bg-accent-600 px-5 py-3 font-semibold text-white transition-colors hover:bg-accent-500"
				onclick={() => location.reload()}
			>
				<RotateCw size={18} />
				Reload
			</button>
		{/if}
		<a
			class={[
				'flex items-center gap-2 rounded-lg px-5 py-3 font-semibold text-white transition-colors',
				crashed ? 'bg-accent-800 hover:bg-accent-700' : 'bg-accent-600 hover:bg-accent-500',
			]}
			href="/"
			data-sveltekit-reload
		>
			<House size={18} />
			Back to the game
		</a>
	</div>
	{#if dev && page.error?.stack}
		<pre
			class="custom-scrollbar max-h-[50dvh] w-full max-w-5xl overflow-auto rounded-lg bg-accent-900 p-4 text-left font-mono text-xs leading-relaxed text-red-300 select-text">{page.error.stack}</pre>
	{/if}
</main>
