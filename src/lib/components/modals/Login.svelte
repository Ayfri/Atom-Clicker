<script module lang="ts">
	import type { AuthConnection } from '#lib/types/auth.js';

	export const AUTH_CONNECTIONS: AuthConnection[] = [
		{ color: '#ffffff', icon: '/google.svg', id: 'google', name: 'Google', provider: 'google' },
		{ color: '#5865f2', icon: '/discord.svg', id: 'discord', name: 'Discord', provider: 'discord' },
		{ color: '#000000', icon: '/x.svg', id: 'x', name: 'X', provider: 'twitter' },
	];

	export function getAuthConnection(provider: string | undefined) {
		return AUTH_CONNECTIONS.find(c => c.provider === provider);
	}
</script>

<script lang="ts">
	import Atom from '#components/icons/Atom.svelte';
	import Quark from '#components/icons/Quark.svelte';
	import Modal from '#components/ui/Modal.svelte';
	import { supabaseAuth } from '#stores/supabaseAuth.svelte.js';
	import { ChevronRight, CloudUpload, LoaderCircle, Trophy } from '@lucide/svelte';
	import { PUBLIC_SUPABASE_PUBLISHABLE_KEY, PUBLIC_SUPABASE_URL } from '$app/env/public';

	interface Props {
		onClose: () => void;
	}

	let { onClose }: Props = $props();

	let error = $state<string | null>(null);
	/** Stays set while the browser leaves for the provider, an embed's login popup hands focus back when it closes. */
	let pending = $state<string | null>(null);

	async function handleLogin(connection: AuthConnection) {
		error = null;
		if (!PUBLIC_SUPABASE_URL || !PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
			error = 'Supabase configuration is missing. Please check your environment variables.';
			return;
		}
		pending = connection.id;
		try {
			await supabaseAuth.signInWithProvider(connection.provider);
		} catch (e) {
			pending = null;
			if (!(e instanceof Error)) error = 'Failed to initialize login. Please try again.';
			else if (e.message.includes('connection is not enabled') || e.message.includes('not configured'))
				error = 'Social login provider is not properly configured. Please contact the administrator.';
			else if (e.message.includes('Unauthorized')) error = 'Authentication failed. Please check the configuration.';
			else error = e.message;
		}
	}
</script>

<svelte:window onfocus={() => (pending = null)} />

<Modal dialog {onClose} title="Sign in">
	<div class="pointer-events-none absolute -top-28 left-1/2 size-56 -translate-x-1/2 rounded-full bg-accent-500/25 blur-3xl"></div>

	<div class="relative flex flex-col items-center text-center">
		<div class="mb-4 grid size-16 place-items-center rounded-full border border-accent-400/30 bg-accent-500/10 shadow-[0_0_40px] shadow-accent-500/30">
			<Atom size={36} />
		</div>
		<h2 class="text-2xl font-bold text-white">Sign in to Atom Clicker</h2>
		<p class="mt-1 text-sm text-white/60">An account keeps your progress safe and opens the online side of the game.</p>

		<ul class="my-5 grid w-full grid-cols-3 text-xs text-white/60">
			<li class="flex flex-col items-center gap-1.5"><CloudUpload aria-hidden="true" class="text-accent-300" size={20} />Cloud save</li>
			<li class="flex flex-col items-center gap-1.5"><Trophy aria-hidden="true" class="text-yellow-300" size={20} />Leaderboard</li>
			<li class="flex flex-col items-center gap-1.5"><Quark size={20} />Quarks</li>
		</ul>
	</div>

	{#if error}
		<p class="mb-3 rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-200" role="alert">{error}</p>
	{/if}

	<div class="relative flex flex-col gap-2.5">
		{#each AUTH_CONNECTIONS as connection (connection.id)}
			<button
				class="group flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-1.5 pr-4 font-semibold text-white transition-colors hover:border-white/25 hover:bg-white/10 disabled:opacity-50"
				disabled={pending !== null}
				onclick={() => handleLogin(connection)}
				type="button"
			>
				<span class="grid size-10 shrink-0 place-items-center rounded-lg border border-white/10" style:background-color={connection.color}>
					<img alt="" class="size-5" src={connection.icon} />
				</span>
				<span class="flex-1 text-left">Continue with {connection.name}</span>
				{#if pending === connection.id}
					<LoaderCircle aria-label="Redirecting" class="animate-spin text-white/60" size={18} />
				{:else}
					<ChevronRight aria-hidden="true" class="text-white/30 transition-transform group-hover:translate-x-0.5 group-hover:text-white/70" size={18} />
				{/if}
			</button>
		{/each}
	</div>

	<p class="relative mt-4 text-center text-[11px] text-balance text-white/40">No account needed to play, your save stays on this device either way.</p>
</Modal>
