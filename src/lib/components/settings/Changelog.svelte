<script lang="ts">
	import { gameManager } from '#helpers/GameManager.svelte.js';
	import { changelog } from '#stores/changelog.svelte.js';
	import { ChevronDown, Paintbrush, Sparkles } from '@lucide/svelte';
	import { onMount } from 'svelte';

	interface Entry {
		/** Text split on `**`, odd indices are bold. */
		parts: string[];
		theme: string | undefined;
	}

	interface Group {
		entries: Entry[];
		label: string | undefined;
	}

	interface Release {
		date: Date | undefined;
		groups: Group[];
		title: string;
	}

	/** Releases shown before the "older updates" button. */
	const SHOWN_RELEASES = 5;
	const GROUP_ICONS: Record<string, typeof Sparkles> = { New: Sparkles, Redesigned: Paintbrush };
	const dateFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
	const relativeFormat = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

	let releases = $state.raw<Release[]>([]);
	let showAll = $state(false);
	const latest = $derived(releases.find(release => release.date));

	/** Reads the `# Release`, `## Group` and `- **Theme**: text` lines of `Changelog.md`. */
	function parse(markdown: string): Release[] {
		const result: Release[] = [];
		let release: Release | undefined;
		for (const line of markdown.split('\n')) {
			if (line.startsWith('# ')) {
				const [, day, month, year] = line.match(/(\d{2})-(\d{2})-(\d{4})/) ?? [];
				release = { date: year ? new Date(+year, +month - 1, +day) : undefined, groups: [], title: line.slice(2).trim() };
				result.push(release);
			} else if (line.startsWith('## ')) release?.groups.push({ entries: [], label: line.slice(3).trim() });
			else if (line.startsWith('- ') && release) {
				if (!release.groups.length) release.groups.push({ entries: [], label: undefined });
				const [, theme, text = ''] = line.slice(2).trim().match(/^(?:\*\*(.+?)\*\*:\s*)?(.*)$/) ?? [];
				release.groups.at(-1)!.entries.push({ parts: text.split('**'), theme });
			}
		}
		return result;
	}

	function ago(date: Date): string {
		const days = Math.round((date.getTime() - Date.now()) / 86_400_000);
		if (days > -7) return relativeFormat.format(days, 'day');
		if (days > -60) return relativeFormat.format(Math.round(days / 7), 'week');
		if (days > -365) return relativeFormat.format(Math.round(days / 30), 'month');
		return relativeFormat.format(Math.round(days / 365), 'year');
	}

	onMount(async () => {
		gameManager.unlockAchievement('changelog_modal_opener');
		changelog.markSeen();
		try {
			releases = parse(await (await fetch('/Changelog.md')).text());
		} catch (error) {
			console.error('Failed to load changelog:', error);
		}
	});
</script>

<div class="mx-auto flex max-w-3xl flex-col divide-y divide-white/10">
	{#each showAll ? releases : releases.slice(0, SHOWN_RELEASES) as release (release.title)}
		<section class="flex flex-col gap-4 py-6 first:pt-0">
			<header class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
				{#if release.date}
					<h3 class="font-semibold text-white">{dateFormat.format(release.date)}</h3>
					<p class="text-xs text-white/40">{ago(release.date)}</p>
					{#if release === latest}
						<span class="rounded-full bg-accent/15 px-2 py-0.5 text-xs font-medium text-accent">Latest</span>
					{/if}
				{:else}
					<h3 class="font-semibold text-accent">{release.title}</h3>
					<p class="text-xs text-white/40">Next update</p>
				{/if}
			</header>

			<div class="flex flex-col gap-6">
				{#each release.groups as group, g (g)}
					<div class="flex flex-col gap-3">
						{#if group.label}
							{const Icon = $derived(GROUP_ICONS[group.label])}
							<p class="flex items-center gap-1.5 text-xs font-semibold tracking-wider text-white/50 uppercase">
								{#if Icon}<Icon class="text-accent" size={14} />{/if}
								{group.label}
							</p>
						{/if}
						<ul class="flex flex-col gap-3">
							{#each group.entries as entry, e (e)}
								<li class="text-sm leading-relaxed text-white/70 select-text">
									{#if entry.theme}<span class="block font-semibold text-white">{entry.theme}</span>{/if}
									{#each entry.parts as part, p (p)}{#if p % 2}<strong class="font-semibold text-white">{part}</strong>{:else}{part}{/if}{/each}
								</li>
							{/each}
						</ul>
					</div>
				{/each}
			</div>
		</section>
	{/each}

	{#if !showAll && releases.length > SHOWN_RELEASES}
		<button class="flex items-center justify-center gap-2 py-4 text-sm font-medium text-white/50 transition-colors hover:text-white" onclick={() => (showAll = true)}>
			Show {releases.length - SHOWN_RELEASES} older updates
			<ChevronDown size={16} />
		</button>
	{/if}
</div>
