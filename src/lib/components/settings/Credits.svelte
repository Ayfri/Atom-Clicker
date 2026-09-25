<script lang="ts">
	import GitHub from '@components/icons/GitHub.svelte';
	import Discord from '@components/icons/Discord.svelte';
	import Currency from '@components/ui/Currency.svelte';
	import { CurrenciesTypes } from '$data/currencies';
	import { gameManager } from '$helpers/GameManager.svelte';
	import { SquareArrowOutUpRight } from '@lucide/svelte';
	import { fade } from 'svelte/transition';

	let isHiddenAtomFound = $derived(gameManager.achievements.includes('hidden_atom_clicked'));

	const creator = {
		name: 'Ayfri',
		url: 'https://ayfri.com',
		description: 'Visit website',
	};

	const socials = [
		{
			achievement: 'github_click',
			description: 'View source code',
			icon: GitHub,
			name: 'GitHub',
			url: 'https://github.com/Ayfri/Atom-Clicker',
		},
		{
			achievement: 'discord_click',
			description: 'Join our community',
			icon: Discord,
			name: 'Discord',
			url: 'https://discord.ayfri.com',
		},
	];

	const technologies = [
		{
			name: 'Svelte 5',
			url: 'https://svelte.dev',
		},
		{
			name: 'Tailwind CSS',
			url: 'https://tailwindcss.com',
		},
		{
			name: 'Lucide Icons',
			url: 'https://lucide.dev',
		},
		{
			name: 'Svelte Flow',
			url: 'https://svelteflow.dev',
		},
	];
</script>

<div class="flex flex-col gap-6">
	<div class="flex flex-col gap-8 md:flex-row md:gap-12">
		<div class="flex-1 flex flex-col gap-6">
			<div class="border-b border-accent/50 pb-2 flex items-center gap-2">
				<h3 class="text-lg font-bold text-accent">Created by</h3>
				{#if !isHiddenAtomFound}
					<button
						class="opacity-8 hover:opacity-50 transition-opacity duration-1000"
						onclick={() => gameManager.unlockAchievement('hidden_atom_clicked')}
						transition:fade={{ duration: 1000 }}
						aria-label="Hidden secret"
						title="?"
					>
						<Currency name={CurrenciesTypes.ATOMS} />
					</button>
				{/if}
			</div>
            <div class="flex flex-col gap-4">
                <a
                    href={creator.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="group flex flex-row items-baseline gap-2 rounded-lg bg-black/20 p-4 transition-colors hover:bg-black/30 w-full"
                    onclick={() => gameManager.unlockAchievement('website_click')}
                >
                    <span class="text-lg font-semibold text-white group-hover:text-accent">{creator.name}</span>
                    <span class="text-sm text-white/60 flex-1">{creator.description}</span>
                    <SquareArrowOutUpRight size={16} />
                </a>

                <h3 class="border-b border-accent/50 pb-2 text-lg font-bold text-accent mt-6">Links</h3>
                <div class="flex flex-col gap-4">
                    {#each socials as social}
                        <a
                            href={social.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            class="group flex items-baseline gap-2 rounded-lg bg-black/20 p-4 transition-colors hover:bg-black/30"
                            onclick={() => gameManager.unlockAchievement(social.achievement)}
                        >
                            <social.icon size={24} class="self-center mr-1" />
                            <span class="text-lg font-semibold text-white group-hover:text-accent">{social.name}</span>
                            <span class="text-sm text-white/60 flex-1">{social.description}</span>
                            <SquareArrowOutUpRight size={16} />
                        </a>
                    {/each}
                </div>
            </div>
        </div>

        <div class="flex-1 flex flex-col gap-6">
            <h3 class="border-b border-accent/50 pb-2 text-lg font-bold text-accent">Thanks to</h3>
            <div class="flex flex-col gap-4">
                {#each technologies as tech}
                    <a
                        href={tech.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        class="group flex items-baseline gap-2 rounded-lg bg-black/20 p-4 transition-colors hover:bg-black/30"
                    >
                        <span class="text-lg font-semibold text-white group-hover:text-accent">{tech.name}</span>
                        <span class="text-sm text-white/60 flex-1">Learn more</span>
                        <SquareArrowOutUpRight size={16} />
                    </a>
                {/each}
            </div>
        </div>
    </div>
</div>
