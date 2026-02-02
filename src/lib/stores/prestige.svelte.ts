export class PrestigeStore {
	animation = $state<'electronize' | 'protonise' | null>(null);

	trigger(type: 'electronize' | 'protonise') {
		this.animation = type;
	}

	reset() {
		this.animation = null;
	}
}

export const prestigeStore = new PrestigeStore();
