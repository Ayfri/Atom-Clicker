import type { Range } from '$lib/types';

export const POWER_UP_DEFAULT_INTERVAL = [180_000, 300_000] as Range;

export const POWER_UPS = [
	{
		duration: 30_000,
		multiplier: 1.5,
	},
	{
		duration: 15_000,
		multiplier: 2,
	},
	{
		duration: 10_000,
		multiplier: 2.5,
	},
	{
		duration: 3000,
		multiplier: 6,
	},
	{
		duration: 1000,
		multiplier: 25,
	},
];
