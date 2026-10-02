<script lang="ts">
	import Discord from '#components/icons/Discord.svelte';
	import GitHub from '#components/icons/GitHub.svelte';
	import { gameManager } from '#helpers/GameManager.svelte.js';
	import { Coffee } from '@lucide/svelte';
</script>

<footer class="px-4 py-2 text-xs text-white/60">
	<div class="mx-auto max-w-4xl flex flex-col items-center gap-1.5">
		<div class="flex flex-wrap items-center justify-center gap-3">
			<a
				aria-label="Discord"
				class="flex items-center gap-1 transition-colors hover:text-white"
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
				class="flex items-center gap-1 transition-colors hover:text-white"
				href="https://github.com/Ayfri/Atom-Clicker"
				onclick={() => gameManager.unlockAchievement('github_click')}
				rel="noopener noreferrer"
				target="_blank"
				title="View source code on GitHub"
			>
				<GitHub size={14} />
			</a>
			<a
				class="transition-colors hover:text-white"
				href="https://ayfri.com"
				onclick={() => gameManager.unlockAchievement('website_click')}
				rel="noopener noreferrer"
				target="_blank"
				title="Visit creator's website"
			>
				ayfri.com
			</a>
			<a
				class="group flex items-center gap-1 rounded-sm bg-yellow-500 px-2 py-0.5 text-black transition-colors hover:bg-yellow-300"
				href="https://buymeacoffee.com/ayfri"
				onclick={() => gameManager.unlockAchievement('coffee_click')}
				rel="noopener noreferrer"
				target="_blank"
				title="Support the creator"
			>
				<Coffee aria-hidden="true" class="fill-transparent transition-all duration-200 group-hover:fill-black" size={12} />
				<span>Buy me a coffee</span>
			</a>
		</div>
		<div class="text-white/40 text-[0.7rem]">
			Atom Clicker © {new Date().getFullYear()} • Made with ❤️ by
			<a
				class="transition-colors hover:text-white"
				href="https://ayfri.com"
				onclick={() => gameManager.unlockAchievement('website_click')}
				rel="noopener noreferrer"
				target="_blank"
			>
				Ayfri
			</a>
		</div>
	</div>
</footer>
