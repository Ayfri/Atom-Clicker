import { MediaQuery } from 'svelte/reactivity';

/**
 * Single source of truth for the mobile/desktop split, mirrored by every `@media` block that stacks a layout.
 * 64rem is Tailwind's `lg` edge: the three column desktop grid needs ~1008px before the side nav clips it.
 */
export const MOBILE_QUERY = '(width < 64rem)';

/** matchMedia rather than an innerWidth comparison, so JS and CSS flip on the exact same pixel. */
export const mobile = new MediaQuery(MOBILE_QUERY, true);
