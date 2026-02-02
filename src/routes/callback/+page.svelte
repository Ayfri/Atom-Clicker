<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { supabaseAuth } from '$stores/supabaseAuth.svelte';

	let isLoading = $state(true);
	let error: string | null = $state(null);

	onMount(async () => {
		try {
			// Handle Supabase auth callback
			await supabaseAuth.init();

			// Wait for auth state to settle (loading becomes false)
			let retryCount = 0;
			while (supabaseAuth.loading && retryCount < 50) {
				await new Promise(resolve => setTimeout(resolve, 100));
				retryCount++;
			}

			goto('/');
		} catch (err: unknown) {
			console.error('Authentication callback error:', err);
			error = err instanceof Error ? err.message : 'Unknown error';
		} finally {
			isLoading = false;
		}
	});
</script>

<div class="flex min-h-screen items-center justify-center bg-gray-900">
	<div class="rounded-lg bg-gray-800 p-8 text-center shadow-xl">
		{#if isLoading}
			<div class="mb-4">
				<div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
			</div>
			<h2 class="text-xl font-semibold text-white mb-2">Completing sign in...</h2>
			<p class="text-gray-400">Please wait while we redirect you.</p>
		{:else if error}
			<div class="mb-4">
				<div class="rounded-full bg-red-100 p-3 mx-auto w-16 h-16 flex items-center justify-center">
					<svg class="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
					</svg>
				</div>
			</div>
			<h2 class="text-xl font-semibold text-white mb-2">Authentication failed</h2>
			<p class="text-gray-400 mb-4">{error}</p>
			<button
				class="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
				onclick={() => goto('/')}
			>
				Return home
			</button>
		{:else}
			<div class="mb-4">
				<div class="rounded-full bg-green-100 p-3 mx-auto w-16 h-16 flex items-center justify-center">
					<svg class="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
					</svg>
				</div>
			</div>
			<h2 class="text-xl font-semibold text-white mb-2">Sign in successful!</h2>
			<p class="text-gray-400">Redirecting...</p>
		{/if}
	</div>
</div>
