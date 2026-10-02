<script lang="ts" module>
	const year = new Date().getFullYear();
</script>

<script lang="ts">
	import Discord from '#components/icons/Discord.svelte';
	import GitHub from '#components/icons/GitHub.svelte';
	import { gameManager } from '#helpers/GameManager.svelte.js';
	import { ui } from '#stores/ui.svelte.js';
	import { Coffee, MessageSquare } from '@lucide/svelte';
</script>

<footer class="px-4 py-3 text-xs text-white/60">
	<div class="mx-auto flex max-w-4xl flex-col items-center gap-1.5">
		<div class="flex flex-wrap items-center justify-center gap-2">
			<button
				class="flex items-center gap-1.5 rounded-sm bg-accent-500/20 px-2.5 py-1 text-accent-200 transition-colors hover:bg-accent-500/35 hover:text-white"
				onclick={() => ui.openSettings('feedback')}
				title="Report a bug or share an idea"
			>
				<MessageSquare aria-hidden="true" size={12} />
				<span>Feedback</span>
			</button>
			<a
				class="group flex items-center gap-1.5 rounded-sm bg-yellow-500 px-2.5 py-1 text-black transition-colors hover:bg-yellow-300"
				href="https://buymeacoffee.com/ayfri"
				onclick={() => gameManager.unlockAchievement('coffee_click')}
				rel="noopener noreferrer"
				target="_blank"
				title="Support the creator"
			>
				<Coffee aria-hidden="true" class="fill-transparent transition-[fill] duration-200 group-hover:fill-black" size={12} />
				<span>Buy me a coffee</span>
			</a>
		</div>
		<div class="flex flex-wrap items-center justify-center gap-x-1 text-[0.7rem] text-white/40">
			<a
				aria-label="Discord"
				class="p-1.5 text-white/60 transition-colors hover:text-white"
				href="https://discord.ayfri.com"
				onclick={() => gameManager.unlockAchievement('discord_click')}
				rel="noopener noreferrer"
				target="_blank"
				title="Join our Discord community"
			>
				<Discord size={14} />
			</a>
			<a
				aria-label="GitHub"
				class="p-1.5 text-white/60 transition-colors hover:text-white"
				href="https://github.com/Ayfri/Atom-Clicker"
				onclick={() => gameManager.unlockAchievement('github_click')}
				rel="noopener noreferrer"
				target="_blank"
				title="View source code on GitHub"
			>
				<GitHub size={14} />
			</a>
			<span class="ml-1">
				Atom Clicker © {year} • Made with ❤️ by
				<a
					class="transition-colors hover:text-white"
					href="https://ayfri.com"
					onclick={() => gameManager.unlockAchievement('website_click')}
					rel="noopener noreferrer"
					target="_blank"
					title="Visit creator's website"
				>
					Ayfri
				</a>
			</span>
		</div>
	</div>
</footer>
