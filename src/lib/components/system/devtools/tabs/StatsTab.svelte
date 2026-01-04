<script lang="ts">
	import { BarChart3, Check, Clock, Cog, FileBox, Sparkles, X, Activity, type Icon as IconType } from 'lucide-svelte';
	import Currency from '@components/ui/Currency.svelte';
	import Tooltip from '@components/ui/Tooltip.svelte';
	import { CURRENCIES, type CurrencyName } from '$data/currencies';
	import { gameManager, type GameManager } from '$helpers/GameManager.svelte';
	import { statsConfig, NUMBER_STATS, ARRAY_STATS, type StatConfig } from '$helpers/statConstants';
	import { formatNumberFull, formatDuration } from '$lib/utils';
	import { parseAtomsValue } from '$lib/utils/number-parser';

	// Group stats by type
	const statGroups = $derived.by(() => {
		const groups: Record<string, Array<{ key: string; config: StatConfig; value: unknown; icon: any; currency?: CurrencyName }>> = {
			currencies: [],
			prestige: [],
			totals: [],
			system: [],
			other: []
		};

		// Add Currencies
		Object.values(CURRENCIES).forEach(currency => {
			groups.currencies.push({
				key: currency.name,
				config: { defaultValue: 0, layer: currency.layer ?? 0, minVersion: 0 },
				value: gameManager.currencies[currency.name].amount,
				icon: undefined,
				currency: currency.name
			});
			groups.currencies.push({
				key: `${currency.name}:earnedRun`,
				config: { defaultValue: 0, layer: currency.layer ?? 0, minVersion: 0 },
				value: gameManager.currencies[currency.name].earnedRun,
				icon: undefined,
				currency: currency.name
			});
			groups.currencies.push({
				key: `${currency.name}:earnedAllTime`,
				config: { defaultValue: 0, layer: currency.layer ?? 0, minVersion: 0 },
				value: gameManager.currencies[currency.name].earnedAllTime,
				icon: undefined,
				currency: currency.name
			});
		});

		Object.entries(statsConfig).forEach(([key, config]) => {
			const value = gameManager[key as keyof GameManager];

			let icon: any = FileBox;

			if (key.startsWith('total')) {
				icon = BarChart3;
			} else if (key === 'realms' || key.includes('Realm') || key.includes('protonise') || key.includes('electronize')) {
				icon = Sparkles;
			} else if (['lastSave', 'startDate', 'inGameTime'].includes(key)) {
				icon = Clock;
			} else if (key === 'settings') {
				icon = Cog;
			}

			const stat = { key, config, value, icon, currency: undefined };

			if (key.startsWith('total')) {
				groups.totals.push(stat);
			} else if (['realms', 'protoniseProtonsGain', 'electronizeElectronsGain'].includes(key)) {
				groups.prestige.push(stat);
			} else if (['lastSave', 'startDate', 'inGameTime', 'settings'].includes(key)) {
				groups.system.push(stat);
			} else {
				groups.other.push(stat);
			}
		});

		return groups;
	});

	function updateStat(key: string, value: unknown) {
		try {
			// Check if key is a currency
			const currency = Object.values(CURRENCIES).find(c => c.name === key);
			if (currency) {
				const num = typeof value === 'string' ? parseFloat(value) : (value as number);
				const val = isNaN(num) ? 0 : num;
				gameManager.currencies[currency.name].amount = val;
				return;
			}

			if (key.includes(':')) {
				const [currencyName, field] = key.split(':');
				const cName = currencyName as CurrencyName;
				if (gameManager.currencies[cName] && ['earnedRun', 'earnedAllTime'].includes(field)) {
					const num = typeof value === 'string' ? parseFloat(value) : (value as number);
					const val = isNaN(num) ? 0 : num;
					// @ts-ignore
					gameManager.currencies[cName][field] = val;
				}
				return;
			}

			const manager = gameManager as unknown as Record<string, unknown>;
			const currentValue = manager[key];
			if (NUMBER_STATS.includes(key as any)) {
				const num = typeof value === 'string' ? parseFloat(value) : (value as number);
				manager[key] = isNaN(num) ? 0 : num;
			} else if (ARRAY_STATS.includes(key as any) || (typeof currentValue === 'object' && currentValue !== null)) {
				if (typeof value === 'string') {
					try {
						manager[key] = JSON.parse(value);
					} catch (e) {
						console.error('Failed to parse JSON for', key, ':', e);
					}
				} else {
					manager[key] = value;
				}
			} else {
				manager[key] = value;
			}
		} catch (e) {
			console.error('Failed to update stat:', e);
		}
	}

	// Stat Item State Management (for snippets)
	let editingKey = $state<string | null>(null);
	let localValue = $state<string>('');

	function startEditing(key: string, value: unknown) {
		editingKey = key;
		localValue = String(value);
	}

	function saveEdit(key: string) {
		updateStat(key, localValue);
		editingKey = null;
	}

	function cancelEdit() {
		editingKey = null;
	}

	const timeRequired = $derived((600_000 * gameManager.stabilityCapacity) / gameManager.stabilitySpeed);
	const maxBoost = $derived(1 + ((gameManager.stabilityMaxBoost - 1) * gameManager.stabilityCapacity));
	const formattedTime = $derived(formatDuration(timeRequired));

	const currentProgress = $derived.by(() => {
		gameManager.inGameTime; // trigger reactivity
		const elapsed = Date.now() - gameManager.lastInteractionTime;
		return Math.min(Math.max(elapsed / timeRequired, 0), 1);
	});
</script>

{#snippet statItem(key: string, value: unknown, icon: any, currency?: CurrencyName)}
	{@const liveValue = key.includes(':')
		? gameManager.currencies[key.split(':')[0] as CurrencyName][key.split(':')[1] as 'earnedRun' | 'earnedAllTime']
		: currency
			? gameManager.currencies[currency].amount
			: (gameManager as any)[key]}
	<div class="flex flex-col gap-1 p-1 rounded-lg hover:bg-white/5 transition-colors group">
		<div class="flex items-center justify-between px-1">
			<div class="flex items-center gap-1.5 min-w-0">
				{#if currency}
					<Currency name={currency} size={12} />
				{:else if icon}
					{@const Icon = icon}
					<Icon size={12} class="text-accent-400/50" />
				{/if}
				<div class="text-[11px] text-accent-200/50 font-semibold truncate" title={key}>{key}</div>
			</div>
			{#if Array.isArray(value) || (typeof value === 'object' && value !== null)}
				<div class="text-[10px] text-white/20 italic uppercase tracking-tighter shrink-0">
					{Array.isArray(value) ? 'Array' : 'Object'}
				</div>
			{/if}
		</div>

		<div class="relative">
			{#if typeof value === 'boolean'}
				<div class="flex items-center justify-between h-9 px-2 bg-black/20 rounded-lg border border-white/5">
					<span class={value ? "text-green-400 text-sm" : "text-red-400 text-sm"}>{value ? 'True' : 'False'}</span>
					<input
						type="checkbox"
						checked={value}
						onchange={(e) => updateStat(key, e.currentTarget.checked)}
						class="w-4 h-4 rounded border-white/10 bg-black/20 text-accent-500 focus:ring-accent-500/50 cursor-pointer"
					/>
				</div>
			{:else if Array.isArray(value) || (typeof value === 'object' && value !== null)}
				{@const isEditing = editingKey === key}
				<div class="flex flex-col gap-1.5">
					<div class="relative group/json">
						{#if isEditing}
							<textarea
								value={localValue as string}
								oninput={(e) => localValue = e.currentTarget.value}
								onkeydown={(e) => {
									if (e.key === 'Enter' && e.ctrlKey) saveEdit(key);
									else if (e.key === 'Escape') cancelEdit();
								}}
								class="w-full bg-black/40 rounded-lg px-3 py-2 text-[10px] border border-accent-500/50 focus:outline-none transition-colors text-accent-300 font-mono min-h-30 resize-y shadow-inner"
							></textarea>
							<div class="absolute top-2 right-2 flex gap-1">
								<button class="p-1 bg-green-500/20 hover:bg-green-500/40 text-green-400 rounded-md transition-colors shadow-lg border border-green-500/20" onclick={() => saveEdit(key)} title="Save (Ctrl+Enter)">
									<Check size={14} />
								</button>
								<button class="p-1 bg-red-500/20 hover:bg-red-500/40 text-red-400 rounded-md transition-colors shadow-lg border border-red-500/20" onclick={cancelEdit} title="Cancel (Esc)">
									<X size={14} />
								</button>
							</div>
						{:else}
							<div
								role="button"
								tabindex="0"
								onclick={() => startEditing(key, JSON.stringify(value, null, 2))}
								onkeydown={(e) => e.key === 'Enter' && startEditing(key, JSON.stringify(value, null, 2))}
								class="w-full bg-black/20 rounded-lg px-3 py-2 text-[10px] border border-white/5 hover:border-accent-500/30 transition-colors text-accent-300/70 font-mono max-h-40 overflow-hidden cursor-pointer break-all line-clamp-6"
							>
								<span class="text-white/40 mr-1">
									{Array.isArray(value) ? `[${value.length}]` : `{${Object.keys(value).length}}`}
								</span>
								{JSON.stringify(value)}
							</div>
						{/if}
					</div>
				</div>
			{:else}
				{@const isEditing = editingKey === key}
				<div class="flex items-center gap-2 w-full">
					<div class="relative flex-1">
						{#if isEditing}
							{#if NUMBER_STATS.includes(key as any) || currency || key.includes(':')}
								<Tooltip position="bottom" size="md" class="w-full">
									{#snippet children()}
										<input
											type="text"
											bind:value={localValue}
											onkeydown={(e) => {
												if (e.key === 'Enter') saveEdit(key);
												else if (e.key === 'Escape') cancelEdit();
											}}
											class="w-full bg-black/40 rounded-lg px-3 py-2 text-sm border border-accent-500/50 focus:outline-none transition-colors text-white font-mono"
											autofocus
										/>
									{/snippet}
									{#snippet content()}
										<div class="flex flex-col gap-1 min-w-40">
											<div class="flex items-center justify-between border-b border-white/10 pb-1 mb-1">
												<span class="text-accent-400 text-[10px] uppercase tracking-widest">Live Value</span>
												<span class="text-[9px] text-white/30 font-medium px-1.5 py-0.5 bg-white/5 rounded">NUMBER</span>
											</div>
											<div class="text-sm font-mono text-accent-100 break-all">
												{typeof liveValue === 'number' ? formatNumberFull(liveValue) : liveValue}
											</div>

											<div class="flex items-center justify-between border-b border-white/10 pb-1 mb-1 mt-2">
												<span class="text-accent-400 text-[10px] uppercase tracking-widest">Parsed Input</span>
											</div>
											<div class="text-sm font-mono text-accent-300 break-all">
												{formatNumberFull(parseAtomsValue(localValue))}
											</div>

											<div class="mt-1.5 flex flex-col gap-1 text-[10px] text-white/40 font-medium italic">
												<div class="flex items-center gap-2">
													<span class="w-8 text-accent-500 not-italic font-black">ENTER</span>
													<span>to save changes</span>
												</div>
												<div class="flex items-center gap-2">
													<span class="w-8 text-red-500 not-italic font-black">ESC</span>
													<span>to discard</span>
												</div>
											</div>
										</div>
									{/snippet}
								</Tooltip>
							{:else}
								<input
									type="text"
									bind:value={localValue}
									onkeydown={(e) => {
										if (e.key === 'Enter') saveEdit(key);
										else if (e.key === 'Escape') cancelEdit();
									}}
									class="w-full bg-black/40 rounded-lg px-3 py-2 text-sm border border-accent-500/50 focus:outline-none transition-colors text-white font-mono"
									autofocus
								/>
							{/if}
						{:else}
							<input
								type="text"
								value={value}
								onfocus={() => startEditing(key, value)}
								class="w-full bg-black/20 rounded-lg px-3 py-2 text-sm border border-white/5 hover:border-accent-500/30 transition-colors text-white font-mono cursor-pointer"
								readonly
							/>
						{/if}
					</div>
					{#if isEditing}
						<div class="flex gap-1">
							<button class="p-1 hover:bg-green-500/20 text-green-400 rounded transition-colors" onclick={() => saveEdit(key)}>
								<Check size={14} />
							</button>
							<button class="p-1 hover:bg-red-500/20 text-red-400 rounded transition-colors" onclick={cancelEdit}>
								<X size={14} />
							</button>
						</div>
					{/if}
				</div>
			{/if}
		</div>
	</div>
{/snippet}

<div class="space-y-4">
	{#each Object.entries(statGroups) as [groupName, stats]}
		{#if stats.length > 0}
			{@const Icon = stats[0].icon}
			<div class="space-y-2">
				<h3 class="text-xs font-bold uppercase tracking-[0.2em] flex items-center gap-2 text-accent-300/50 px-2">
					{#if stats[0].currency}
						<Currency name={stats[0].currency} size={16} />
					{:else if stats[0].icon}
						{@const Icon = stats[0].icon}
						<Icon size={16} />
					{/if}
					{groupName}
				</h3>
				<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-2 gap-y-1 bg-white/5 rounded-xl p-1.5 border border-white/5">
					{#each stats as stat (stat.key)}
						{@render statItem(stat.key, stat.value, stat.icon, stat.currency)}
					{/each}
				</div>
			</div>
		{/if}
	{/each}

	<!-- Stability Control -->
	<div class="bg-white/5 rounded-xl p-3 border border-white/5">
		<h3 class="text-base font-bold mb-3 flex items-center gap-2 text-accent-300">
			<Activity size={18} />
			<span>Stability Control</span>
		</h3>

		<div class="space-y-4">
			<!-- Stats Grid -->
			<div class="grid grid-cols-3 gap-2 text-sm">
				<div class="bg-black/20 p-2 rounded border border-white/5">
					<div class="text-white/40 text-[10px] uppercase tracking-wider mb-0.5">Effective</div>
					<div class="font-mono text-accent-400 font-bold text-lg leading-none">x{gameManager.stabilityMultiplier.toFixed(2)}</div>
				</div>
				<div class="bg-black/20 p-2 rounded border border-white/5">
					<div class="text-white/40 text-[10px] uppercase tracking-wider mb-0.5">Potential Max</div>
					<div class="font-mono text-white/60 font-bold text-lg leading-none">x{maxBoost.toFixed(2)}</div>
				</div>
				<div class="bg-black/20 p-2 rounded border border-white/5">
					<div class="text-white/40 text-[10px] uppercase tracking-wider mb-0.5">Total Time</div>
					<div class="font-mono text-white/60 font-bold text-lg leading-none">{formattedTime}</div>
				</div>
			</div>

			<!-- Slider Control -->
			<div class="space-y-1.5">
				<div class="flex justify-between items-end text-xs">
					<span class="text-white/60">Advancement</span>
					<span class="font-mono text-accent-300 font-bold">{(currentProgress * 100).toFixed(1)}%</span>
				</div>
				<input
					type="range"
					min="0"
					max="1"
					step="0.001"
					value={currentProgress}
					class="w-full h-1.5 bg-black/40 rounded-lg appearance-none cursor-pointer accent-accent-500 hover:accent-accent-400"
					oninput={(e) => {
						const progress = parseFloat(e.currentTarget.value);
						// We need to calculate how much time equates to this progress
						const targetElapsed = progress * timeRequired;
						// Set last interaction time so that (now - last) = targetElapsed
						gameManager.lastInteractionTime = Date.now() - targetElapsed;
					}}
				/>
				<div class="flex justify-between text-[10px] text-white/30 font-mono tracking-wider">
					<span>0%</span>
					<span>50%</span>
					<span>100%</span>
				</div>
			</div>
		</div>
	</div>
</div>
