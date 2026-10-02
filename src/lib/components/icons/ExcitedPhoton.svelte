<script lang="ts">
    import type { SvelteHTMLElements } from 'svelte/elements';

    type SvgProps = SvelteHTMLElements['svg'];

    interface Props extends SvgProps {
      color?: string;
      size?: number;
    }

    let { color = '#FFD700', size = 18, ...props }: Props = $props();
  </script>

  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    width={size}
    height={size}
    stroke={color}
    stroke-linecap="round"
    stroke-linejoin="round"
    {...props}
  >
    <circle cx="12" cy="12" r="10" fill={color} fill-opacity="0.1" stroke-width="1" />

    <circle cx="12" cy="12" r="2" fill={color} stroke="none" opacity="0.3" />

    <path d="M4 9C7 9 9 15 12 15C15 15 17 9 20 9" stroke-width="1.5" />
    <path d="M4 15C7 15 9 9 12 9C15 9 17 15 20 15" stroke-width="1.5" />
  </svg>
