import { browser } from '$app/environment';
import { getJSON, setItem } from '$lib/utils/safeLocalStorage';
import { supabaseAuth } from '$stores/supabaseAuth.svelte';
import type { GameMessage } from '$lib/types/supabase';

export class RemoteMessageStore {
	message = $state<GameMessage | null>(null);
	dismissedIds = $state<string[]>([]);
	isVisible = $state(true);

	/** Banner height in rem, one 1.5rem row per 100 visible characters, so a long message does not overflow the bar. Zero when nothing is shown. */
	bannerHeightRem = $derived.by(() => {
		if (!this.message || !this.isVisible) return 0;
		const visibleLength = this.message.message_html.replace(/<[^>]*>/g, '').length;
		return 1.5 * Math.max(1, Math.ceil(visibleLength / 100));
	});

	private interval: ReturnType<typeof setInterval> | null = null;

	constructor() {
		if (browser) {
			this.dismissedIds = getJSON<string[]>('dismissed_messages', []);

			// Reactively fetch message when supabase is available
			$effect.root(() => {
				$effect(() => {
					if (supabaseAuth.supabase) {
						this.fetchMessage();
					}
				});
			});
		}
	}

	async fetchMessage() {
		if (!browser || !supabaseAuth.supabase) return;

		try {
			const { data, error } = await supabaseAuth.supabase
				.from('game_messages')
				.select('*')
				.eq('is_active', true)
				.order('created_at', { ascending: false })
				.limit(1)
				.maybeSingle();

			if (error) {
				if (error.code !== '42P01') {
					console.error('Error fetching remote message:', error);
				}
				return;
			}

			if (data) {
				const isNewMessage = data.id !== this.message?.id;
				this.message = data;
				if (isNewMessage) {
					this.isVisible = !this.dismissedIds.includes(data.id);
				}
			} else {
				this.message = null;
			}
		} catch (err) {
			console.error('Failed to fetch remote message:', err);
		}
	}

	dismiss() {
		if (!this.message) return;
		const newDismissedIds = [...new Set([...this.dismissedIds, this.message.id])];
		this.dismissedIds = newDismissedIds;
		if (browser) {
			setItem('dismissed_messages', JSON.stringify(newDismissedIds));
		}
		this.isVisible = false;
	}

	show() {
		this.isVisible = true;
	}

	startPolling() {
		if (!browser) return;
		if (this.interval) return;

		this.fetchMessage();
		this.interval = setInterval(() => this.fetchMessage(), 30000); // 30 seconds
	}

	stopPolling() {
		if (this.interval) {
			clearInterval(this.interval);
			this.interval = null;
		}
	}

	refresh() {
		return this.fetchMessage();
	}

	// For compatibility with code using $remoteMessage
	subscribe(fn: (value: RemoteMessageStore) => void) {
		const unsubscribe = $effect.root(() => {
			$effect(() => {
				fn(this);
			});
		});
		return unsubscribe;
	}
}

export const remoteMessage = new RemoteMessageStore();
