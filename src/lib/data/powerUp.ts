import type { Range } from '$lib/types';

export const POWER_UP_DEFAULT_INTERVAL = [180_000, 300_000] as Range;
export const POWER_UP_MIN_INTERVAL = 20_000;

export const POWER_UPS = [
	{
		duration: 30_000,
		multiplier: 1.5,
		name: 'Weak Boost',
	},
	{
		duration: 15_000,
		multiplier: 2,
		name: 'Double Flux',
	},
	{
		duration: 10_000,
		multiplier: 2.5,
		name: 'Surge',
	},
	{
		duration: 3000,
		multiplier: 6,
		name: 'Overload',
	},
	{
		duration: 1000,
		multiplier: 25,
		name: 'Critical Mass',
	},
];
