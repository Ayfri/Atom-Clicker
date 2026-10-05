<script lang="ts">
	import Tabs from '#components/ui/Tabs.svelte';
	import Value from '#components/ui/Value.svelte';
	import { CurrenciesTypes } from '#data/currencies.js';
	import { RealmTypes } from '#data/realms.js';
	import { AmbientField } from '#helpers/AmbientField.js';
	import { currenciesManager } from '#helpers/CurrenciesManager.svelte.js';
	import { gameManager } from '#helpers/GameManager.svelte.js';
	import { radiationManager } from '#helpers/RadiationManager.svelte.js';
	import { ReactorRenderer } from '#helpers/ReactorRenderer.js';
	import { formatNumber } from '#lib/utils.js';
	import { Fuel } from '@lucide/svelte';

	const SHARES = [
		{ id: 0.1, label: '10%' },
		{ id: 0.25, label: '25%' },
		{ id: 0.5, label: '50%' },
		{ id: 1, label: 'Max' },
	] as const;

	let share = $state<number>(0.25);

	const balance = $derived(currenciesManager.getAmount(CurrenciesTypes.ELECTRONS));
	const electrons = $derived(Math.max(1, Math.floor(balance * share)));
	const addedMass = $derived(electrons * radiationManager.massPerElectron);
	const cpmGain = $derived(
		radiationManager.cpmFor(radiationManager.mass + addedMass, radiationManager.controlRodLevel) - radiationManager.currentCpm,
	);
	const affordable = $derived(balance >= electrons);

	function inject(event: MouseEvent) {
		if (!radiationManager.unlocked) radiationManager.unlock();
		gameManager.injectFuel(electrons);
		AmbientField.emit(RealmTypes.RADIATION, 'embers', event, { count: 8, surge: 6, target: ReactorRenderer.current?.center });
	}
</script>

<div class="flex w-full flex-col gap-2" data-hint="radiation-fuel">
	<div class="flex items-center justify-between gap-2">
		<span class="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">Inject</span>
		<Tabs
			accent="var(--color-radiation)"
			buttonClass="px-2 py-0.5 text-xs"
			label="Fuel share"
			onselect={id => (share = id)}
			role="radiogroup"
			selected={share}
			tabs={SHARES}
		/>
	</div>

	<button
		class="group relative flex cursor-pointer items-center gap-3 rounded-xl px-4 py-3 text-left font-bold transition-[transform,box-shadow,filter] duration-100
			disabled:cursor-not-allowed {affordable ?
			'bg-radiation text-black shadow-[0_4px_0_color-mix(in_srgb,var(--color-radiation)_40%,black),0_0_24px_color-mix(in_srgb,var(--color-radiation)_35%,transparent)] hover:brightness-110 active:translate-y-1 active:shadow-[0_0_0_transparent]'
		:	'bg-white/10 text-white/40'}"
		disabled={!affordable}
		onclick={inject}
	>
		<Fuel class="size-6 shrink-0" strokeWidth={2.5} />
		<span class="flex min-w-0 flex-1 flex-col leading-tight">
			<span class="text-base uppercase tracking-wider">Inject fuel</span>
			<span class="truncate font-mono text-xs font-semibold opacity-70">
				+{formatNumber(addedMass, 1)} u{cpmGain > 0 ? `, +${formatNumber(cpmGain, 0)} CPM` : ''}
			</span>
		</span>
		<Value class="shrink-0 font-mono text-sm" currency={CurrenciesTypes.ELECTRONS} currencyClass={affordable ? 'brightness-0' : ''} value={electrons} />
	</button>
</div>
