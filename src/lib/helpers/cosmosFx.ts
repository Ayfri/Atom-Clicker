import { COSMOS_OBJECTS_BY_ID } from '#data/cosmos.js';
import { CURRENCIES, CurrenciesTypes } from '#data/currencies.js';
import { AmbientField } from '#helpers/AmbientField.js';
import type { CosmosScene } from '#lib/cosmos/CosmosScene.svelte.js';

/** Same as `--color-cosmos-workshop`, the canvas can't read the CSS variable. */
const WORKSHOP = '#ffd27a';

type Point = { x: number; y: number };

/** Bursts of the Cosmos HUD, drawn on the Cosmos' own ambient field. Imported by components only. */
class CosmosFx {
	canvas: HTMLCanvasElement | null = null;
	scene: CosmosScene | null = null;

	aperture(origin: MouseEvent) {
		AmbientField.emit('cosmos', 'bloom', origin, { color: CURRENCIES[CurrenciesTypes.STARLIGHT].color });
	}

	built() {
		const earth = this.spot('earth');
		if (earth) AmbientField.emit('cosmos', 'bloom', earth, { color: WORKSHOP, count: 16, surge: 6 });
	}

	/** Sparks where a sky object was tapped, the field's own cooldown and mote cap bound a fast tapper. */
	click(id: string, point: Point) {
		AmbientField.emit('cosmos', 'spark', point, { color: COSMOS_OBJECTS_BY_ID[id].color, count: 3 });
	}

	discovery(card: Element, color: string) {
		const { left, top, width } = card.getBoundingClientRect();
		AmbientField.emit('cosmos', 'bloom', { x: left + width / 2, y: top }, { color, count: 18, surge: 8 });
	}

	instrument(origin: MouseEvent) {
		AmbientField.emit('cosmos', 'embers', origin, { color: WORKSHOP, surge: 4, target: this.spot('earth') });
	}

	/** Screen position of a Cosmos object, `undefined` when it is off screen or the Cosmos is closed. */
	spot(id: string): Point | undefined {
		const spot = this.scene?.onScreen().find(object => object.id === id);
		if (!spot || !this.canvas) return undefined;
		const { left, top } = this.canvas.getBoundingClientRect();
		return { x: left + spot.x, y: top + spot.y };
	}

	/** Blooms on the object once its study ends, nothing when it is off screen. */
	study(id: string) {
		const spot = this.spot(id);
		if (spot) AmbientField.emit('cosmos', 'bloom', spot, { color: COSMOS_OBJECTS_BY_ID[id].color, surge: 4 });
	}
}

export const cosmosFx = new CosmosFx();
