import { createDefaultFeatureState, type FeatureType } from '$data/features';
import { SKILL_UPGRADES } from '$data/skillTree';
import type { FeatureState } from '$lib/types';

export type FeatureAccessState = {
	skillUpgrades: string[];
};

export function deriveFeatureState(state: FeatureAccessState): FeatureState {
	const featureState = createDefaultFeatureState();

	// Features are now unlocked by skills that have a feature field
	Object.values(SKILL_UPGRADES).forEach((skill) => {
		if (skill.feature && state.skillUpgrades.includes(skill.id)) {
			featureState[skill.feature] = true;
		}
	});

	return featureState;
}

export class FeaturesManager {
	state = $state<FeatureState>(createDefaultFeatureState());

	isUnlocked(feature: FeatureType) {
		return this.state[feature] === true;
	}

	reset() {
		this.state = createDefaultFeatureState();
	}

	syncFromState(source: FeatureAccessState) {
		this.state = deriveFeatureState(source);
	}
}
