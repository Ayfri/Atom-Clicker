<script lang="ts">
	import Discord from '@components/icons/Discord.svelte';
	import GitHub from '@components/icons/GitHub.svelte';
	import { Coffee } from 'lucide-svelte';
	import { gameManager } from '$helpers/GameManager.svelte';

	function handleWebsiteClick() {
		if (!gameManager.achievements.includes('website_click')) {
			gameManager.unlockAchievement('website_click');
		}
	}

	function handleCoffeeClick() {
		if (!gameManager.achievements.includes('coffee_click')) {
			gameManager.unlockAchievement('coffee_click');
		}
	}

	function handleDiscordClick() {
		if (!gameManager.achievements.includes('discord_click')) {
			gameManager.unlockAchievement('discord_click');
		}
	}

	function handleGitHubClick() {
		if (!gameManager.achievements.includes('github_click')) {
			gameManager.unlockAchievement('github_click');
		}
	}
</script>

<footer class="px-4 py-2 text-xs text-white/60">
	<div class="mx-auto max-w-4xl flex flex-col items-center gap-1.5">
		<div class="flex flex-wrap items-center justify-center gap-3">
			<a
				class="group flex items-center gap-1 transition-colors hover:text-white"
				href="https://discord.ayfri.com"
				rel="noopener noreferrer"
				target="_blank"
				title="Join our Discord community"
				onclick={handleDiscordClick}
			>
				<Discord size={14} />
			</a>
			<a
				class="flex items-center gap-1 transition-colors hover:text-white"
				href="https://github.com/Ayfri/Atom-Clicker"
				rel="noopener noreferrer"
				target="_blank"
				title="View source code on GitHub"
				onclick={handleGitHubClick}
			>
				<GitHub size={14} />
			</a>
			<a
				class="transition-colors hover:text-white"
				href="https://ayfri.com"
				rel="noopener noreferrer"
				target="_blank"
				title="Visit creator's website"
				onclick={handleWebsiteClick}
			>
				ayfri.com
			</a>
			<a
				class="group flex items-center gap-1 rounded-sm bg-yellow-500 px-2 py-0.5 text-black transition-colors hover:bg-yellow-300"
				href="https://buymeacoffee.com/ayfri"
				rel="noopener noreferrer"
				target="_blank"
				title="Support the creator"
				onclick={handleCoffeeClick}
			>
				<Coffee size={12} class="fill-transparent group-hover:fill-black duration-200 transition-all" />
				<span>Buy me a coffee</span>
			</a>
		</div>
		<div class="text-white/40 text-[0.7rem]">
			Atom Clicker © {new Date().getFullYear()} • Made with ❤️ by
			<a
				href="https://ayfri.com"
				class="transition-colors hover:text-white"
				target="_blank"
				rel="noopener noreferrer"
				onclick={handleWebsiteClick}
			>
				Ayfri
			</a>
		</div>
	</div>
</footer>
