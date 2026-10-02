<script lang="ts">
	import { CURRENCIES, CurrenciesTypes } from '#data/currencies.js';
	import type { SvelteHTMLElements } from 'svelte/elements';

	type SvgProps = SvelteHTMLElements['svg'];

	interface Props extends SvgProps {
		color?: string;
		/** Tints the three escaping rays with `color` too, instead of Red, Green and Blue Light. */
		mono?: boolean;
		size?: number;
	}

	let { color = 'currentColor', mono = false, size = 24, ...props }: Props = $props();

	const [red, green, blue] = $derived(
		[CurrenciesTypes.RED_LIGHT, CurrenciesTypes.GREEN_LIGHT, CurrenciesTypes.BLUE_LIGHT].map(light => (mono ? color : CURRENCIES[light].color)),
	);
</script>

<!-- A sun-like burst: the orbit breaks in three places and a ray of each colored Light escapes through the gaps. -->
<svg
	xmlns="http://www.w3.org/2000/svg"
	viewBox="0 0 24 24"
	fill="none"
	width={size}
	height={size}
	stroke={color}
	stroke-linecap="round"
	stroke-linejoin="round"
	stroke-width="2"
	{...props}
>
	<path d="M15.89 15.89a5.5 5.5 0 0 1-7.78 0M6.69 13.42a5.5 5.5 0 0 1 3.89-6.73M13.42 6.69a5.5 5.5 0 0 1 3.89 6.73" />
	<circle cx="12" cy="12" r="2.2" fill={color} stroke="none" />
	<path d="M12 20.5v1.5M4.64 7.75l-1.3-.75M19.36 7.75l1.3-.75" />
	<path d="M12 7.5V1.5" stroke={red} />
	<path d="M15.9 14.25l5.2 3" stroke={green} />
	<path d="M8.1 14.25l-5.2 3" stroke={blue} />
</svg>
