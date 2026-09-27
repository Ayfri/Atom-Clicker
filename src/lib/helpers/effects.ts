import { GENERATORS, type GeneratorType } from '$data/generators';
import type { GameManager } from '$helpers/GameManager.svelte';
import type { Effect, EffectAmount, EffectSource, EffectStat } from '$lib/types';
import { capitalize, formatNumber } from '$lib/utils';

type Reader = (manager: GameManager) => number;

export const add = (stat: EffectStat, amount: EffectAmount, target?: GeneratorType): Effect => ({ amount, kind: 'add', stat, target });

export const mul = (stat: EffectStat, amount: EffectAmount, target?: GeneratorType): Effect => ({ amount, kind: 'mul', stat, target });

/**
 * Effects sharing the same `per` reference add up before multiplying, so keep `per` in a shared constant.
 * @example ten `sum('global', playerLevel, 0.02)` give `× (1 + playerLevel × 0.2)`, not `× 1.02^10` per level
 */
export const sum = (stat: EffectStat, per: Reader, amount: number): Effect => ({ amount, kind: 'sum', per, stat });

class Bucket {
	add = 0;
	dynamicAdds: Reader[] = [];
	dynamicMuls: Reader[] = [];
	groups = new Map<Reader, number>();
	mul = 1;

	push(effect: Effect) {
		if (effect.kind === 'sum') this.groups.set(effect.per, (this.groups.get(effect.per) ?? 0) + effect.amount);
		else if (typeof effect.amount === 'function') (effect.kind === 'add' ? this.dynamicAdds : this.dynamicMuls).push(effect.amount);
		else if (effect.kind === 'add') this.add += effect.amount;
		else this.mul *= effect.amount;
	}

	value(base: number, manager: GameManager): number {
		let value = base + this.add;
		for (const read of this.dynamicAdds) value += read(manager);
		value *= this.mul;
		for (const read of this.dynamicMuls) value *= read(manager);
		for (const [per, amount] of this.groups) value *= 1 + per(manager) * amount;
		return value;
	}
}

/** Constant amounts are folded once when the table is built, so reading a stat only calls the effects that depend on live game state. */
export class EffectTable {
	private readonly buckets = new Map<EffectStat, Map<GeneratorType | undefined, Bucket>>();

	constructor(sources: readonly EffectSource[]) {
		for (const { effects } of sources) {
			for (const effect of effects) {
				let byTarget = this.buckets.get(effect.stat);
				if (!byTarget) this.buckets.set(effect.stat, (byTarget = new Map()));
				const target = effect.kind === 'sum' ? undefined : effect.target;
				let bucket = byTarget.get(target);
				if (!bucket) byTarget.set(target, (bucket = new Bucket()));
				bucket.push(effect);
			}
		}
	}

	has(stat: EffectStat): boolean {
		return this.buckets.has(stat);
	}

	/** Targets of `stat` in the order their first effect was bought. */
	targets(stat: EffectStat): GeneratorType[] {
		return [...(this.buckets.get(stat)?.keys() ?? [])].filter((target): target is GeneratorType => target !== undefined);
	}

	value(stat: EffectStat, base: number, manager: GameManager, target?: GeneratorType): number {
		return this.buckets.get(stat)?.get(target)?.value(base, manager) ?? base;
	}
}

export function effectAmount(effect: Effect, manager: GameManager): number {
	if (effect.kind === 'sum') return effect.per(manager) * effect.amount;
	return typeof effect.amount === 'number' ? effect.amount : effect.amount(manager);
}

/** Player-facing value of one effect: `×1.5`, `+10` or `+12%`. */
export function formatEffect(effect: Effect, manager: GameManager): string {
	const amount = effectAmount(effect, manager);
	if (effect.kind === 'mul') return `×${formatNumber(amount)}`;
	const sign = amount >= 0 ? '+' : '';
	return effect.kind === 'sum' ? `${sign}${formatNumber(amount * 100)}%` : `${sign}${formatNumber(amount)}`;
}

export function effectLabel(effect: Effect): string {
	if (effect.kind !== 'sum' && effect.target) return `${GENERATORS[effect.target].name} production`;
	return capitalize(effect.stat.replaceAll('_', ' '));
}

/** Every owned effect on `stat` next to the name of the upgrade granting it, for the gain breakdown tooltips. */
export function effectBreakdown(sources: readonly EffectSource[], stat: EffectStat, manager: GameManager): { name: string; value: string }[] {
	return sources.flatMap(source =>
		source.effects.filter(effect => effect.stat === stat).map(effect => ({ name: source.name, value: formatEffect(effect, manager) })),
	);
}
