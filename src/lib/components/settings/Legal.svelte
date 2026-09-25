<script lang="ts">
	import SettingRow from '@components/ui/SettingRow.svelte';
	import Switch from '@components/ui/Switch.svelte';
	import { privacy } from '$stores/privacy.svelte';
	import { ChevronDown, ShieldCheck } from '@lucide/svelte';

	const sections = [
		{
			id: 'notice',
			title: 'Legal notice',
			items: [
				['Publisher', 'Pierre Roy (Ayfri), independent developer, publishing Atom Clicker as a free, non-commercial open-source project.'],
				['Contact', 'Through the Discord server (discord.ayfri.com) or a GitHub issue (github.com/Ayfri/Atom-Clicker).'],
				['Hosting', 'Cloudflare, Inc., 101 Townsend St, San Francisco, CA 94107, USA (cloudflare.com).'],
				['Accounts & database', 'Supabase, Inc. (supabase.com).'],
			],
		},
		{
			id: 'privacy',
			title: 'Privacy',
			items: [
				['Without an account', 'Your progress stays in your browser. Nothing personal leaves your device apart from the analytics and crash reports below.'],
				['With an account', 'Signing in with Google, Discord or X stores your account id, email, username, profile picture, cloud save, leaderboard stats, Quarks balance and history.'],
				['Leaderboard', 'Your username, picture, level, atoms and equipped cosmetics are public on the leaderboard.'],
				['Crash reports', 'When the game crashes, the error, page URL, browser info and a snapshot of your game state are sent to help fix the bug, linked to your account if you are signed in.'],
				['Feedback', 'The feedback form is hosted by Tally (tally.so), your email is prefilled if you are signed in.'],
				['Analytics', 'Cloudflare Web Analytics counts visits without cookies. Google Analytics measures usage with cookies and can be turned off above.'],
				['Your rights', 'Under the GDPR you can access, fix or delete your data. Ask on Discord or GitHub to delete your account, clearing your browser data deletes your local save. You can also contact the CNIL (cnil.fr).'],
			],
		},
		{
			id: 'storage',
			title: 'Cookies & storage',
			items: [
				['Local storage', 'Your save, preferences and sign-in session, needed for the game to work.'],
				['Google Analytics', 'The _ga cookies, only set while analytics are enabled.'],
				['Sign-in providers', 'Google, Discord and X may set their own cookies on their pages when you sign in.'],
			],
		},
		{
			id: 'terms',
			title: 'Terms of use',
			items: [
				['The game', 'Atom Clicker is free and provided as is. Content, balance and features can change at any time, and saves are kept on a best effort basis.'],
				['Currencies', 'Atoms, Quarks and every other in-game currency have no real-world value, cannot be bought with money and cannot be exchanged.'],
				['Fair play', 'Cheated saves, offensive usernames or abuse of the leaderboard can lead to removal from it or to account deletion.'],
			],
		},
		{
			id: 'license',
			title: 'Open source',
			items: [
				['License', 'The source code is published under the GNU GPL v3.0 on GitHub (github.com/Ayfri/Atom-Clicker).'],
				['Third parties', 'Icons and libraries keep their own licenses, see the Credits tab.'],
			],
		},
	];
</script>

<div class="mx-auto flex max-w-3xl flex-col gap-4">
	<SettingRow description="Share anonymous usage data through Google Analytics to help improve the game." icon={ShieldCheck} title="Usage analytics">
		<Switch bind:checked={privacy.analytics} label="Usage analytics" />
	</SettingRow>

	{#each sections as section, i (section.id)}
		<details class="group overflow-hidden rounded-xl border border-white/10 bg-black/20" name="legal" open={i === 0}>
			<summary class="flex cursor-pointer list-none items-center justify-between gap-4 p-4 font-semibold text-white transition-colors hover:bg-white/5 [&::-webkit-details-marker]:hidden">
				{section.title}
				<ChevronDown class="text-white/50 transition-transform duration-300 group-open:rotate-180" size={20} />
			</summary>
			<dl class="grid gap-x-6 gap-y-3 border-t border-white/10 p-4 text-sm sm:grid-cols-[10rem_1fr]">
				{#each section.items as [term, description] (term)}
					<dt class="font-medium text-accent">{term}</dt>
					<dd class="text-white/70 max-sm:mb-2">{description}</dd>
				{/each}
			</dl>
		</details>
	{/each}

	<p class="text-center text-xs text-white/40">Last updated 25-09-2026</p>
</div>

<style>
	/* `interpolate-size` lets the height animate to `auto`, `content-visibility` needs allow-discrete to stay visible while closing. */
	details {
		interpolate-size: allow-keywords;
	}

	details::details-content {
		block-size: 0;
		opacity: 0;
		transition: block-size 0.3s ease, content-visibility 0.3s allow-discrete, opacity 0.3s ease;
	}

	details[open]::details-content {
		block-size: auto;
		opacity: 1;
	}
</style>
