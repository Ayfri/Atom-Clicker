<script lang="ts">
	import HiggsBoson from '@components/icons/HiggsBoson.svelte';
	import { gameManager } from '$helpers/GameManager.svelte';
	import type { PowerUp } from '$lib/types';
	import { formatNumber } from '$lib/utils';
	import type { Attachment } from 'svelte/attachments';
	import { backOut } from 'svelte/easing';
	import { fly, scale } from 'svelte/transition';

	/** Matches the 0.1s precision of the countdown. */
	const TICK_MS = 100;

	let now = $state(Date.now());

	/** Cards leave on the clock, not on the expiry timer, which fires late whenever the main thread is busy. */
	const active = $derived(gameManager.activePowerUps.filter(powerUp => now < powerUp.startTime + powerUp.duration));

	$effect(() => {
		if (gameManager.activePowerUps.length === 0) return;
		now = Date.now();
		const interval = setInterval(() => (now = Date.now()), TICK_MS);
		return () => clearInterval(interval);
	});

	/** One compositor animation for the whole lifetime, a transition restarted every tick stutters as soon as a tick lands late. */
	const drain =
		(powerUp: PowerUp): Attachment<HTMLElement> =>
		node => {
			node.animate([{ transform: 'scaleX(1)' }, { transform: 'scaleX(0)' }], {
				delay: powerUp.startTime - Date.now(),
				duration: powerUp.duration,
				fill: 'forwards',
			});
		};
</script>

{#if active.length > 0}
	<div class="flex flex-col gap-2 w-72 md:w-96 pointer-events-none select-none mt-8">
		{#each active as powerUp (powerUp.id)}
			{@const remaining = Math.max(0, powerUp.startTime + powerUp.duration - now)}

			<div
				class="bg-zinc-900/80 backdrop-blur-md border border-white/10 p-3 rounded-lg shadow-xl relative overflow-hidden"
				in:fly|global={{ duration: 350, easing: backOut, y: -16 }}
				out:scale|global={{ duration: 250, start: 0.9 }}
			>
				<div
					class="absolute bottom-0 left-0 h-0.5 w-full origin-left md:h-1 bg-amber-400 shadow-[0_0_10px_rgb(251_191_36/0.6)]"
					{@attach drain(powerUp)}
				></div>

				<div class="flex items-center gap-3 relative z-10">
					<HiggsBoson class="shrink-0" size={28} />

					<div class="flex-1 min-w-0">
						<div class="flex justify-between items-baseline mb-0.5">
							<span class="font-bold text-sm text-white truncate pr-2">{powerUp.name || 'Higgs Boson'}</span>
							<span class="text-xs text-amber-300 font-mono font-bold whitespace-nowrap">×{formatNumber(powerUp.multiplier)} atoms</span>
						</div>
						<div class="flex justify-between items-center text-[10px] md:text-xs text-zinc-400">
							<span class="truncate pr-2">Higgs Boson power-up</span>
							<span class={['font-mono tabular-nums', remaining < 3000 ? 'text-amber-300' : 'text-zinc-300']}>{(remaining / 1000).toFixed(1)}s</span>
						</div>
					</div>
				</div>
			</div>
		{/each}
	</div>
{/if}
