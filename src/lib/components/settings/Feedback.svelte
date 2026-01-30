<script lang="ts">
	import Discord from '@components/icons/Discord.svelte';
	import GitHub from '@components/icons/GitHub.svelte';
	import { supabaseAuth } from '$stores/supabaseAuth.svelte';

	// Generate the Tally URL with email parameter if user is logged in
	const tallyUrl = $derived.by(() => {
		const baseUrl = 'https://tally.so/embed/mO8OxM';
		const params = new URLSearchParams({
			'align-left': '1',
			'transparent-background': '1',
		});

		if (supabaseAuth.user?.email) {
			params.set('email', supabaseAuth.user.email);
		}

		return `${baseUrl}?${params.toString()}`;
	});
</script>

<div class="flex flex-col gap-2 h-full p-4">
    <div class="flex items-center justify-end gap-2 mb-1">
        <span class="text-white/40 text-sm mr-auto font-medium">Have something to say?</span>
        <a
            href="https://discord.ayfri.com"
            target="_blank"
            rel="noopener noreferrer"
            class="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 transition-all border border-blue-500/20 text-sm font-medium"
            title="Chat with us on Discord"
        >
            <Discord size={16} />
            <span>Discord</span>
        </a>
        <a
            href="https://github.com/Ayfri/Atom-Clicker"
            target="_blank"
            rel="noopener noreferrer"
            class="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all border border-white/10 text-sm font-medium"
            title="Post an issue on GitHub"
        >
            <GitHub size={16} />
            <span>GitHub</span>
        </a>
    </div>
    <div class="flex-1 min-h-[600px] rounded-xl overflow-hidden border border-white/5 shadow-inner bg-[#161b21] flex justify-center">
        <div class="w-full max-w-[700px] h-full pt-12">
            <iframe
                src={tallyUrl}
                class="w-full h-full"
                title="Feedback Form"
            ></iframe>
        </div>
    </div>
</div>
