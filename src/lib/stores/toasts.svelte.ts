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
	duration: number;
	icon?: ToastIcon;
	id: number;
	is_infinite?: boolean;
	message: string;
	title: string;
	type: ToastType;
}

export type ToastOptions = Omit<Toast, 'id' | 'duration' | 'type'> & {
	duration?: number;
};

/** Monotonic, because a Date.now() based id can collide with another toast still alive in the list. */
let nextToastId = 0;

class ToastStore {
	list = $state<Toast[]>([]);

	add = (toast: Toast) => {
		this.list.push(toast);
		if (!toast.is_infinite && toast.duration > 0) {
			setTimeout(() => this.remove(toast.id), toast.duration);
		}
	};

	clearAll = () => {
		this.list = [];
	};

	remove = (id: number) => {
		this.list = this.list.filter(t => t.id !== id);
	};

	private create(type: ToastType, options: ToastOptions) {
		this.add({
			action: options.action,
			actionLabel: options.actionLabel,
			duration: options.duration ?? 10_000,
			icon: options.icon,
			id: ++nextToastId,
			is_infinite: options.is_infinite ?? false,
			message: options.message,
			title: options.title,
			type,
		});
	}

	error = (options: ToastOptions) => this.create('error', options);
	info = (options: ToastOptions) => this.create('info', options);
	success = (options: ToastOptions) => this.create('success', options);
	warning = (options: ToastOptions) => this.create('warning', options);
}

export const toastStore = new ToastStore();

