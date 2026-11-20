import { CurrenciesTypes } from '#data/currencies.js';
import { GENERATOR_LEVEL_UP_COST, GENERATOR_TYPES } from '#data/generators.js';
import { RealmTypes } from '#data/realms.js';
import { checkStatePlausibility } from '#helpers/audit/plausibility.js';
import { getItem } from '#helpers/safeLocalStorage.js';
import { unwrapStoredSave, wrapSaveForStorage } from '#helpers/save/saveIntegrity.js';
import { statsConfig } from '#helpers/stats.js';
import type { GameState } from '#lib/types/game.js';
import type { SaveErrorType } from '#stores/saveRecovery.svelte.js';

export const SAVE_KEY = 'atomic-clicker-save';
export const SAVE_VERSION = 31;

interface LoadSaveResult {
	errorDetails?: string;
	errorType?: SaveErrorType;
	integrityTampered?: boolean;
	integrityWarnings?: string[];
	rawData?: string;
	state: GameState | null;
	success: boolean;
}

/** Serializes and checksum-wraps a game state, see saveIntegrity.ts. */
export function serializeSaveState(state: GameState): string {
	return wrapSaveForStorage(JSON.stringify(state));
}

export function loadSavedState(): LoadSaveResult {
	let rawData: string | null = null;

	try {
		rawData = getItem(SAVE_KEY);
		/** No save yet is a fresh start, not an error. */
		if (!rawData) return { state: null, success: true };

		const { payload, tampered: integrityTampered } = unwrapStoredSave(rawData);

		let parsedData: unknown;
		try {
			parsedData = JSON.parse(payload);
		} catch (parseError) {
			console.error('Failed to parse save JSON:', parseError);
			return {
				errorDetails: `JSON parsing failed: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`,
				errorType: 'invalid_json',
				rawData,
				state: null,
				success: false,
			};
		}

		let migratedState: GameState | undefined;
		try {
			migratedState = migrateSavedState(parsedData);
		} catch (migrateError) {
			console.error('Failed to migrate save:', migrateError);
			/** A save already at the current version loads as is when its migration throws. */
			const version = isObject(parsedData) ? parsedData.version : undefined;
			if (version === SAVE_VERSION) {
				migratedState = parsedData as GameState;
			} else {
				return {
					errorDetails: `Migration from v${version || 'unknown'} failed: ${migrateError instanceof Error ? migrateError.message : 'Unknown error'}`,
					errorType: 'migration_failed',
					rawData,
					state: null,
					success: false,
				};
			}
		}

		if (!migratedState) {
			return {
				errorDetails: 'Save migration returned empty result',
				errorType: 'migration_failed',
				rawData,
				state: null,
				success: false,
			};
		}

		const { repairs, state } = validateAndRepairGameState(migratedState);
		if (repairs.length > 0) console.log('Game state repaired:', repairs);
		return { integrityTampered, integrityWarnings: checkStatePlausibility(state!), state, success: true };
	} catch (e) {
		console.error('Failed to load saved game:', e);
		return {
			errorDetails: `Unexpected error: ${e instanceof Error ? e.message : 'Unknown error'}`,
			errorType: 'unknown',
			rawData: rawData ?? undefined,
			state: null,
			success: false,
		};
	}
}

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

function isValidSettings(value: unknown): boolean {
	if (!isObject(value) || !isObject(value.automation) || !isObject(value.upgrades)) return false;
	const { automation, gameplay, upgrades } = value;
	return (
		Array.isArray(automation.generators) &&
		typeof automation.autoClick === 'boolean' &&
		typeof automation.autoClickPhotons === 'boolean' &&
		typeof automation.upgrades === 'boolean' &&
		(gameplay === undefined || (isObject(gameplay) && typeof gameplay.offlineProgressEnabled === 'boolean')) &&
		typeof upgrades.displayAlreadyBought === 'boolean'
	);
}

/** A stat holds the type of its default, settings get a deeper check since the game reads their nested flags directly. */
function isValidStat(key: string, value: unknown, defaultValue: unknown): boolean {
	if (key === 'settings') return isValidSettings(value);
	if (Array.isArray(defaultValue)) return Array.isArray(value);
	if (typeof defaultValue === 'number') return Number.isFinite(value);
	if (typeof defaultValue === 'boolean') return typeof value === 'boolean';
	if (isObject(defaultValue)) return isObject(value);
	return true;
}

/** Fills every missing or broken stat with its default, so any object comes out a loadable current-version state. */
export function validateAndRepairGameState(state: unknown): { repairs: string[]; state: GameState | null } {
	if (!isObject(state)) return { repairs: [], state: null };

	const repairs: string[] = [];
	for (const [key, { defaultValue }] of Object.entries(statsConfig)) {
		if (key in state && isValidStat(key, state[key], defaultValue)) continue;
		repairs.push(key in state ? `Repaired invalid ${key}: ${JSON.stringify(state[key])}` : `Added missing field: ${key}`);
		/** The loaded state is mutated in place (the currencies setter fills it), the shared default must stay pristine. */
		state[key] = structuredClone(defaultValue);
	}

	if (state.version !== SAVE_VERSION) {
		state.version = SAVE_VERSION;
		repairs.push(`Updated version to ${SAVE_VERSION}`);
	}

	return { repairs, state: state as unknown as GameState };
}

interface LegacyGenerator {
	[key: string]: unknown;
	count?: number;
	level?: number;
}

/** A save from any past version, typed only as far as the migration steps read or rewrite it. */
interface LegacySave {
	[key: string]: unknown;
	achievements?: string[];
	atoms?: number;
	buildings?: Record<string, LegacyGenerator>;
	dailyStats?: { [key: string]: unknown; buildingsPurchased?: number; generatorsPurchased?: number };
	electrons?: number;
	excitedPhotons?: number;
	generators?: Record<string, LegacyGenerator>;
	photonRealmUnlocked?: boolean;
	photons?: number;
	photonUpgrades?: Record<string, number>;
	protons?: number;
	purpleRealmUnlocked?: boolean;
	settings?: { [key: string]: unknown; automation?: { [key: string]: unknown; buildings?: string[]; generators?: string[] } };
	skillUpgrades?: string[];
	totalBonusPhotonsClicked?: number;
	tutorial?: { active?: boolean; completed?: boolean; enabled?: boolean; seen?: string[]; seenRealmSteps?: string[]; step?: number };
	upgrades?: string[];
	version?: number;
}

export function migrateSavedState(savedState: unknown): GameState | undefined {
	if (!isObject(savedState)) return undefined;
	const state = savedState as LegacySave;

	/** Saves up to v25 keep generators under `buildings`, later ones under `generators`, a state with neither has nothing to migrate. */
	if (!('buildings' in state) && !('generators' in state)) return state as unknown as GameState;

	/** v1 saves are dropped, a balance change made them unplayable. */
	if (state.version === 1) return undefined;

	/** Each step only renames or reshapes data, stats added since the save's version are filled by validateAndRepairGameState. */
	while (state.version && state.version < SAVE_VERSION) {
		if (state.version === 2) {
			for (const building of Object.values(state.buildings ?? {})) {
				building.level = Math.floor((building.count ?? 0) / GENERATOR_LEVEL_UP_COST);
			}
		}

		if (state.version === 8) {
			if ((state.electrons ?? 0) > 0) {
				state.totalElectronizes = 1;
			}
		}

		if (state.version === 13) {
			/** Saves before v14 never tracked these totals, so the current balance and holdings become the baseline. */
			state.totalAtomsEarned = state.atoms || 0;
			state.totalAtomsEarnedAllTime = state.atoms || 0;
			const buildingsOwned = Object.values(state.buildings || {}).reduce((acc, b) => acc + (b?.count || 0), 0);
			state.totalBuildingsPurchased = buildingsOwned;
			state.totalClicksAllTime = state.totalClicks || 0;
			state.totalElectronsEarned = state.electrons || 0;
			state.totalProtonsEarned = state.protons || 0;
			state.totalUpgradesPurchased = (state.upgrades?.length || 0) + (state.skillUpgrades?.length || 0);
		}

		if (state.version === 14) {
			if (state.totalBonusPhotonsClicked) {
				state.totalBonusHiggsBosonClicked = state.totalBonusPhotonsClicked;
				delete state.totalBonusPhotonsClicked;
			}
			if (state.achievements) {
				state.achievements = state.achievements.map((id: string) =>
					id.replace('bonus_photons_clicked_', 'bonus_higgs_boson_clicked_'),
				);
			}
			if (state.skillUpgrades) {
				const map: Record<string, string> = {
					bonusPhotonSpeed0: 'bonusHiggsBosonSpeed0',
					bonusPhotonSpeed1: 'bonusHiggsBosonSpeed1',
					bonusPhotonSpeed2: 'bonusHiggsBosonSpeed2',
				};
				state.skillUpgrades = state.skillUpgrades.map((id: string) => map[id] || id);
			}
		}

		if (state.version === 15) {
			const mapping: Record<string, string> = {
				totalAtomsEarned: 'totalAtomsEarnedRun',
				totalBonusHiggsBosonClicked: 'totalBonusHiggsBosonClickedRun',
				totalBuildingsPurchased: 'totalBuildingsPurchasedAllTime',
				totalClicks: 'totalClicksRun',
				totalElectronizes: 'totalElectronizesAllTime',
				totalElectronsEarned: 'totalElectronsEarnedAllTime',
				totalExcitedPhotonsEarned: 'totalExcitedPhotonsEarnedAllTime',
				totalProtonises: 'totalProtonisesRun',
				totalProtonsEarned: 'totalProtonsEarnedAllTime',
				totalUpgradesPurchased: 'totalUpgradesPurchasedAllTime',
			};

			for (const [oldKey, newKey] of Object.entries(mapping)) {
				if (oldKey in state) {
					state[newKey] = state[oldKey];
					delete state[oldKey];
				}
			}

			/** Run and all-time totals are separate stats from v16 on, the new ones start from the old totals. */
			state.totalBonusHiggsBosonClickedAllTime = state.totalBonusHiggsBosonClickedRun || 0;
			state.totalElectronizesRun = state.totalElectronizesAllTime || 0;
			state.totalElectronsEarnedRun = state.totalElectronsEarnedAllTime || 0;
			state.totalExcitedPhotonsEarnedRun = state.totalExcitedPhotonsEarnedAllTime || 0;
			state.totalPhotonsEarnedAllTime = state.photons || 0;
			state.totalPhotonsEarnedRun = state.photons || 0;
			state.totalProtonisesAllTime = state.totalProtonisesRun || 0;
			state.totalProtonsEarnedRun = state.totalProtonsEarnedAllTime || 0;
		}

		if (state.version === 16) {
			state.currencies = {
				[CurrenciesTypes.ATOMS]: {
					amount: state.atoms || 0,
					earnedRun: state.totalAtomsEarnedRun || 0,
					earnedAllTime: state.totalAtomsEarnedAllTime || 0,
				},
				[CurrenciesTypes.ELECTRONS]: {
					amount: state.electrons || 0,
					earnedRun: state.totalElectronsEarnedRun || 0,
					earnedAllTime: state.totalElectronsEarnedAllTime || 0,
				},
				[CurrenciesTypes.EXCITED_PHOTONS]: {
					amount: state.excitedPhotons || 0,
					earnedRun: state.totalExcitedPhotonsEarnedRun || 0,
					earnedAllTime: state.totalExcitedPhotonsEarnedAllTime || 0,
				},
				[CurrenciesTypes.HIGGS_BOSON]: {
					amount: 0,
					earnedRun: state.totalBonusHiggsBosonClickedRun || 0,
					earnedAllTime: state.totalBonusHiggsBosonClickedAllTime || 0,
				},
				[CurrenciesTypes.PHOTONS]: {
					amount: state.photons || 0,
					earnedRun: state.totalPhotonsEarnedRun || 0,
					earnedAllTime: state.totalPhotonsEarnedAllTime || 0,
				},
				[CurrenciesTypes.PROTONS]: {
					amount: state.protons || 0,
					earnedRun: state.totalProtonsEarnedRun || 0,
					earnedAllTime: state.totalProtonsEarnedAllTime || 0,
				},
			};

			const keysToRemove = [
				'atoms',
				'electrons',
				'excitedPhotons',
				'photons',
				'protons',
				'totalAtomsEarnedAllTime',
				'totalAtomsEarnedRun',
				'totalBonusHiggsBosonClickedAllTime',
				'totalBonusHiggsBosonClickedRun',
				'totalElectronsEarnedAllTime',
				'totalElectronsEarnedRun',
				'totalExcitedPhotonsEarnedAllTime',
				'totalExcitedPhotonsEarnedRun',
				'totalPhotonsEarnedAllTime',
				'totalPhotonsEarnedRun',
				'totalProtonsEarnedAllTime',
				'totalProtonsEarnedRun',
			];

			keysToRemove.forEach(key => delete state[key]);
		}

		if (state.version === 18) {
			state.realms = {
				[RealmTypes.ATOMS]: { unlocked: true },
				[RealmTypes.PHOTONS]: { unlocked: state.photonRealmUnlocked ?? state.purpleRealmUnlocked ?? false },
				[RealmTypes.RADIATION]: { unlocked: false },
			};
			delete state.photonRealmUnlocked;
			delete state.purpleRealmUnlocked;
		}

		if (state.version === 20) {
			/** Saves before v21 use the skill-point system: its stat skills are upgrades now, and feature upgrades are skills. */
			const upgrades = new Set(state.upgrades ?? []);
			const skillUpgrades = new Set(state.skillUpgrades ?? []);

			const legacySkillToUpgradeIds = [
				'atomicFusion',
				'bonusHiggsBosonSpeed0',
				'bonusHiggsBosonSpeed1',
				'bonusHiggsBosonSpeed2',
				'clickPowerBoost0',
				'clickPowerBoost1',
				'clickPowerBoost2',
				'levelBoost0',
				'levelBoost1',
				'powerUpBoost0',
				'powerUpBoost1',
				'xpBoost0',
				'xpBoost1',
				'xpBoost2',
			];

			legacySkillToUpgradeIds.forEach(id => {
				if (skillUpgrades.has(id)) {
					upgrades.add(id);
					skillUpgrades.delete(id);
				}
			});

			const upgradeToSkillMap: Record<string, string> = {
				feature_levels: 'unlockLevels',
				feature_offline_progress: 'offlineProgress',
				feature_purple_realm: 'purpleRealm',
				proton_community_boost: 'communityPower',
				stability_unlock: 'stabilityField',
			};

			Object.entries(upgradeToSkillMap).forEach(([oldId, newId]) => {
				if (upgrades.has(oldId)) {
					skillUpgrades.add(newId);
					upgrades.delete(oldId);
				}
			});

			const photonUpgrades = state.photonUpgrades ?? {};
			if ((photonUpgrades.feature_hover_collection ?? 0) > 0) {
				skillUpgrades.add('hoverCollection');
			}

			state.upgrades = Array.from(upgrades);
			state.skillUpgrades = Array.from(skillUpgrades);
		}

		if (state.version === 22) {
			/** Saves from before v23 never show the first-time tutorial. */
			state.tutorial = { active: false, completed: true, step: 0 };
		}

		if (state.version === 24) {
			/** Saves before v25 hold a guided walkthrough, replaced by contextual hints: a finished walkthrough counts as the Atom realm hints seen. */
			const completedHints = ['atoms:click', 'atoms:building', 'atoms:upgrade', 'atoms:protonise', 'atoms:skill-tree'];
			state.tutorial = {
				enabled: true,
				seen: [...(state.tutorial?.seenRealmSteps ?? []), ...(state.tutorial?.completed ? completedHints : [])],
			};
		}

		if (state.version === 25) {
			/** Saves before v26 call generators `buildings`, achievement and daily quest ids keep the old name because the quark claims server keys on them. */
			state.generators = state.buildings ?? {};
			state.totalGeneratorsPurchasedAllTime = state.totalBuildingsPurchasedAllTime ?? 0;
			delete state.buildings;
			delete state.totalBuildingsPurchasedAllTime;
			if (state.dailyStats) {
				state.dailyStats.generatorsPurchased = state.dailyStats.buildingsPurchased ?? 0;
				delete state.dailyStats.buildingsPurchased;
			}
			if (state.settings?.automation) {
				state.settings.automation.generators = state.settings.automation.buildings ?? [];
				delete state.settings.automation.buildings;
			}
			if (Array.isArray(state.tutorial?.seen)) {
				state.tutorial.seen = state.tutorial.seen.map((id: string) => (id === 'atoms:building' ? 'atoms:generator' : id));
			}
		}

		if (state.version === 26) {
			/** Saves before v27 store a copy of each generator's base rate and cost, which kept rebalances from reaching them. */
			for (const generator of Object.values(state.generators ?? {})) {
				delete generator.cost;
				delete generator.rate;
			}
		}

		if (state.version === 27) {
			/** Saves before v28 hold stat boosts in the skill tree and automation and stability unlocks in the upgrades and the photon shop, the current layout is the reverse. */
			const skillToUpgrade: Record<string, string> = {
				atomicStability: 'atomic_stability',
				biologicalAmplifier: 'biological_amplifier',
				clickMastery: 'click_mastery',
				communityPower: 'proton_community_power',
				cosmicSynergy: 'electron_cosmic_synergy',
				electronHarvester: 'proton_electron_harvester',
				geologicalForce: 'geological_force',
				globalMultiplier: 'global_multiplier',
				levelMastery: 'level_mastery',
				molecularBoost: 'molecular_boost',
				nanoEnhancement: 'nano_enhancement',
				particleAccelerator: 'proton_particle_accelerator',
				powerUpMastery: 'power_up_mastery',
				prestigeBonus: 'proton_prestige_bonus',
				protonCollector: 'proton_collector',
				quantumResonance: 'proton_quantum_resonance',
				stellarCore: 'proton_stellar_core',
			};
			const upgradeToSkill: Record<string, string> = {
				electron_auto_upgrade_1: 'autoUpgrade',
				electron_bypass_atom_autoclick_stability: 'stableAutomation',
				electron_bypass_atom_click_stability: 'stableManipulation',
				electron_bypass_bonus_click_stability: 'stableAnomalies',
				electron_bypass_photon_autoclick_stability: 'stableQuantumFlux',
				electron_bypass_photon_click_stability: 'stableInteraction',
				proton_auto_click_1: 'autoClicker',
				proton_offline_autobuy: 'offlineAutoUpgrades',
				proton_offline_autoclick: 'offlineAutoClick',
			};
			for (const type of GENERATOR_TYPES) {
				skillToUpgrade[`${type}Multiplier`] = `${type.toLowerCase()}_multiplier`;
				skillToUpgrade[`${type}LevelMastery`] = `${type.toLowerCase()}_level_mastery`;
				upgradeToSkill[`electron_auto_buy_${type}`] = `${type}AutoBuy`;
			}
			const skillToPhotonUpgrade: Record<string, string> = { photonEfficiency: 'photon_efficiency', photonProtonBoost: 'photon_proton_boost' };

			const skills: string[] = state.skillUpgrades ?? [];
			const upgrades: string[] = state.upgrades ?? [];
			const photonUpgrades = (state.photonUpgrades ??= {});
			for (const id of skills) {
				const photonId = skillToPhotonUpgrade[id];
				if (photonId) photonUpgrades[photonId] = Math.max(photonUpgrades[photonId] ?? 0, 1);
			}
			state.upgrades = [...upgrades.filter(id => !upgradeToSkill[id]), ...skills.flatMap(id => skillToUpgrade[id] ?? [])];
			state.skillUpgrades = [...skills.filter(id => !skillToUpgrade[id] && !skillToPhotonUpgrade[id]), ...upgrades.flatMap(id => upgradeToSkill[id] ?? [])];
		}

		state.version++;
	}

	if (Array.isArray(state.activePowerUps)) {
		const seenIds = new Set<string>();
		state.activePowerUps = state.activePowerUps.filter((p: unknown) => {
			const id = isObject(p) ? p.id : undefined;
			if (typeof id !== 'string' || !id || seenIds.has(id)) return false;
			seenIds.add(id);
			return true;
		});
	}

	return state as unknown as GameState;
}
