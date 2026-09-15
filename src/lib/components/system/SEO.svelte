<script>
	import { PUBLIC_SUPABASE_URL } from '$env/static/public';
	import { VERSION } from "@sveltejs/kit";

	const site = 'https://atom-clicker.ayfri.com';
	const name = 'Atom Clicker';
	const author = 'Ayfri';
	const description =
		'Atom Clicker is a free incremental game. Click atoms, buy upgrades and buildings, prestige through protons, electrons and photons, and climb the leaderboard.';
	const absoluteImageLink = `${site}/currencies/atom.svg`;
	const absoluteOgImageLink = `${site}/ingame-screenshot.png`;

	const structuredData = {
		'@context': 'https://schema.org',
		'@type': 'Game',
		name: name,
		author: {
			'@type': 'Person',
			name: author,
		},
		description: description,
		url: site,
		image: absoluteOgImageLink,
		genre: ['Incremental', 'Clicker', 'Idle'],
		operatingSystem: 'All',
		publisher: author,
		sourceOrganization: {
			'@type': 'Organization',
			name: author,
			url: site,
		},
	};
</script>

<svelte:head>
	<!-- Auth and quarks both hit Supabase right after mount, so the TLS handshake starts during HTML parse. -->
	<link rel="preconnect" href={PUBLIC_SUPABASE_URL} crossorigin="anonymous" />
	<meta lang="en" />
	<meta name="description" content={description} />
	<meta
		name="keywords"
		content="atom clicker,incremental game,clicker game,idle game,free online game,browser game,prestige game,atom game,physics game,particle clicker"
	/>
	<meta name="author" content={author} />
	<meta name="viewport" content="width=device-width, initial-scale=1.0" />
	<meta name="generator" content={`SvelteKit ${VERSION}`} />
	<meta name="theme-color" content="#4a90e2" />

	<link rel="icon" type="image/svg+xml" href={absoluteImageLink} />

	<meta property="og:title" content={name} />
	<meta property="og:description" content={description} />
	<meta property="og:image" content={absoluteOgImageLink} />
	<meta property="og:image:width" content="1216" />
	<meta property="og:image:height" content="860" />
	<meta property="og:image:alt" content={`${name} gameplay screenshot`} />
	<meta property="og:url" content={site} />
	<meta property="og:type" content="website" />
	<meta property="og:site_name" content={name} />

	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:creator" content={author} />
	<meta name="twitter:site" content={site} />
	<meta name="twitter:title" content={name} />
	<meta name="twitter:description" content={description} />
	<meta name="twitter:image" content={absoluteOgImageLink} />

	<meta name="canonical" content={site} />
	<meta name="robots" content="index, follow" />
	<meta name="language" content="en" />

	<title>{name}</title>

	{@html `<script type="application/ld+json">${JSON.stringify(structuredData)}</script>`}
</svelte:head>
