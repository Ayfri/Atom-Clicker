import { browser } from '$app/env';
import { toastStore } from '#stores/toasts.svelte.js';

export class MultiTabDetector {
	isDuplicate = $state(false);
	private channel: BroadcastChannel | null = null;

	init() {
		if (!browser) return;

		this.channel = new BroadcastChannel('atom_clicker_tabs');

		this.channel.onmessage = (event) => {
			if (event.data === 'ping') {
				this.channel?.postMessage('pong');
			} else if (event.data === 'pong') {
				this.setDuplicate();
			}
		};

		// Check if another tab exists
		this.channel.postMessage('ping');
	}

	private setDuplicate() {
		if (this.isDuplicate) return;
		this.isDuplicate = true;
		toastStore.warning({
			title: 'Auth warning',
			message: 'Game is already open in another tab. Auth and Cloud Save might not work correctly.',
			duration: 0
		});
	}
}

export const multiTabDetector = new MultiTabDetector();
