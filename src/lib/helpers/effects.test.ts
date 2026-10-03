import { describe, expect, test } from 'bun:test';
import { GeneratorTypes } from '#data/generators.js';
import { add, EffectTable, effectAmount, mul, sum } from '#helpers/effects.js';
import type { GameManager } from '#helpers/GameManager.svelte.js';
import type { Effect, EffectSource } from '#lib/types.js';

/** The table only hands the manager to effect readers, so a stub with the read fields is enough. */
const manager = { playerLevel: 10 } as GameManager;
const level = (m: GameManager) => m.playerLevel;
const source = (id: string, ...effects: Effect[]): EffectSource => ({ effects, id, name: id });

describe('EffectTable', () => {
	test('returns the base when no effect touches the stat', () => {
		const table = new EffectTable([source('a', mul('click', 2))]);
		expect(table.value('global', 7, manager)).toBe(7);
		expect(table.has('global')).toBe(false);
		expect(table.has('click')).toBe(true);
	});

	test('resolves (base + adds) × muls × Π(1 + per × Σsum)', () => {
		const table = new EffectTable([
			source('a', add('global', 5), mul('global', 2)),
			source('b', add('global', m => m.playerLevel), mul('global', () => 3)),
			source('c', sum('global', level, 0.1)),
		]);
		expect(table.value('global', 10, manager)).toBeCloseTo((10 + 5 + 10) * 2 * 3 * (1 + 10 * 0.1));
	});

	test('does not depend on purchase order', () => {
		const effects = [add('global', 4), mul('global', 1.5), sum('global', level, 0.02), mul('global', m => m.playerLevel / 5), add('global', 1)];
		const forward = new EffectTable(effects.map((effect, i) => source(`${i}`, effect)));
		const backward = new EffectTable(effects.toReversed().map((effect, i) => source(`${i}`, effect)));
		expect(forward.value('global', 3, manager)).toBeCloseTo(backward.value('global', 3, manager));
	});

	test('sums sharing a reader add up before multiplying, distinct readers multiply', () => {
		const shared = new EffectTable(Array.from({ length: 10 }, (_, i) => source(`${i}`, sum('global', level, 0.02))));
		expect(shared.value('global', 1, manager)).toBeCloseTo(1 + 10 * 0.2);

		const distinct = new EffectTable([source('a', sum('global', level, 0.02)), source('b', sum('global', m => m.playerLevel, 0.02))]);
		expect(distinct.value('global', 1, manager)).toBeCloseTo((1 + 10 * 0.02) ** 2);
	});

	test('keeps targeted effects apart from untargeted ones', () => {
		const table = new EffectTable([
			source('a', mul('generator', 2, GeneratorTypes.MOLECULE)),
			source('b', mul('generator', 3)),
			source('c', mul('generator', 5, GeneratorTypes.MOLECULE)),
		]);
		expect(table.value('generator', 1, manager, GeneratorTypes.MOLECULE)).toBe(10);
		expect(table.value('generator', 1, manager)).toBe(3);
		expect(table.value('generator', 1, manager, GeneratorTypes.CRYSTAL)).toBe(1);
	});

	test('lists targets in first-purchase order without the untargeted bucket', () => {
		const table = new EffectTable([
			source('a', mul('generator', 2, GeneratorTypes.CRYSTAL)),
			source('b', mul('generator', 2)),
			source('c', mul('generator', 2, GeneratorTypes.MOLECULE)),
			source('d', mul('generator', 2, GeneratorTypes.CRYSTAL)),
		]);
		expect(table.targets('generator')).toEqual([GeneratorTypes.CRYSTAL, GeneratorTypes.MOLECULE]);
		expect(table.targets('click')).toEqual([]);
	});

	test('re-reads live amounts on every call', () => {
		const live = { playerLevel: 1 } as GameManager;
		const table = new EffectTable([source('a', mul('global', m => m.playerLevel))]);
		expect(table.value('global', 2, live)).toBe(2);
		live.playerLevel = 4;
		expect(table.value('global', 2, live)).toBe(8);
	});
});

test('effectAmount reports the contribution of one effect', () => {
	expect(effectAmount(add('global', 3), manager)).toBe(3);
	expect(effectAmount(mul('global', m => m.playerLevel), manager)).toBe(10);
	expect(effectAmount(sum('global', level, 0.05), manager)).toBeCloseTo(0.5);
});
