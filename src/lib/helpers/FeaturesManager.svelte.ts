import { createDefaultFeatureState, FeatureTypes } from '#data/features.js';
import { SKILL_UPGRADES } from '#data/skillTree.js';
import type { FeatureState } from '#lib/types.js';
import { radiationManager } from '#helpers/RadiationManager.svelte.js';

export type FeatureAccessState = {
	skillUpgrades: string[];
};

export function deriveFeatureState(state: FeatureAccessState): FeatureState {
	const featureState = createDefaultFeatureState();

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

		if (this.state[FeatureTypes.RADIATION_REALM]) {
			radiationManager.unlock();
		}
	}
}
