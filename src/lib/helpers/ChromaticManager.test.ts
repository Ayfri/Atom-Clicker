import { beforeEach, describe, expect, test } from 'bun:test';
import { CHROMATIC, CHROMATIC_COLORS, CHROMATIC_UPGRADES, type ChromaticColor, KILLS_PER_SPECTRUM_LEVEL } from '#data/chromatic.js';
import { CurrenciesTypes } from '#data/currencies.js';
import { RADIATION_UPGRADES } from '#data/radiationUpgrades.js';
import { ChromaticField } from '#helpers/chromaticField.js';
import { chromaticManager } from '#helpers/ChromaticManager.svelte.js';
import { currenciesManager } from '#helpers/CurrenciesManager.svelte.js';
import { gameManager } from '#helpers/GameManager.svelte.js';
import { radiationManager } from '#helpers/RadiationManager.svelte.js';

const WIDTH = 800;
const HEIGHT = 600;
/** No Ionize and no outside boost, the bare Prism formulas. */
const bare = { lightGain: { blue: 1, green: 1, red: 1 }, totalIonizesAllTime: 0 };

const light = (color: ChromaticColor) => currenciesManager.getAmount(CHROMATIC[color].currency);
const giveLight = (amounts: Record<ChromaticColor, number>) => {
	for (const color of CHROMATIC_COLORS) {
		currenciesManager.remove(CHROMATIC[color].currency, Infinity);
		currenciesManager.add(CHROMATIC[color].currency, amounts[color]);
	}
};
const inField = ({ x, y }: { x: number; y: number }) => x >= 0 && x <= WIDTH && y >= 0 && y <= HEIGHT;

/** Respawns until the single photon on screen has the wanted color. */
function spawnColor(field: ChromaticField, color: ChromaticColor) {
	do {
		field.photons = [];
		field.spawn(WIDTH, HEIGHT);
	} while (field.photons[0].color !== color);
	return field.photons[0];
}

/** Taps a photon until it breaks and collects it, returns the taps it took. */
function breakPhoton(field: ChromaticField, photon: ChromaticField['photons'][number]) {
	let taps = 0;
	let result = null;
	while (!result && field.photons.includes(photon)) {
		result = field.hit(photon, false);
		taps++;
	}
	if (result) chromaticManager.collect(result, gameManager);
	return taps;
}

beforeEach(() => {
	gameManager.resetAll();
});

describe('field', () => {
	test('spawns cap at 5 on screen, inside the field', () => {
		const field = new ChromaticField();
		for (let i = 0; i < 20; i++) field.spawn(WIDTH, HEIGHT);
		expect(field.photons).toHaveLength(5);
		expect(field.photons.every(inField)).toBe(true);
	});

	test('each color breaks after its HP in taps and pays its Light, blue split in two halves', () => {
		const field = new ChromaticField();
		for (const color of CHROMATIC_COLORS) {
			expect(breakPhoton(field, spawnColor(field, color)), color).toBe(Math.ceil(CHROMATIC[color].hp));
			if (color !== 'blue') continue;
			expect(field.photons).toHaveLength(2);
			expect(field.photons.every(half => half.half)).toBe(true);
			for (const half of [...field.photons]) breakPhoton(field, half);
			expect(field.photons).toHaveLength(0);
			expect(chromaticManager.kills.blue).toBe(1);
		}
		expect([light('red'), light('green'), light('blue')]).toEqual([3, 1, 2]);
	});

	test('expired photons vanish, a released photon appears in place past the cap', () => {
		const field = new ChromaticField();
		field.spawn(WIDTH, HEIGHT);
		field.update(60_000, WIDTH, HEIGHT, true);
		expect(field.photons).toHaveLength(0);

		for (let i = 0; i < 5; i++) field.spawn(WIDTH, HEIGHT);
		field.spawn(WIDTH, HEIGHT, { x: 123, y: 456 });
		expect(field.photons).toHaveLength(6);
		expect(field.photons[5]).toMatchObject({ x: 123, y: 456 });
	});

	test('green photons wander at a constant speed inside the field', () => {
		const field = new ChromaticField();
		const green = spawnColor(field, 'green');
		const headings: number[] = [];
		for (let frame = 0; frame < 180 && field.photons.includes(green); frame++) {
			field.update(16, WIDTH, HEIGHT, true);
			headings.push(Math.atan2(green.vy, green.vx));
		}
		const turns = headings.slice(1).map((heading, i) => Math.abs(Math.atan2(Math.sin(heading - headings[i]), Math.cos(heading - headings[i]))));
		expect(turns.filter(turn => turn > 1e-3).length).toBeGreaterThan(turns.length / 2);
		expect(Math.hypot(green.vx, green.vy)).toBeCloseTo(CHROMATIC.green.speed, 6);
		expect(inField(green)).toBe(true);
	});
});

describe('upgrades', () => {
	test('Focused Red raises red tap damage', () => {
		currenciesManager.add(CHROMATIC.red.currency, 100);
		expect(chromaticManager.purchaseUpgrade('red_focus')).toBe(true);
		expect(chromaticManager.tapDamage('red', false)).toBe(2);
	});

	test('stop at their max level', () => {
		chromaticManager.upgradeLevels = { red_focus: CHROMATIC_UPGRADES.red_focus.maxLevel };
		currenciesManager.add(CHROMATIC.red.currency, 1e30);
		expect(chromaticManager.purchaseUpgrade('red_focus')).toBe(false);
		expect(chromaticManager.level('red_focus')).toBe(CHROMATIC_UPGRADES.red_focus.maxLevel);
	});

	test('more spectrum levels make a color tougher faster than they make it pay', () => {
		const hp = chromaticManager.maxHp('red');
		const lightBefore = chromaticManager.lightFor('red', 1, bare);
		chromaticManager.loadState({ kills: { blue: 0, green: 0, red: 10 * KILLS_PER_SPECTRUM_LEVEL } });
		expect(chromaticManager.maxHp('red') / hp).toBeGreaterThan(chromaticManager.lightFor('red', 1, bare) / lightBefore);
	});

	test('Prism Excitation takes 30 of each Light for a 1% chance', () => {
		giveLight({ blue: 29, green: 30, red: 30 });
		expect(chromaticManager.purchaseUpgrade('prism_excitation')).toBe(false);
		currenciesManager.add(CHROMATIC.blue.currency, 1);
		expect(chromaticManager.purchaseUpgrade('prism_excitation')).toBe(true);
		expect(CHROMATIC_COLORS.map(light)).toEqual([0, 0, 0]);
		expect(chromaticManager.excitationChance).toBe(0.01);
	});

	test('Excited Spectrum and Prism Resonance add their chances per level', () => {
		const excitedBefore = gameManager.excitedPhotonChance;
		chromaticManager.upgradeLevels = { prism_excited_chance: 2, prism_resonance: 3 };
		expect(gameManager.excitedPhotonChance - excitedBefore).toBeCloseTo(0.01, 9);
		expect(chromaticManager.resonanceChance).toBeCloseTo(0.3, 9);
		expect(CHROMATIC_UPGRADES.prism_excitation.maxLevel).toBe(20);
		expect(CHROMATIC_UPGRADES.prism_resonance.maxLevel).toBe(5);
	});

	test('phase 2 boosts unlock at Spectrum 5 and multiply production and clicks', () => {
		currenciesManager.add(CHROMATIC.red.currency, 1e6);
		expect(chromaticManager.purchaseUpgrade('red_ember')).toBe(false);
		chromaticManager.loadState({ kills: { blue: 50, green: 50, red: 50 } });
		const globalBefore = gameManager.globalMultiplier;
		const clickBefore = gameManager.effects.value('click', 1, gameManager);
		expect(chromaticManager.purchaseUpgrade('red_ember') && chromaticManager.purchaseUpgrade('red_spark')).toBe(true);
		expect(gameManager.globalMultiplier / globalBefore).toBeCloseTo(1.1, 9);
		expect(gameManager.effects.value('click', 1, gameManager) / clickBefore).toBeCloseTo(1.2, 9);
	});

	test('Green Bloom and Green Charge multiply protons and electrons', () => {
		const protonsBefore = gameManager.effects.value('proton_gain', 1, gameManager);
		const electronsBefore = gameManager.effects.value('electron_gain', 1, gameManager);
		chromaticManager.upgradeLevels = { green_bloom: 2, green_charge: 3 };
		expect(gameManager.effects.value('proton_gain', 1, gameManager) / protonsBefore).toBeCloseTo(1.2, 9);
		expect(gameManager.effects.value('electron_gain', 1, gameManager) / electronsBefore).toBeCloseTo(1.3, 9);
	});

	test('Blue Coolant and Blue Enrichment raise the reactor cap and output', () => {
		const capBefore = radiationManager.maxCpm;
		const enrichmentBefore = radiationManager.enrichmentBonus;
		chromaticManager.upgradeLevels = { blue_coolant: 5, blue_enrichment: 4 };
		expect(radiationManager.maxCpm / capBefore).toBeCloseTo(1.5, 9);
		expect(radiationManager.enrichmentBonus / enrichmentBefore).toBeCloseTo(1.4, 9);
	});

	test('Recombine makes one White Light per 10 of each color, and nothing without a full set', () => {
		giveLight({ blue: 41, green: 30, red: 55 });
		expect(chromaticManager.recombinable).toBe(3);
		expect(chromaticManager.recombine()).toBe(3);
		expect(currenciesManager.getAmount(CurrenciesTypes.WHITE_LIGHT)).toBe(3);
		expect([light('red'), light('green'), light('blue')]).toEqual([25, 0, 11]);
		expect(chromaticManager.recombine()).toBe(0);
	});

	test('Full Spectrum adds 50% Light, Wider Prism raises the on-screen cap', () => {
		currenciesManager.add(CurrenciesTypes.WHITE_LIGHT, 1e6);
		const lightBefore = chromaticManager.lightFor('red', 3, bare);
		expect(chromaticManager.purchaseUpgrade('white_spectrum')).toBe(true);
		expect(chromaticManager.lightFor('red', 3, bare) / lightBefore).toBeCloseTo(1.5, 9);

		chromaticManager.upgradeLevels = { white_prism: 2 };
		const field = new ChromaticField();
		for (let i = 0; i < 20; i++) field.spawn(WIDTH, HEIGHT);
		expect(field.photons).toHaveLength(7);
	});
});

describe('saves', () => {
	test('upgrades and kills survive a save round-trip', () => {
		chromaticManager.upgradeLevels = { red_focus: 1 };
		chromaticManager.loadState({ kills: { blue: 1, green: 1, red: 1 } });
		const saved = gameManager.getCurrentState();
		chromaticManager.upgradeLevels = {};
		chromaticManager.loadState({ kills: { blue: 0, green: 0, red: 0 } });
		gameManager.loadSaveData(saved);
		expect(chromaticManager.level('red_focus')).toBe(1);
		expect(chromaticManager.kills.blue).toBe(1);
	});

	test('a save without the Light currencies loads and earns', () => {
		const legacy = JSON.parse(JSON.stringify(gameManager.getCurrentState())) as ReturnType<typeof gameManager.getCurrentState>;
		delete (legacy.currencies as Partial<typeof legacy.currencies>)[CurrenciesTypes.RED_LIGHT];
		gameManager.loadSaveData(legacy);
		currenciesManager.add(CHROMATIC.red.currency, 1);
		expect(light('red')).toBe(1);
	});
});

describe('Ionize reactor upgrades', () => {
	const ionizeUpgrades = ['neutron_reflector', 'ion_lattice', 'fusion_ignition'];
	const unlocked = (id: string) => gameManager.totalIonizesAllTime >= (RADIATION_UPGRADES[id].ionizes ?? 0);

	test('stay hidden before any Ionize, Ionizes 1 to 3 unlock them', () => {
		expect(ionizeUpgrades.some(unlocked)).toBe(false);
		gameManager.totalIonizesAllTime = 3;
		expect(ionizeUpgrades.every(unlocked)).toBe(true);
	});

	test('add fuel per electron, CPM cap and radiation multiplier per level', () => {
		const [fuelBefore, capBefore, multiplierBefore] = [radiationManager.massPerElectron, radiationManager.maxCpm, radiationManager.multiplierFor(1000)];
		radiationManager.upgradeLevels = { fusion_ignition: 3, ion_lattice: 2, neutron_reflector: 4 };
		expect(radiationManager.massPerElectron / fuelBefore).toBeCloseTo(2, 9);
		expect(radiationManager.maxCpm - capBefore).toBe(3000);
		expect((radiationManager.multiplierFor(1000) - 1) / (multiplierBefore - 1)).toBeCloseTo(1.4, 9);
	});
});

describe('offline Light', () => {
	test('is capped by the spawn rate, earned from damage over HP when slow, and slowed by the offline factor', () => {
		const fast = chromaticManager.autoLightPerSecond(1e6, 1, bare);
		expect(fast.red).toBeCloseTo((1000 / 8000 / 3) * 3, 9);
		expect(fast.blue).toBeCloseTo((1000 / 8000 / 3) * 2, 9);
		expect(chromaticManager.autoLightPerSecond(0.6, 1, bare).red).toBeCloseTo(((0.1 * 0.25) / 30) * 3, 9);
		expect(chromaticManager.autoLightPerSecond(1e6, 120, bare).red / fast.red).toBeCloseTo(1 / 120, 9);
	});
});
