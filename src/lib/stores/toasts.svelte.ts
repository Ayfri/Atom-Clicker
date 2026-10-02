import type { Component } from 'svelte';
import type { IconStackSpec } from '#helpers/iconStacks.js';

/** A component, a name from `namedIcons` in `Toast.svelte`, or a composed stack rendered by `IconStack.svelte`. */
export type ToastIcon = Component | IconStackSpec | string;
export type ToastType = 'error' | 'info' | 'success' | 'warning';

export interface ToastStyle {
	border: string;
	icon: Component;
	iconColor: string;
	progressBarColor: string;
	title: string;
}

export interface Toast {
	action?: () => void;
	actionLabel?: string;
	/** Milliseconds before the toast closes itself, 0 keeps it until dismissed. */
	duration: number;
	icon?: ToastIcon;
	id: number;
	message: string;
	title: string;
	type: ToastType;
}

export type ToastOptions = Omit<Toast, 'duration' | 'id' | 'type'> & {
	duration?: number;
};

/** Older timed toasts make room past this count, so an achievement burst never stacks off screen. */
const MAX_TOASTS = 4;

/** Monotonic, because a Date.now() based id can collide with another toast still alive in the list. */
let nextToastId = 0;

class ToastStore {
	list = $state<Toast[]>([]);

	clearAll = () => {
		this.list = [];
	};

	remove = (id: number) => {
		this.list = this.list.filter(t => t.id !== id);
	};

	/** A repeated toast replaces its live twin, which restarts its timer instead of stacking copies. */
	private create(type: ToastType, options: ToastOptions) {
		const list = this.list.filter(t => t.message !== options.message || t.title !== options.title);
		if (list.length >= MAX_TOASTS) {
			const oldest = list.findIndex(t => t.duration > 0);
			if (oldest !== -1) list.splice(oldest, 1);
		}
		this.list = [...list, { ...options, duration: options.duration ?? 10_000, id: ++nextToastId, type }];
	}

	error = (options: ToastOptions) => this.create('error', options);
	info = (options: ToastOptions) => this.create('info', options);
	success = (options: ToastOptions) => this.create('success', options);
	warning = (options: ToastOptions) => this.create('warning', options);
}

export const toastStore = new ToastStore();
