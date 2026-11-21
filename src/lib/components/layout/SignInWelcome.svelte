<script lang="ts" module>
	import type { Attachment } from 'svelte/attachments';

	const ORBIT = 52;

	interface Wave {
		delay: number;
		opacity: number;
		scale: number;
	}

	/**
	 * Start times in ms, `burst` is when the ring finishes closing and sets the burst off. A returning player gets a smaller burst and
	 * fades out on its own at `out`, a new account gets the full show, which still stays below Ionize (no beams, three waves where Ionize
	 * sends five), then the perks of an account, and stays until its button closes it.
	 */
	const VARIANTS = {
		new: {
			glow: true,
			inflow: 40,
			reach: [190, 430],
			sparks: 56,
			timeline: { avatar: 0, burst: 1450, out: 0, perks: 2300, ring: 850, subtitle: 2000, title: 1750 },
			waves: [
				{ delay: 0, opacity: 0.9, scale: 4.2 },
				{ delay: 130, opacity: 0.6, scale: 3.2 },
				{ delay: 270, opacity: 0.4, scale: 2.4 },
			],
		},
		returning: {
			glow: false,
			inflow: 0,
			reach: [110, 210],
			sparks: 20,
			timeline: { avatar: 0, burst: 850, out: 2000, perks: 0, ring: 250, subtitle: 0, title: 750 },
			waves: [{ delay: 0, opacity: 0.7, scale: 2.6 }],
		},
	} as const;

	type Variant = (typeof VARIANTS)[keyof typeof VARIANTS];

	const random = (min: number, max: number) => min + Math.random() * (max - min);
	const toward = (angle: number, distance: number) => `rotate(${angle}deg) translateX(${distance}px)`;

	/** The electrons that stay on the orbit, spread out by hand so they never look regular. */
	const BEADS = Array.from({ length: 9 }, (_, index) => ({ angle: index * 40 + (index % 3) * 7, delay: index * 45, from: 110 + ((index * 37) % 50) }));

	/**
	 * Plays keyframes with every value resolved to pixels and degrees: keyframes reading per-element `var()` run on the main thread in
	 * Chrome, which held the prestige animation near 15 fps on phones. Reduced motion skips it, the element keeps its static style.
	 * Anything opaque on its first frame passes `fill: 'forwards'`, a backwards fill would show that frame during the whole delay.
	 */
	function play(keyframes: Keyframe[], options: KeyframeAnimationOptions): Attachment<HTMLElement> {
		return element => {
			if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
			const animation = element.animate(keyframes, { fill: 'both', ...options });
			return () => animation.cancel();
		};
	}

	function bead({ angle, delay, from }: (typeof BEADS)[number]): Attachment<HTMLElement> {
		return play([{ opacity: 0, transform: toward(angle - 80, from) }, { opacity: 0.9, transform: toward(angle, ORBIT) }], {
			delay,
			duration: 650,
			easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
		});
	}

	/** Spirals in from far around the avatar and fades out on the orbit, so the cloud seems to condense into it. */
	function inflow(): Attachment<HTMLElement> {
		const angle = random(0, 360);
		return play(
			[
				{ opacity: 0, transform: `${toward(angle - 120, random(160, 340))} scale(1.5)` },
				{ offset: 0.25, opacity: 1 },
				{ opacity: 0, transform: `${toward(angle, ORBIT)} scale(0.6)` },
			],
			{ delay: random(0, 500), duration: random(700, 950), easing: 'cubic-bezier(0.5, 0, 0.2, 1)' },
		);
	}

	/** Flung out from the orbit when the ring closes. */
	function spark({ reach: [near, far], timeline }: Variant): Attachment<HTMLElement> {
		const angle = random(0, 360);
		return play(
			[
				{ opacity: 1, transform: `${toward(angle, ORBIT)} scale(1.8)` },
				{ offset: 0.4, opacity: 1 },
				{ opacity: 0, transform: `${toward(angle + random(-20, 20), random(near, far))} scale(0.4)` },
			],
			{ delay: timeline.burst + random(0, 140), duration: random(900, 1500), easing: 'cubic-bezier(0.1, 0.8, 0.2, 1)', fill: 'forwards' },
		);
	}

	const flash = ({ timeline }: Variant) =>
		play(
			[
				{ opacity: 0, transform: 'scale(0.4)' },
				{ offset: 0.25, opacity: 1 },
				{ opacity: 0, transform: 'scale(2.2)' },
			],
			{ delay: timeline.burst, duration: 900, easing: 'ease-out' },
		);

	/** A wide, faint wash of light behind everything, the one piece that reaches past the stage. */
	const glow = ({ timeline }: Variant) =>
		play(
			[
				{ opacity: 0, transform: 'scale(0.6)' },
				{ offset: 0.2, opacity: 1 },
				{ opacity: 0, transform: 'scale(1.3)' },
			],
			{ delay: timeline.burst - 100, duration: 1400, easing: 'ease-out' },
		);

	const shockwave = ({ timeline }: Variant, { delay, opacity, scale }: Wave) =>
		play([{ opacity, transform: 'scale(1)' }, { opacity: 0, transform: `scale(${scale})` }], {
			delay: timeline.burst + delay,
			duration: 1100,
			easing: 'cubic-bezier(0.1, 0.8, 0.2, 1)',
			fill: 'forwards',
		});

</script>

<script lang="ts">
	import QuarkIcon from '#components/icons/Quark.svelte';
	import Avatar from '#components/ui/Avatar.svelte';
	import { Cloud, Trophy } from '@lucide/svelte';

	interface Props {
		avatar: string | null;
		isNew: boolean;
		name: string;
		/** Called once the sequence has faded out, after the button on a new account. */
		onEnd?: () => void;
	}

	let { avatar, isNew, name, onEnd }: Props = $props();

	const PERKS = [
		{ description: 'Your progress is backed up and follows you to any device.', icon: Cloud, label: 'Saved in the cloud' },
		{ description: 'Your score is ranked against every other player.', icon: Trophy, label: 'On the leaderboard' },
		{ description: 'Earn them from achievements and daily quests, spend them in the Quark Shop.', icon: QuarkIcon, label: 'Quarks' },
	];

	const variant = $derived(VARIANTS[isNew ? 'new' : 'returning']);
	let closing = $state(false);

	/** Children of the root animate too and their `animationend` bubbles up, only the root's own fade out ends the sequence. */
	function handleEnd(event: AnimationEvent) {
		if (event.target === event.currentTarget) onEnd?.();
	}
</script>

<!--
	Everything is positioned and styled in its final state, the keyframes only describe where each piece comes from. Under reduced
	motion those keyframes are dropped, the particles stay hidden and the stage just fades in and out.
-->
<div
	class={['welcome', isNew ? closing && 'closing' : 'timed']}
	onanimationend={handleEnd}
	style:--at-avatar="{variant.timeline.avatar}ms"
	style:--at-out="{variant.timeline.out}ms"
	style:--at-perks="{variant.timeline.perks}ms"
	style:--at-ring="{variant.timeline.ring}ms"
	style:--at-subtitle="{variant.timeline.subtitle}ms"
	style:--at-title="{variant.timeline.title}ms"
>
	<div class="stage relative flex flex-col items-center px-6 text-center">
		<div class="pointer-events-none absolute top-1/2 left-1/2 -z-10 size-160 -translate-1/2 bg-radial-[closest-side] from-black/70 via-black/45 to-transparent"></div>

		<!-- Sized for phones, a desktop screen zooms the animation and the title up, particles included, and the layout below follows. -->
		<div class="hero flex flex-col items-center">
			<div class="relative mb-4 grid size-28 place-items-center">
				{#if variant.glow}
					<div {@attach glow(variant)} class="pointer-events-none absolute -inset-48 -z-10 rounded-full bg-radial-[closest-side] from-accent-500/25 to-transparent opacity-0 motion-reduce:hidden"></div>
				{/if}
				<div {@attach flash(variant)} class="absolute -inset-12 rounded-full bg-radial-[closest-side] from-accent-200/70 via-accent-400/25 to-transparent opacity-0 motion-reduce:hidden"></div>
				{#each variant.waves as wave (wave.delay)}
					<div {@attach shockwave(variant, wave)} class="absolute inset-0 rounded-full border-2 border-accent-300/80 opacity-0 motion-reduce:hidden"></div>
				{/each}
				<span class="avatar">
					<Avatar alt={name} class="size-20" src={avatar} />
				</span>
				<svg aria-hidden="true" class="absolute inset-0 -rotate-90" fill="none" viewBox="0 0 112 112">
					<circle class="ring stroke-accent-400" cx="56" cy="56" r="52" stroke-dasharray="327" stroke-width="1.5" />
				</svg>
				{#each { length: variant.inflow }}
					<span {@attach inflow()} class="dot bg-accent-300 opacity-0"></span>
				{/each}
				{#each { length: variant.sparks }, index}
					<span {@attach spark(variant)} class={['dot opacity-0', index % 3 === 0 ? 'bg-white' : 'bg-accent-300']}></span>
				{/each}
				{#if isNew}
					{#each BEADS as particle (particle.angle)}
						<span {@attach bead(particle)} class="dot bead bg-accent-300" style:transform={toward(particle.angle, ORBIT)}></span>
					{/each}
				{/if}
			</div>

			<h2 class="title max-w-xs text-xl font-bold text-balance break-words text-white">
				{isNew ? `Welcome to the lab, ${name}` : `Welcome back, ${name}`}
			</h2>
			{#if isNew}
				<p class="subtitle mt-1 text-sm text-white/70">Your account is ready, here is what it adds.</p>
			{/if}
		</div>

		{#if isNew}
			<!-- The only part that takes input, the rest of the overlay lets taps through to the game. -->
			<div class="perks pointer-events-auto mt-6 flex w-full max-w-xl flex-col items-center gap-5">
				<ul class="grid w-full gap-3 text-left sm:grid-cols-3 sm:text-center">
					{#each PERKS as perk (perk.label)}
						<li class="flex items-start gap-3 rounded-xl border border-accent-400/20 bg-accent-950/90 px-4 py-3 shadow-xl shadow-black/40 sm:flex-col sm:items-center sm:gap-1.5">
							<perk.icon class="mt-0.5 shrink-0 text-accent/80 sm:mt-0" size={16} />
							<div class="flex flex-col gap-0.5">
								<span class="text-sm font-medium text-white/90">{perk.label}</span>
								<span class="text-xs text-white/55">{perk.description}</span>
							</div>
						</li>
					{/each}
				</ul>
				<button
					class="rounded-xl bg-accent-600 px-6 py-2.5 font-semibold text-white transition-colors hover:bg-accent-500 disabled:opacity-60"
					disabled={closing}
					onclick={() => (closing = true)}
					type="button"
				>
					Let's go
				</button>
			</div>
		{/if}
	</div>
</div>

<style>
	.welcome.timed {
		animation: fade-out 400ms var(--at-out) ease-in forwards;
	}

	.welcome.closing {
		animation: fade-out 400ms ease-in forwards;
	}

	.stage {
		animation: fade-in 250ms ease-out backwards;
	}

	/* `zoom` instead of `scale` so the perks below move down with the bigger hero instead of sitting under it. */
	@media (width >= 48rem) {
		.hero {
			zoom: 1.35;
		}
	}

	@media (width >= 80rem) {
		.hero {
			zoom: 1.6;
		}
	}

	.ring {
		stroke-dashoffset: 0;
	}

	/* Centered on the orbit's middle, every motion is a transform from there. */
	.dot {
		border-radius: 9999px;
		box-shadow: 0 0 6px var(--color-accent-300);
		height: 6px;
		left: 50%;
		margin: -3px 0 0 -3px;
		pointer-events: none;
		position: absolute;
		top: 50%;
		width: 6px;
	}

	.bead {
		opacity: 0.9;
	}

	@media (prefers-reduced-motion: reduce) {
		.dot {
			display: none;
		}
	}

	@media (prefers-reduced-motion: no-preference) {
		.avatar {
			animation: pop 450ms var(--at-avatar) cubic-bezier(0.34, 1.56, 0.64, 1) backwards;
		}

		.ring {
			animation: draw 600ms var(--at-ring) ease-in-out backwards;
		}

		.title {
			animation: rise 400ms var(--at-title) ease-out backwards;
		}

		.subtitle {
			animation: rise 400ms var(--at-subtitle) ease-out backwards;
		}

		.perks {
			animation: rise 500ms var(--at-perks) ease-out backwards;
		}
	}

	@keyframes fade-in {
		from {
			opacity: 0;
		}
	}

	@keyframes fade-out {
		to {
			opacity: 0;
		}
	}

	@keyframes pop {
		from {
			opacity: 0;
			scale: 0.6;
		}
	}

	@keyframes draw {
		from {
			stroke-dashoffset: 327;
		}
	}

	@keyframes rise {
		from {
			opacity: 0;
			translate: 0 6px;
		}
	}
</style>
