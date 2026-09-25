import type { TutorialState } from '$lib/types';

export function createDefaultTutorialState(): TutorialState {
	return { enabled: true, seen: [] };
}

export class TutorialManager {
	state = $state<TutorialState>(createDefaultTutorialState());

	hasSeen(hintId: string) {
		return this.state.seen.includes(hintId);
	}

	markSeen(hintId: string) {
		if (this.hasSeen(hintId)) return;
		this.state = { ...this.state, seen: [...this.state.seen, hintId] };
	}

	/** Forgets seen hints, all of them or only those whose id starts with `prefix` (e.g. `photons:`). */
	forget(prefix = '') {
		this.state = { enabled: true, seen: this.state.seen.filter(id => !id.startsWith(prefix)) };
	}

	setEnabled(enabled: boolean) {
		this.state = { ...this.state, enabled };
	}

	reset() {
		this.state = createDefaultTutorialState();
	}
}
