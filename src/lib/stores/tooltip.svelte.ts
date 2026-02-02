import type { Snippet } from 'svelte';

export type TooltipPosition = 'bottom' | 'left' | 'right' | 'top';
export type TooltipSize = 'lg' | 'md' | 'sm';

interface TooltipState {
	content: Snippet | null;
	position: TooltipPosition;
	size: TooltipSize;
	triggerRect: DOMRect | null;
	visible: boolean;
}

const initialState: TooltipState = {
	content: null,
	position: 'top',
	size: 'md',
	triggerRect: null,
	visible: false,
};

let state = $state<TooltipState>({ ...initialState });

export const tooltip = {
	get content() {
		return state.content;
	},
	get position() {
		return state.position;
	},
	get size() {
		return state.size;
	},
	get triggerRect() {
		return state.triggerRect;
	},
	get visible() {
		return state.visible;
	},

	hide() {
		state.visible = false;
	},

	show(options: { content: Snippet; position?: TooltipPosition; size?: TooltipSize; triggerRect: DOMRect }) {
		state.content = options.content;
		state.position = options.position ?? 'top';
		state.size = options.size ?? 'md';
		state.triggerRect = options.triggerRect;
		state.visible = true;
	},

	updatePosition(triggerRect: DOMRect) {
		state.triggerRect = triggerRect;
	},
};
