import { browser } from '$app/environment';
import { warning } from '$stores/toasts';

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

		// Also listen for visibility changes to re-check?
		// Actually BroadcastChannel is enough.
	}

	private setDuplicate() {
		if (this.isDuplicate) return;
		this.isDuplicate = true;
		warning({
			title: 'Auth warning',
			message: 'Game is already open in another tab. Auth and Cloud Save might not work correctly.',
			is_infinite: true
		});
	}
}

export const multiTabDetector = new MultiTabDetector();
