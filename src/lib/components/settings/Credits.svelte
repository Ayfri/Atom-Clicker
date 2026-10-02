<script lang="ts">
	import AtomIcon from '#components/icons/Atom.svelte';
	import Discord from '#components/icons/Discord.svelte';
	import GitHub from '#components/icons/GitHub.svelte';
	import { gameManager } from '#helpers/GameManager.svelte.js';
	import { Coffee, Globe, SquareArrowOutUpRight } from '@lucide/svelte';
	import { scale } from 'svelte/transition';

	const REPOSITORY = 'https://github.com/Ayfri/Atom-Clicker';

	const links = [
		{ achievement: 'github_click', description: 'Read the source code', icon: GitHub, name: 'GitHub', url: REPOSITORY },
		{ achievement: 'discord_click', description: 'Chat, report bugs, share ideas', icon: Discord, name: 'Discord', url: 'https://discord.ayfri.com' },
		{ achievement: 'website_click', description: "The creator's other projects", icon: Globe, name: 'ayfri.com', url: 'https://ayfri.com' },
		{ achievement: 'coffee_click', description: 'Support the development', icon: Coffee, name: 'Buy me a coffee', url: 'https://buymeacoffee.com/ayfri' },
	];

	const technologies = [
		{ license: 'MIT', name: 'SvelteKit & Svelte 5', role: 'App framework', url: 'https://svelte.dev' },
		{ license: 'MIT', name: 'Tailwind CSS', role: 'Styling', url: 'https://tailwindcss.com' },
		{ license: 'ISC', name: 'Lucide', role: 'Interface icons', url: 'https://lucide.dev' },
		{ license: 'MIT', name: 'Supabase', role: 'Accounts, leaderboard and cloud saves', url: 'https://supabase.com' },
		{ license: 'MIT', name: 'virtua', role: 'Leaderboard scrolling', url: 'https://github.com/inokawa/virtua' },
		{ license: 'Service', name: 'Cloudflare', role: 'Hosting', url: 'https://www.cloudflare.com' },
	];

	/** The hidden atom hops to another hiding spot on each tap, and is caught on the last one. */
	const HIDING_SPOTS = 3;
	const BURST = Array.from({ length: 10 }, (_, i) => (i / 10) * Math.PI * 2);

	let catches = $state(0);
	let burst = $state(false);
	const found = $derived(gameManager.achievements.includes('hidden_atom_clicked'));

	function catchAtom() {
		if (++catches < HIDING_SPOTS) return;
		burst = true;
		setTimeout(() => (burst = false), 800);
		gameManager.unlockAchievement('hidden_atom_clicked');
	}
</script>

{#snippet hiddenAtom(spot: number)}
	{#if (!found && catches === spot) || (burst && spot === HIDING_SPOTS - 1)}
		<span class="relative -my-3 inline-flex size-9 shrink-0 items-center justify-center align-middle">
			{#if found}
				{#each BURST as angle, i (i)}
					<span class="burst absolute top-1/2 left-1/2 size-1.5 rounded-full bg-accent" style:--dx="{Math.cos(angle) * 36}px" style:--dy="{Math.sin(angle) * 36}px"></span>
				{/each}
			{:else}
				<button aria-label="Hidden secret" class="hidden-atom flex size-9 items-center justify-center" in:scale={{ duration: 400, start: 0.3 }} onclick={catchAtom} style:--rest={0.1 + spot * 0.15} title="?">
					<AtomIcon size={18} />
				</button>
			{/if}
		</span>
	{/if}
{/snippet}

<div class="mx-auto flex max-w-3xl flex-col gap-7">
	<section class="flex items-center gap-4">
		<AtomIcon class="shrink-0 drop-shadow-[0_0_12px_var(--color-accent-400)]" size={52} />
		<div class="flex flex-col gap-1">
			<h3 class="flex items-center gap-1 text-2xl font-bold text-white">Atom Clicker {@render hiddenAtom(0)}</h3>
			<p class="text-sm text-white/60 select-text">
				A free, open-source incremental game made by
				<a class="font-semibold text-accent transition-colors hover:text-accent-300" href="https://ayfri.com" onclick={() => gameManager.unlockAchievement('website_click')} rel="noopener noreferrer" target="_blank">Ayfri</a>.
			</p>
		</div>
	</section>

	<section class="flex flex-col gap-2">
		<h4 class="text-xs font-semibold tracking-wider text-white/40 uppercase">Links</h4>
		<div class="grid gap-2 sm:grid-cols-2">
			{#each links as link (link.name)}
				<a
					class="group flex items-center gap-3 rounded-xl border border-white/10 px-3 py-2.5 transition-colors hover:bg-white/5"
					href={link.url}
					onclick={() => gameManager.unlockAchievement(link.achievement)}
					rel="noopener noreferrer"
					target="_blank"
				>
					<link.icon class="shrink-0 text-white/70 group-hover:text-white" size={22} />
					<span class="flex min-w-0 flex-1 flex-col">
						<span class="font-semibold text-white">{link.name}</span>
						<span class="truncate text-xs text-white/50">{link.description}</span>
					</span>
					<SquareArrowOutUpRight class="shrink-0 text-white/30 group-hover:text-white/60" size={14} />
				</a>
			{/each}
		</div>
	</section>

	<section class="flex flex-col gap-2">
		<h4 class="flex items-center gap-1 text-xs font-semibold tracking-wider text-white/40 uppercase">Contributors {@render hiddenAtom(1)}</h4>
		<p class="text-sm leading-relaxed text-white/70 select-text">
			Code from <span class="font-semibold text-white">ZRunner</span> and <span class="font-semibold text-white">Arslan-TR</span>, and ideas and bug reports from every player on Discord.
			<a class="text-accent transition-colors hover:text-accent-300" href="{REPOSITORY}/graphs/contributors" rel="noopener noreferrer" target="_blank">See all contributors</a>
		</p>
	</section>

	<section class="flex flex-col gap-2">
		<h4 class="text-xs font-semibold tracking-wider text-white/40 uppercase">Built with</h4>
		<ul class="flex flex-col gap-2 text-sm">
			{#each technologies as tech (tech.name)}
				<li class="grid grid-cols-[1fr_auto] items-baseline gap-x-6 sm:grid-cols-[12rem_1fr_auto]">
					<a class="font-medium text-white transition-colors hover:text-accent" href={tech.url} rel="noopener noreferrer" target="_blank">{tech.name}</a>
					<span class="text-white/50 max-sm:col-span-2 max-sm:row-start-2">{tech.role}</span>
					<span class="text-xs text-white/40">{tech.license}</span>
				</li>
			{/each}
		</ul>
	</section>

	<p class="text-center text-xs text-white/40">
		Atom Clicker is free software under the
		<a class="underline transition-colors hover:text-white" href="{REPOSITORY}/blob/main/LICENSE" rel="noopener noreferrer" target="_blank">GNU GPL v3.0</a>.
		{@render hiddenAtom(2)}
	</p>
</div>

<style>
	/* Rests nearly invisible and twinkles now and then, a little brighter at each hiding spot. */
	.hidden-atom {
		animation: twinkle 7s ease-in-out infinite;
		opacity: var(--rest);
	}

	.burst {
		animation: burst 0.8s ease-out forwards;
	}

	@keyframes twinkle {
		0%, 84%, 100% { opacity: var(--rest); }
		90% { opacity: 0.7; }
	}

	@keyframes burst {
		from { opacity: 1; transform: translate(-50%, -50%); }
		to { opacity: 0; transform: translate(calc(var(--dx) - 50%), calc(var(--dy) - 50%)) scale(0.3); }
	}

	@media (prefers-reduced-motion: reduce) {
		.hidden-atom, .burst {
			animation: none;
		}
	}
</style>
