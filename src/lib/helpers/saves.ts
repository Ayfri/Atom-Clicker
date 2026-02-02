import { BUILDING_LEVEL_UP_COST, type BuildingType } from '$data/buildings';
import { CurrenciesTypes } from '$data/currencies';
import { RealmTypes } from '$data/realms';
import type { Building, GameState } from '$lib/types';
import { deriveFeatureState } from '$helpers/FeaturesManager.svelte';
import { statsConfig } from '$helpers/statConstants';
import { saveRecovery, type SaveErrorType } from '$stores/saveRecovery';

export const SAVE_KEY = 'atomic-clicker-save';
export const SAVE_VERSION = 21;

export interface LoadSaveResult {
	errorDetails?: string;
	errorType?: SaveErrorType;
	rawData?: string;
	state: GameState | null;
	success: boolean;
}

// Helper functions for state management
export function loadSavedState(): LoadSaveResult {
	let rawData: string | null = null;

	try {
		rawData = localStorage.getItem(SAVE_KEY);
		if (!rawData) {
			return { state: null, success: true }; // No save exists, not an error
		}

		// Step 1: Try to parse JSON
		let parsedData: any;
		try {
			parsedData = JSON.parse(rawData);
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
			if (parsedData.version === SAVE_VERSION) {
				migratedState = parsedData;
			} else {
				return {
					errorDetails: `Migration from v${parsedData.version || 'unknown'} failed: ${migrateError instanceof Error ? migrateError.message : 'Unknown error'}`,
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

		// Step 3: Validate and try to repair if needed
		const validationResult = validateAndRepairGameState(migratedState);
		if (validationResult.valid) {
			console.log('Valid game state:', validationResult.state);
			return { state: validationResult.state, success: true };
		}

		// If repair was attempted but still invalid
		if (validationResult.repaired && validationResult.state) {
			console.log('Game state repaired:', validationResult.repairs);
			return { state: validationResult.state, success: true };
		}

		return {
			errorDetails: `Validation failed: ${validationResult.errors.join(', ')}`,
			errorType: 'validation_failed',
			rawData,
			state: null,
			success: false,
		};
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

// Attempt to load with error handling and recovery popup
export function loadSavedStateWithRecovery(): GameState | null {
	const result = loadSavedState();

	if (result.success) {
		return result.state;
	}

	// Set error in recovery store
	if (result.errorType && result.errorDetails) {
		saveRecovery.setError(result.errorType, result.errorDetails, result.rawData ?? null);
	}

	return null;
}

interface ValidationResult {
	errors: string[];
	repaired: boolean;
	repairs: string[];
	state: GameState | null;
	valid: boolean;
}

export function validateAndRepairGameState(state: unknown): ValidationResult {
	const errors: string[] = [];
	const repairs: string[] = [];
	let repaired = false;

	if (!state || typeof state !== 'object') {
		return { errors: ['State is not an object'], repaired: false, repairs: [], state: null, valid: false };
	}

	const stateObj = state as Record<string, unknown>;

	// Define custom validators for complex types
	const customValidators: Record<string, (v: unknown) => boolean> = {
		features: (v: unknown) => typeof v === 'object' && v !== null,
		settings: (v: unknown) => {
			const val = v as Record<string, any>;
			const hasValidGameplay = typeof val.gameplay === 'undefined' || (
				typeof val.gameplay === 'object' && typeof val.gameplay?.offlineProgressEnabled === 'boolean'
			);

			return typeof val === 'object' && val !== null &&
				typeof val.automation === 'object' &&
				Array.isArray(val.automation?.buildings) &&
				typeof val.automation?.autoClick === 'boolean' &&
				typeof val.automation?.autoClickPhotons === 'boolean' &&
				typeof val.automation?.upgrades === 'boolean' &&
				hasValidGameplay &&
				typeof val.upgrades === 'object' &&
				typeof val.upgrades?.displayAlreadyBought === 'boolean';
		}
	};

	// Generate checks from statsConfig
	const checks = Object.entries(statsConfig).map(([key, config]) => {
		let validator = (v: unknown) => true;

		if (key in customValidators) {
			validator = customValidators[key];
		} else if (Array.isArray(config.defaultValue)) {
			validator = Array.isArray;
		} else if (typeof config.defaultValue === 'number') {
			validator = (v: unknown) => typeof v === 'number' && !isNaN(v as number);
		} else if (typeof config.defaultValue === 'boolean') {
			validator = (v: unknown) => typeof v === 'boolean';
		} else if (typeof config.defaultValue === 'object' && config.defaultValue !== null) {
			validator = (v: unknown) => typeof v === 'object' && v !== null;
		}

		return {
			defaultValue: config.defaultValue,
			key,
			validator
		};
	});

	// Try to repair each field
	for (const check of checks) {
		if (!(check.key in stateObj)) {
			stateObj[check.key] = check.defaultValue;
			repairs.push(`Added missing field: ${check.key}`);
			repaired = true;
		} else if (!check.validator(stateObj[check.key])) {
			const oldValue = stateObj[check.key];
			stateObj[check.key] = check.defaultValue;
			repairs.push(`Repaired invalid ${check.key}: ${JSON.stringify(oldValue)} -> ${JSON.stringify(check.defaultValue)}`);
			repaired = true;
		}
	}

	// Handle version separately - we upgrade to current version
	if (stateObj.version !== SAVE_VERSION) {
		stateObj.version = SAVE_VERSION;
		repairs.push(`Updated version to ${SAVE_VERSION}`);
		repaired = true;
	}

	// Repair NaN/Infinity values in numeric fields
	const numericFields = Object.entries(statsConfig)
		.filter(([_, config]) => typeof config.defaultValue === 'number')
		.map(([key]) => key);

	for (const field of numericFields) {
		if (typeof stateObj[field] === 'number' && (isNaN(stateObj[field]) || !isFinite(stateObj[field]))) {
			stateObj[field] = 0;
			repairs.push(`Fixed NaN/Infinity in ${field}`);
			repaired = true;
		}
	}

	// Verify repairs were successful
	const allValid = checks.every(check => check.key in stateObj && check.validator(stateObj[check.key]));

	if (!allValid) {
		const failedChecks = checks.filter(check => !(check.key in stateObj) || !check.validator(stateObj[check.key]));
		for (const check of failedChecks) {
			errors.push(`Field ${check.key} is still invalid after repair`);
		}
	}

	return {
		errors,
		repaired,
		repairs,
		state: allValid ? stateObj as unknown as GameState : null,
		valid: allValid && errors.length === 0,
	};
}

// Simple validation check (used by cloud save)
export function isValidGameState(state: unknown): state is GameState {
	if (!state) return false;
	const result = validateAndRepairGameState(structuredClone(state));
	return result.valid || result.repaired;
}

export function migrateSavedState(savedState: unknown): GameState | undefined {
	if (!savedState || typeof savedState !== 'object') return undefined;
	const state = savedState as any;

	if (!('buildings' in state)) return state;

	if (!('version' in state)) {
		// Migrate from old format
		state.buildings = Object.entries(state.buildings as Partial<GameState['buildings']>).reduce((acc, [key, value]) => {
			acc[key as BuildingType] = {
				...value,
				unlocked: true,
			};
			return acc;
		}, {} as GameState['buildings']);
	}

	if (state.version === 1) {
		// Hard reset due to balancing
		return undefined;
	}

	while ((state.version || 0) < SAVE_VERSION) {
		if (!state.version) break;

		const nextVersion = state.version + 1;

		// Generic Migration
		for (const [key, config] of Object.entries(statsConfig)) {
			if (config.minVersion <= nextVersion) {
				if (!(key in state)) {
					state[key] = typeof config.defaultValue === 'object' && config.defaultValue !== null
						? structuredClone(config.defaultValue)
						: config.defaultValue;
				}
			}
		}

		// Specific Migrations
		if (state.version === 2) {
			Object.entries<Partial<Building>>(state.buildings)?.forEach(([key, building]) => {
				building.level = Math.floor((building.count ?? 0) / BUILDING_LEVEL_UP_COST);
				state[key] = building;
			});
		}

		if (state.version === 4) {
			Object.entries<Partial<Building>>(state.buildings)?.forEach(([key, building]) => {
				state[key].cost = {
					amount: typeof building.cost === 'number' ? building.cost : building.cost?.amount,
					currency: CurrenciesTypes.ATOMS,
				}
			});
		}

		if (state.version === 8) {
			if (state.electrons > 0) {
				state.totalElectronizes = 1;
			}
		}

		if (state.version === 13) {
			// Initialize earned stats from current balance as a baseline
			state.totalAtomsEarned = state.atoms || 0;
			state.totalAtomsEarnedAllTime = state.atoms || 0;
			// Count total buildings currently owned as baseline
			const buildingsOwned = Object.values(state.buildings || {}).reduce((acc: number, b: unknown) => acc + ((b as any)?.count || 0), 0);
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
				state.achievements = state.achievements.map((id: string) => id.replace('bonus_photons_clicked_', 'bonus_higgs_boson_clicked_'));
			}
			if (state.skillUpgrades) {
				const map: Record<string, string> = {
					'bonusPhotonSpeed0': 'bonusHiggsBosonSpeed0',
					'bonusPhotonSpeed1': 'bonusHiggsBosonSpeed1',
					'bonusPhotonSpeed2': 'bonusHiggsBosonSpeed2',
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
				totalUpgradesPurchased: 'totalUpgradesPurchasedAllTime'
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
					earnedAllTime: state.totalAtomsEarnedAllTime || 0
				},
				[CurrenciesTypes.ELECTRONS]: {
					amount: state.electrons || 0,
					earnedRun: state.totalElectronsEarnedRun || 0,
					earnedAllTime: state.totalElectronsEarnedAllTime || 0
				},
				[CurrenciesTypes.EXCITED_PHOTONS]: {
					amount: state.excitedPhotons || 0,
					earnedRun: state.totalExcitedPhotonsEarnedRun || 0,
					earnedAllTime: state.totalExcitedPhotonsEarnedAllTime || 0
				},
				[CurrenciesTypes.HIGGS_BOSON]: {
					amount: 0,
					earnedRun: state.totalBonusHiggsBosonClickedRun || 0,
					earnedAllTime: state.totalBonusHiggsBosonClickedAllTime || 0
				},
				[CurrenciesTypes.PHOTONS]: {
					amount: state.photons || 0,
					earnedRun: state.totalPhotonsEarnedRun || 0,
					earnedAllTime: state.totalPhotonsEarnedAllTime || 0
				},
				[CurrenciesTypes.PROTONS]: {
					amount: state.protons || 0,
					earnedRun: state.totalProtonsEarnedRun || 0,
					earnedAllTime: state.totalProtonsEarnedAllTime || 0
				}
			};

			const keysToRemove = [
				'atoms', 'totalAtomsEarnedRun', 'totalAtomsEarnedAllTime',
				'electrons', 'totalElectronsEarnedRun', 'totalElectronsEarnedAllTime',
				'excitedPhotons', 'totalExcitedPhotonsEarnedRun', 'totalExcitedPhotonsEarnedAllTime',
				'totalBonusHiggsBosonClickedRun', 'totalBonusHiggsBosonClickedAllTime',
				'photons', 'totalPhotonsEarnedRun', 'totalPhotonsEarnedAllTime',
				'protons', 'totalProtonsEarnedRun', 'totalProtonsEarnedAllTime'
			];

			keysToRemove.forEach(key => delete state[key]);
		}

		if (state.version === 17) {
			if (state.activePowerUps) {
				state.activePowerUps = state.activePowerUps.filter((p: any) => p.duration <= 100_000);
			}
		}

		if (state.version === 18) {
			state.realms = {
				[RealmTypes.ATOMS]: { unlocked: true },
				[RealmTypes.PHOTONS]: { unlocked: state.photonRealmUnlocked ?? state.purpleRealmUnlocked ?? false }
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
				'xpBoost2'
			];

			// Move legacy skills to upgrades
			legacySkillToUpgradeIds.forEach((id) => {
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
				stability_unlock: 'stabilityField'
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
			if (photonUpgrades.feature_hover_collection > 0) {
				skillUpgrades.add('hoverCollection');
			}

			state.upgrades = Array.from(upgrades);
			state.skillUpgrades = Array.from(skillUpgrades);
			state.currencyBoosts = {};
			state.features = deriveFeatureState({ skillUpgrades: state.skillUpgrades });
		}

		state.version = nextVersion;
	}

	return state;
}
