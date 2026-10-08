import { CurrenciesTypes } from '#data/currencies.js';
import { GENERATOR_LEVEL_UP_COST, GENERATOR_TYPES } from '#data/generators.js';
import { RealmTypes } from '#data/realms.js';
import type { GameState, Generator } from '#lib/types.js';
import { checkStatePlausibility } from '#helpers/plausibility.js';
import { statsConfig } from '#helpers/statConstants.js';
import { getItem } from '#lib/utils/safeLocalStorage.js';
import { unwrapStoredSave, wrapSaveForStorage } from '#lib/utils/saveIntegrity.js';
import type { SaveErrorType } from '#stores/saveRecovery.svelte.js';

export const SAVE_KEY = 'atomic-clicker-save';
export const SAVE_VERSION = 31;

export interface LoadSaveResult {
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
		if (!rawData) {
			return { state: null, success: true }; // No save exists, not an error
		}

		const { payload, tampered: integrityTampered } = unwrapStoredSave(rawData);

		// Step 1: Try to parse JSON
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

		// Step 2: Try to migrate
		let migratedState: GameState | undefined;
		try {
			migratedState = migrateSavedState(parsedData);
		} catch (migrateError) {
			console.error('Failed to migrate save:', migrateError);
			// Try to recover without migration if it's already current version
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

		// Step 3: Repair, every broken field falls back to its default
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

	// Generators were stored under `buildings` until v26.
	if (!('buildings' in state) && !('generators' in state)) return state as unknown as GameState;

	if (state.version === 1) {
		// Hard reset due to balancing
		return undefined;
	}

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
			// Initialize earned stats from current balance as a baseline
			state.totalAtomsEarned = state.atoms || 0;
			state.totalAtomsEarnedAllTime = state.atoms || 0;
			// Count total buildings currently owned as baseline
			const buildingsOwned = Object.values(state.buildings || {}).reduce((acc, b) => acc + (b?.count || 0), 0);
			state.totalBuildingsPurchased = buildingsOwned;
			// Initialize clicks all time from current run
			state.totalClicksAllTime = state.totalClicks || 0;
			// Initialize currency earned from current balance
			state.totalElectronsEarned = state.electrons || 0;
			state.totalProtonsEarned = state.protons || 0;
			// Count upgrades owned as baseline
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

			// Initialize new stats
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
			// Major migration: Convert old skill-point system to new currency-based skill system
			// 1. Move legacy skills that are now upgrades
			// 2. Convert feature upgrades to new skill IDs
			// 3. Initialize currencyBoosts

			const upgrades = new Set(state.upgrades ?? []);
			const skillUpgrades = new Set(state.skillUpgrades ?? []);

			// Legacy skills that should be moved to upgrades (from previous system)
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

			// Move legacy skills to upgrades
			legacySkillToUpgradeIds.forEach(id => {
				if (skillUpgrades.has(id)) {
					upgrades.add(id);
					skillUpgrades.delete(id);
				}
			});

			// Map old upgrade IDs to new skill IDs (features are now skills)
			const upgradeToSkillMap: Record<string, string> = {
				feature_levels: 'unlockLevels',
				feature_offline_progress: 'offlineProgress',
				feature_purple_realm: 'purpleRealm',
				proton_community_boost: 'communityPower',
				stability_unlock: 'stabilityField',
			};

			// Convert old feature upgrades to skills
			Object.entries(upgradeToSkillMap).forEach(([oldId, newId]) => {
				if (upgrades.has(oldId)) {
					skillUpgrades.add(newId);
					upgrades.delete(oldId);
				}
			});

			// Convert photon upgrade feature to skill
			const photonUpgrades = state.photonUpgrades ?? {};
			if ((photonUpgrades.feature_hover_collection ?? 0) > 0) {
				skillUpgrades.add('hoverCollection');
			}

			state.upgrades = Array.from(upgrades);
			state.skillUpgrades = Array.from(skillUpgrades);
		}

		if (state.version === 22) {
			// Existing saves shouldn't see the first-time tutorial
			state.tutorial = { active: false, completed: true, step: 0 };
		}

		if (state.version === 24) {
			// The guided walkthrough became contextual hints, a finished walkthrough already taught the Atom realm ones
			const completedHints = ['atoms:click', 'atoms:building', 'atoms:upgrade', 'atoms:protonise', 'atoms:skill-tree'];
			state.tutorial = {
				enabled: true,
				seen: [...(state.tutorial?.seenRealmSteps ?? []), ...(state.tutorial?.completed ? completedHints : [])],
			};
		}

		if (state.version === 25) {
			// Buildings were renamed to generators, achievement and daily quest ids stay as they are since the quark claims server keys on them
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
			// Generators stored a copy of their base rate and cost, which kept rebalances from reaching existing saves
			for (const generator of Object.values(state.generators ?? {})) {
				delete generator.cost;
				delete generator.rate;
			}
		}

		if (state.version === 27) {
			// Stat boosts left the skill tree for the upgrade lists and the photon shop, automation and stability unlocks became skills
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
