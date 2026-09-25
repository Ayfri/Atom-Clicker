<script lang="ts">
	import { ACHIEVEMENTS } from '$data/achievements';
	import { GENERATOR_COLORS, GENERATORS, GeneratorTypes, type GeneratorType } from '$data/generators';
	import { GENERATOR_ICON_NAMES, ICONS, type IconName } from '$data/icons';
	import { tierIconStack } from '$helpers/iconStacks';
	import IconStack from '@components/ui/IconStack.svelte';

	// Everything below reads from the `ICONS` registry, so a new icon shows up here just by being registered.
	const currencyIcons: { component: (typeof ICONS)[IconName]; name: string }[] = [
		{ component: ICONS.atom, name: 'Atom' },
		{ component: ICONS.electron, name: 'Electron' },
		{ component: ICONS.excitedPhoton, name: 'Excited Photon' },
		{ component: ICONS.higgsBoson, name: 'Higgs Boson' },
		{ component: ICONS.photon, name: 'Photon' },
		{ component: ICONS.proton, name: 'Proton' },
		{ component: ICONS.quark, name: 'Quark' },
	];

	const socialIcons = [
		{ component: ICONS.discord, name: 'Discord' },
		{ component: ICONS.github, name: 'GitHub' },
	];

	const generatorIconEntries = Object.entries(GENERATORS).map(([type, generator]) => ({
		component: ICONS[GENERATOR_ICON_NAMES[type as GeneratorType]],
		color: GENERATOR_COLORS[0],
		name: generator.name,
		type: type as GeneratorType,
	}));

	let iconSize = $state(48);

	// Icon stacks playground
	const ICON_NAMES = Object.keys(ICONS) as IconName[];
	const PLAYGROUND_TIERS = [1, 10, 50, 100, 200, 300, 500, 1000, 2000];

	// Rendering every achievement stack at once is a few hundred SVGs, which visibly lags the panel,
	// so the gallery only shows one page at a time.
	const ACHIEVEMENTS_PAGE_SIZE = 30;

	let stackColor = $state('#ffffff');
	let stackIcon = $state<IconName>('molecule');
	let stackLabel = $state('');
	let stackSize = $state(40);
	let achievementsShown = $state(ACHIEVEMENTS_PAGE_SIZE);
	let overrideAchievementColor = $state(false);

	const allAchievementStacks = Object.values(ACHIEVEMENTS)
		.filter(achievement => achievement.iconStack)
		.map(achievement => ({ name: achievement.name, stack: achievement.iconStack! }));
	const achievementStacks = $derived(allAchievementStacks.slice(0, achievementsShown));
</script>

<div class="flex flex-col gap-6">
	<div class="flex items-center gap-4">
		<label class="text-sm text-white/60">Icon Size:</label>
		<input
			type="range"
			min="24"
			max="128"
			bind:value={iconSize}
			class="w-48 accent-accent-500"
		/>
		<span class="text-sm font-mono text-white/80">{iconSize}px</span>
	</div>

	<section>
		<h3 class="text-lg font-bold text-white/80 mb-4 border-b border-white/10 pb-2">Icon Stacks Playground</h3>
		<div class="flex flex-wrap items-center gap-4 mb-4">
			<label class="flex items-center gap-2 text-sm text-white/60">
				Icon
				<select bind:value={stackIcon} class="rounded-md bg-white px-2 py-1 text-sm text-neutral-900 cursor-pointer">
					{#each ICON_NAMES as name (name)}
						<option value={name}>{name}</option>
					{/each}
				</select>
			</label>
			<label class="flex items-center gap-2 text-sm text-white/60">
				Color
				<input type="color" bind:value={stackColor} class="h-7 w-10 cursor-pointer rounded bg-transparent" />
			</label>
			<label class="flex items-center gap-2 text-sm text-white/60">
				Label
				<input type="text" bind:value={stackLabel} placeholder="none" class="w-24 rounded-md bg-white/10 px-2 py-1 text-sm text-white" />
			</label>
			<label class="flex items-center gap-2 text-sm text-white/60">
				Size
				<input type="range" min="16" max="128" bind:value={stackSize} class="w-40 accent-accent-500" />
				<span class="font-mono text-white/80">{stackSize}px</span>
			</label>
		</div>
		<div class="flex flex-wrap gap-4">
			{#each [1, 2, 3] as count (count)}
				<div class="flex flex-col items-center gap-2 rounded-xl bg-white/5 p-4">
					<IconStack color={stackColor} {count} icon={stackIcon} label={stackLabel || undefined} size={stackSize} />
					<span class="text-xs text-white/60">count {count}</span>
				</div>
			{/each}
		</div>
	</section>

	<section>
		<h3 class="text-lg font-bold text-white/80 mb-4 border-b border-white/10 pb-2">Tier Progression</h3>
		<div class="flex flex-wrap items-end gap-3 rounded-lg bg-white/5 p-3">
			{#each PLAYGROUND_TIERS as tier, tierIndex (tier)}
				{@const stack = tierIconStack(stackIcon, tierIndex, tier, stackColor)}
				<div class="flex flex-col items-center gap-1">
					<IconStack color={stack.color} count={stack.count} icon={stack.icon} label={stack.label} size={stackSize} />
					<span class="font-mono text-[10px] text-white/40">{tier}</span>
				</div>
			{/each}
		</div>
	</section>

	<section>
		<h3 class="text-lg font-bold text-white/80 mb-4 border-b border-white/10 pb-2">
			Achievement Stacks ({achievementStacks.length}/{allAchievementStacks.length})
		</h3>
		<label class="mb-3 flex w-fit items-center gap-2 text-sm text-white/60 cursor-pointer">
			<input type="checkbox" bind:checked={overrideAchievementColor} class="accent-accent-500 cursor-pointer" />
			Apply playground color
		</label>
		<div class="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-8 gap-2">
			{#each achievementStacks as { name, stack } (name)}
				<div class="flex flex-col items-center gap-1.5 rounded-lg bg-white/5 p-2 hover:bg-white/10 transition-colors" title={name}>
					<IconStack
						color={overrideAchievementColor ? stackColor : stack.color}
						count={stack.count}
						icon={stack.icon}
						label={stack.label}
						size={stackSize}
					/>
					<span class="w-full truncate text-center text-[10px] text-white/50">{name}</span>
				</div>
			{/each}
		</div>
		<div class="mt-3 flex gap-2">
			{#if achievementsShown < allAchievementStacks.length}
				<button
					class="rounded-md bg-white/10 px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-white/20 cursor-pointer"
					onclick={() => (achievementsShown += ACHIEVEMENTS_PAGE_SIZE)}
				>
					Show {Math.min(ACHIEVEMENTS_PAGE_SIZE, allAchievementStacks.length - achievementsShown)} more
				</button>
			{/if}
			{#if achievementsShown > ACHIEVEMENTS_PAGE_SIZE}
				<button
					class="rounded-md bg-white/10 px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-white/20 cursor-pointer"
					onclick={() => (achievementsShown = ACHIEVEMENTS_PAGE_SIZE)}
				>
					Reset
				</button>
			{/if}
		</div>
	</section>

	<section>
		<h3 class="text-lg font-bold text-white/80 mb-4 border-b border-white/10 pb-2">Generator Icons</h3>
		<div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4">
			{#each generatorIconEntries as { component: Icon, color, name }}
				<div class="flex flex-col items-center gap-2 rounded-xl bg-white/5 p-4 hover:bg-white/10 transition-colors">
					<div
						class="flex items-center justify-center"
						style="width: {iconSize}px; height: {iconSize}px;"
					>
						<Icon
							{color}
							size={iconSize}
						/>
					</div>
					<span class="text-xs text-center text-white/60 font-medium">{name}</span>
				</div>
			{/each}
		</div>
	</section>

	<section>
		<h3 class="text-lg font-bold text-white/80 mb-4 border-b border-white/10 pb-2">Currency Icons</h3>
		<div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4">
			{#each currencyIcons as { component: Icon, name }}
				<div class="flex flex-col items-center gap-2 rounded-xl bg-white/5 p-4 hover:bg-white/10 transition-colors">
					<div
						class="flex items-center justify-center"
						style="width: {iconSize}px; height: {iconSize}px;"
					>
						<Icon size={iconSize} />
					</div>
					<span class="text-xs text-center text-white/60 font-medium">{name}</span>
				</div>
			{/each}
		</div>
	</section>

	<section>
		<h3 class="text-lg font-bold text-white/80 mb-4 border-b border-white/10 pb-2">Social Icons</h3>
		<div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4">
			{#each socialIcons as { component: Icon, name }}
				<div class="flex flex-col items-center gap-2 rounded-xl bg-white/5 p-4 hover:bg-white/10 transition-colors">
					<div
						class="flex items-center justify-center"
						style="width: {iconSize}px; height: {iconSize}px;"
					>
						<Icon size={iconSize} />
					</div>
					<span class="text-xs text-center text-white/60 font-medium">{name}</span>
				</div>
			{/each}
		</div>
	</section>
</div>
