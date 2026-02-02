<script module lang="ts">
	import type {AuthConnection} from '$lib/types/auth';

	export const AUTH_CONNECTIONS: AuthConnection[] = [
		{
			backgroundColor: 'bg-white',
			hoverBackgroundColor: 'hover:bg-gray-200',
			icon: '/google.svg',
			id: 'google',
			name: 'Google',
			provider: 'google',
			textColor: 'text-gray-800',
		},
		{
			backgroundColor: 'bg-[#5865F2]',
			hoverBackgroundColor: 'hover:bg-[#4752C4]',
			icon: '/discord.svg',
			id: 'discord',
			name: 'Discord',
			provider: 'discord',
			textColor: 'text-white',
		},
		{
			backgroundColor: 'bg-black',
			hoverBackgroundColor: 'hover:bg-accent-950',
			icon: '/x.svg',
			id: 'x',
			name: 'X',
			provider: 'twitter',
			textColor: 'text-white',
		},
	];

	export function getAuthConnection(provider: string | undefined) {
		return AUTH_CONNECTIONS.find(c => c.provider === provider);
	}
</script>

<script lang="ts">
	import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY } from '$env/static/public';
	import {supabaseAuth} from '$stores/supabaseAuth.svelte';
	import Modal from '@components/ui/Modal.svelte';

	interface Props {
		onClose: () => void;
	}

	let { onClose }: Props = $props();

	let error: string | null = $state(null);


	async function handleLogin(connection: AuthConnection) {
		error = null;
		try {
			if (!PUBLIC_SUPABASE_URL || !PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
				error = 'Supabase configuration is missing. Please check your environment variables.';
				return;
			}

			await supabaseAuth.signInWithProvider(connection.provider);
		} catch (e) {
			if (e instanceof Error) {
				if (e.message.includes('connection is not enabled') || e.message.includes('not configured')) {
					error = 'Social login provider is not properly configured. Please contact the administrator.';
				} else if (e.message.includes('Unauthorized')) {
					error = 'Authentication failed. Please check the configuration.';
				} else {
					error = e.message;
				}
			} else {
				error = 'Failed to initialize login. Please try again.';
			}
		}
	}
</script>

<Modal {onClose} title="Choose how to connect" width="sm">
	{#if error}
		<div class="mb-4 rounded-lg bg-red-500/20 p-4 text-red-200">
			{error}
		</div>
	{/if}

	<div class="flex flex-col gap-4">
		{#each AUTH_CONNECTIONS as connection (connection.id)}
			<button
				onclick={() => handleLogin(connection)}
				class="flex items-center justify-center gap-2 rounded-lg px-6 py-3 font-semibold transition-colors duration-200
				{connection.backgroundColor} {connection.hoverBackgroundColor} {connection.textColor}"
			>
				<img src={connection.icon} alt={connection.name} class="h-6 w-6"/>
				Continue with {connection.name}
			</button>
		{/each}
	</div>
</Modal>
