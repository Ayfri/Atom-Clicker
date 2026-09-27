import { createDefaultFeatureState, FeatureTypes } from '$data/features';
import { SKILL_UPGRADES } from '$data/skillTree';
import type { FeatureState } from '$lib/types';
import { radiationManager } from '$helpers/RadiationManager.svelte';

export type FeatureAccessState = {
	skillUpgrades: string[];
};

export function deriveFeatureState(state: FeatureAccessState): FeatureState {
	const featureState = createDefaultFeatureState();

	// Features are now unlocked by skills that have a feature field
	Object.values(SKILL_UPGRADES).forEach(skill => {
		if (skill.feature && state.skillUpgrades.includes(skill.id)) {
			featureState[skill.feature] = true;
		}
	});

	return featureState;
}

export class FeaturesManager {
	state = $state<FeatureState>(createDefaultFeatureState());

	reset() {
		this.state = createDefaultFeatureState();
	}

	syncFromState(source: FeatureAccessState) {
		this.state = deriveFeatureState(source);

		// Sync radiation realm unlock with RadiationManager
		if (this.state[FeatureTypes.RADIATION_REALM]) {
			radiationManager.unlock();
		}
	}
}
