import { describe, expect, test } from 'bun:test';
import { formatDuration, formatNumber, SUFFIXES } from '#lib/utils.js';

describe('formatNumber', () => {
	test('prints small numbers as integers when they are, with decimals otherwise', () => {
		expect(formatNumber(0)).toBe('0');
		expect(formatNumber(999)).toBe('999');
		expect(formatNumber(0.1 + 0.2)).toBe('0.30');
		expect(formatNumber(2.00000001)).toBe('2');
		expect(formatNumber(-12.5)).toBe('-12.50');
	});

	test('switches to suffixes at a thousand', () => {
		expect(formatNumber(1000, 2, 'suffix')).toBe('1.00K');
		expect(formatNumber(1.5e15, 2, 'suffix')).toBe('1.50Qa');
		expect(formatNumber(-2.5e6, 2, 'suffix')).toBe('-2.50M');
	});

	test('has a suffix for every finite double', () => {
		const suffix = formatNumber(Number.MAX_VALUE, 2, 'suffix').replace(/^[\d.]+/, '');
		expect(SUFFIXES).toContain(suffix);
		expect(suffix).not.toBe('');
	});

	test('scientific notation drops the plus sign', () => {
		expect(formatNumber(1.5e15, 2, 'scientific')).toBe('1.50e15');
		expect(formatNumber(999, 2, 'scientific')).toBe('999');
	});

	test('never prints NaN or Infinity', () => {
		expect(formatNumber(Infinity)).toBe('∞');
		expect(formatNumber(NaN)).toBe('∞');
	});
});

test('formatDuration shows the two or three largest units', () => {
	expect(formatDuration(45_000)).toBe('45s');
	expect(formatDuration(125_000)).toBe('2m 5s');
	expect(formatDuration(3_725_000)).toBe('1h 2m 5s');
	expect(formatDuration(90_061_000)).toBe('1d 1h 1m');
});
