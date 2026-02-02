<script lang="ts">
	import { gameManager } from '$helpers/GameManager.svelte';
	import { onDestroy, onMount } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import { Zap } from 'lucide-svelte';

	let now = $state(Date.now());
	let interval: ReturnType<typeof setInterval>;

	onMount(() => {
		interval = setInterval(() => {
			now = Date.now();
		}, 50);
	});

	onDestroy(() => {
		if (interval) clearInterval(interval);
	});
</script>

{#if gameManager.activePowerUps.length > 0}
	<div class="flex flex-col gap-2 w-72 md:w-96 pointer-events-none select-none mt-8">
		{#each gameManager.activePowerUps as powerUp (powerUp.id)}
			{@const elapsed = now - powerUp.startTime}
			{@const progress = Math.max(0, Math.min(1, elapsed / powerUp.duration))}
			{@const remaining = Math.max(0, powerUp.duration - elapsed)}

			<div
				class="bg-zinc-900/80 backdrop-blur-md border border-white/10 p-3 rounded-lg shadow-xl relative overflow-hidden group"
				in:fly={{ y: -20, duration: 300 }}
				out:fade
			>
				<!-- Progress Bar Background (Diminishing) -->
				<div
					class="absolute bottom-0 left-0 h-0.5 md:h-1 bg-accent-500 shadow-[0_0_10px_rgba(var(--accent-500),0.5)] transition-all duration-100 ease-linear"
					style="width: {(1 - progress) * 100}%"
				></div>

				<div class="flex items-center gap-3 relative z-10">
					<div class="p-1.5 bg-accent-500/10 rounded-md text-accent-400">
						<Zap size={16} />
					</div>

					<div class="flex-1 min-w-0">
						<div class="flex justify-between items-baseline mb-0.5">
							<span class="font-bold text-sm text-white truncate pr-2">Higgs Boson Bonus</span>
							<span class="text-xs text-accent-400 font-mono font-bold whitespace-nowrap">x{powerUp.multiplier}</span>
						</div>
						<div class="flex justify-between items-center text-[10px] md:text-xs text-zinc-400">
							<span class="truncate pr-2">{powerUp.description}</span>
							<span class="font-mono tabular-nums text-zinc-300">{(remaining / 1000).toFixed(1)}s</span>
						</div>
					</div>
				</div>
			</div>
		{/each}
	</div>
{/if}
