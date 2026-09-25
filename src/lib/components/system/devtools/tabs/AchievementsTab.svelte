<script lang="ts">
	import { ACHIEVEMENTS } from '$data/achievements';
	import { gameManager } from '$helpers/GameManager.svelte';
	import ToggleGrid from '../ToggleGrid.svelte';

	const achievements = Object.values(ACHIEVEMENTS);
</script>

<p class="mb-2 text-[11px] text-white/35">Toggling writes the list directly, without the unlock toast or the daily quest count.</p>
<ToggleGrid items={achievements} onChange={owned => (gameManager.achievements = owned)} owned={gameManager.achievements} />
