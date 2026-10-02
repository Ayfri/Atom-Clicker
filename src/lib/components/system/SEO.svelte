<script>
	import { page } from '$app/state';
	import { PUBLIC_SUPABASE_URL } from '$app/env/public';
	import { VERSION } from "@sveltejs/kit";

	const site = 'https://atom-clicker.ayfri.com';
	const name = 'Atom Clicker';
	const author = 'Ayfri';
	const description =
		'Atom Clicker is a free incremental game. Click atoms, buy upgrades and generators, prestige through protons, electrons and photons, and climb the leaderboard.';
	/** Images come from the serving origin, so a preview deploy links its own assets rather than the ones live on the main site. */
	const absoluteImageLink = `${page.url.origin}/currencies/atom.svg`;
	const absoluteOgImageLink = `${page.url.origin}/og-image.png`;

	const creator = {
		'@type': 'Person',
		alternateName: 'Pierre Roy',
		image: 'https://ayfri.com/images/avatar.png',
		jobTitle: 'Software Engineer',
		name: author,
		sameAs: ['https://github.com/Ayfri', 'https://www.linkedin.com/in/pierre-roy-ayfri/', 'https://www.twitch.tv/ayfri_', 'https://x.com/Ayfri_'],
		url: 'https://ayfri.com',
	};

	const structuredData = {
		'@context': 'https://schema.org',
		'@type': 'VideoGame',
		applicationCategory: 'GameApplication',
		author: creator,
		description,
		gamePlatform: 'Web browser',
		genre: ['Incremental', 'Clicker', 'Idle'],
		image: absoluteOgImageLink,
		inLanguage: 'en',
		isAccessibleForFree: true,
		name,
		offers: { '@type': 'Offer', price: 0, priceCurrency: 'USD' },
		operatingSystem: 'Any',
		playMode: 'SinglePlayer',
		publisher: creator,
		url: site,
	};
</script>

<svelte:head>
	<!-- Auth and quarks both hit Supabase right after mount, so the TLS handshake starts during HTML parse. -->
	<link rel="preconnect" href={PUBLIC_SUPABASE_URL} crossorigin="anonymous" />
	<meta name="description" content={description} />
	<meta
		name="keywords"
		content="atom clicker,incremental game,clicker game,idle game,free online game,browser game,prestige game,atom game,physics game,particle clicker"
	/>
	<meta name="author" content={author} />
	<meta name="generator" content={`SvelteKit ${VERSION}`} />
	<meta name="theme-color" content="#1a1a1a" />

	<link rel="icon" type="image/svg+xml" href={absoluteImageLink} />
	<!-- iOS ignores manifest icons and SVG touch icons, it screenshots the page instead -->
	<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
	<link rel="manifest" href="/manifest.webmanifest" />

	<meta property="og:title" content={name} />
	<meta property="og:description" content={description} />
	<meta property="og:image" content={absoluteOgImageLink} />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta property="og:image:alt" content={`${name}, a free incremental game with a glowing 3D atom`} />
	<meta property="og:url" content={site} />
	<meta property="og:type" content="website" />
	<meta property="og:site_name" content={name} />

	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:creator" content="@Ayfri_" />
	<meta name="twitter:site" content="@Ayfri_" />
	<meta name="twitter:title" content={name} />
	<meta name="twitter:description" content={description} />
	<meta name="twitter:image" content={absoluteOgImageLink} />

	<link rel="canonical" href={site} />
	<meta name="robots" content="index, follow" />

	<title>{name}</title>

	{@html `<script type="application/ld+json">${JSON.stringify(structuredData)}</script>`}
</svelte:head>
