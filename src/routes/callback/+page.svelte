<script lang="ts">
	import Atom from '#components/icons/Atom.svelte';
	import { getAuthConnection } from '#components/modals/Login.svelte';
	import Avatar from '#components/ui/Avatar.svelte';
	import { AUTH_CALLBACK_MESSAGE, supabaseAuth } from '#stores/supabaseAuth.svelte.js';
	import { Check, X } from '@lucide/svelte';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	/** Long enough to read who signed in before the game takes over. */
	const WELCOME_MS = 900;

	let error = $state<string | null>(null);
	let status = $state<'error' | 'loading' | 'success'>('loading');

	const connection = $derived(getAuthConnection(supabaseAuth.user?.app_metadata.provider));

	/** Providers send their errors in the query with the PKCE flow and in the hash with the implicit one. */
	function readProviderError() {
		const params = new URLSearchParams(window.location.search);
		const hash = new URLSearchParams(window.location.hash.slice(1));
		const code = params.get('error') ?? hash.get('error');
		if (!code) return null;
		if (code === 'access_denied') return 'The sign in was cancelled.';
		return params.get('error_description') ?? hash.get('error_description') ?? 'The provider refused the sign in.';
	}

	onMount(async () => {
		// Opened as a login popup by an embedded game: hand the callback URL to the opener, which holds the PKCE verifier, and close.
		if (window.opener && window.name === 'atom-clicker-login') {
			window.opener.postMessage({ type: AUTH_CALLBACK_MESSAGE, url: window.location.href }, window.location.origin);
			window.close();
			return;
		}

		error = readProviderError();
		if (!error) {
			await supabaseAuth.init();
			if (!supabaseAuth.isAuthenticated) error = supabaseAuth.error?.message ?? 'No account came back from the provider.';
		}
		if (error) {
			status = 'error';
			return;
		}

		status = 'success';
		setTimeout(() => goto('/', { replaceState: true }), WELCOME_MS);
	});
</script>

<main class="relative flex min-h-dvh items-center justify-center overflow-hidden px-6">
	<div
		class={[
			'pointer-events-none absolute top-1/2 left-1/2 size-80 -translate-1/2 rounded-full blur-3xl transition-colors duration-700',
			status === 'error' ? 'bg-red-500/15' : 'bg-accent-500/20',
		]}
	></div>

	<div class="relative flex w-full max-w-sm flex-col items-center text-center" role={status === 'error' ? 'alert' : 'status'}>
		<div class="relative mb-5 grid size-20 place-items-center">
			{#if status === 'success'}
				<Avatar alt={supabaseAuth.displayName ?? '?'} class="size-20 ring-2 ring-accent-400/50" src={supabaseAuth.avatarUrl} />
				<span class="absolute -right-0.5 -bottom-0.5 grid size-7 place-items-center rounded-full bg-green-500 text-white ring-4 ring-page">
					<Check aria-hidden="true" size={16} strokeWidth={3} />
				</span>
			{:else if status === 'error'}
				<span class="grid size-20 place-items-center rounded-full border border-red-400/30 bg-red-500/10 text-red-300">
					<X aria-hidden="true" size={36} />
				</span>
			{:else}
				<span class="grid size-20 place-items-center rounded-full border border-accent-400/30 bg-accent-500/10 shadow-[0_0_40px] shadow-accent-500/30">
					<Atom class="animate-[spin_4s_linear_infinite] motion-reduce:animate-none" size={44} />
				</span>
			{/if}
		</div>

		{#if status === 'success'}
			<h1 class="text-2xl font-bold text-white">Welcome, {supabaseAuth.displayName ?? 'scientist'}</h1>
			<p class="mt-1 text-sm text-white/60">
				{connection ? `Signed in with ${connection.name}, back` : 'Back'} to your atoms in a moment.
			</p>
		{:else if status === 'error'}
			<h1 class="text-2xl font-bold text-white">Not signed in</h1>
			<p class="mt-1 text-sm text-white/60">{error}</p>
			<p class="mt-1 text-sm text-balance text-white/40">Your game is safe on this device, you can try again from the leaderboard.</p>
			<button
				class="mt-6 rounded-xl bg-accent-600 px-5 py-2.5 font-semibold text-white transition-colors hover:bg-accent-500"
				onclick={() => goto('/', { replaceState: true })}
				type="button"
			>
				Back to the game
			</button>
		{:else}
			<h1 class="text-2xl font-bold text-white">Signing you in</h1>
			<p class="mt-1 text-sm text-white/60">Linking your account to Atom Clicker...</p>
		{/if}
	</div>
</main>
