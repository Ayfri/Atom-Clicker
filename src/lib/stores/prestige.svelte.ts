export type PrestigeAnimationType = 'electronize' | 'ionize' | 'protonise';

class PrestigeStore {
	animation = $state<PrestigeAnimationType | null>(null);

	trigger(type: PrestigeAnimationType) {
		this.animation = type;
	}

	reset() {
		this.animation = null;
	}
}

export const prestigeStore = new PrestigeStore();
