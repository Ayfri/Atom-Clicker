import { COSMOS_INSTRUMENTS, COSMOS_OBJECTS, type CosmosInstrument, SPECTROSCOPE_ID } from '#data/cosmos.js';
import { ELEMENTS } from '#data/elements.js';
import { CHAINS, SITE_IDS, SITES, type SiteId } from '#data/sites.js';

/** A chain step that waits for a Cosmos object, `z` is the element it forges. */
export interface TableStep {
	site: SiteId;
	z: number;
}

export interface TableLinks {
	/** Sources the discovery opens. */
	sites: SiteId[];
	/** Chain steps the discovery unblocks in sources that are already open. */
	steps: TableStep[];
	/** The instrument is the Spectroscope, which opens the Periodic Table itself. */
	table: boolean;
}

const LIST = new Intl.ListFormat('en');

const eraObjects = (instrument: CosmosInstrument) => COSMOS_OBJECTS.filter(object => object.era === instrument.era);

export function objectLinks(objectId: string): TableLinks {
	return {
		sites: SITE_IDS.filter(id => SITES[id].object === objectId),
		steps: SITE_IDS.flatMap(site =>
			Object.entries(CHAINS[site].seeds)
				.filter(([, seed]) => seed.object === objectId)
				.map(([z]) => ({ site, z: Number(z) })),
		),
		table: false,
	};
}

/** An instrument brings the objects of its era, the Aperture never reaches a later era before the instrument is built. */
export function instrumentLinks(instrumentId: string): TableLinks {
	const instrument = COSMOS_INSTRUMENTS.find(item => item.id === instrumentId);
	const links = instrument ? eraObjects(instrument).map(object => objectLinks(object.id)) : [];
	return { sites: links.flatMap(link => link.sites), steps: links.flatMap(link => link.steps), table: instrumentId === SPECTROSCOPE_ID };
}

export const hasSourceLinks = (links: TableLinks): boolean => links.sites.length > 0 || links.steps.length > 0;

/**
 * `line` is third person with symbols ("opens Cosmic rays", "lets the Big Bang forge Li"), `toast` an infinitive with element names ("open Cosmic rays").
 * The Table itself is not part of it, `links.table` is read by the caller.
 */
export function unlockPhrase(links: TableLinks, mode: 'line' | 'toast'): string {
	const line = mode === 'line';
	const bySite = Map.groupBy(links.steps, step => step.site);
	return LIST.format([
		...(links.sites.length ? [`${line ? 'opens' : 'open'} ${LIST.format(links.sites.map(id => SITES[id].name))}`] : []),
		...[...bySite].map(([site, steps]) => {
			const forged = steps.map(step => (line ? ELEMENTS[step.z - 1].symbol : ELEMENTS[step.z - 1].name.toLowerCase()));
			return `${line ? 'lets' : 'let'} the ${SITES[site].name} forge ${LIST.format(forged)}`;
		}),
	]);
}

/** The toast sentence when an instrument is built, `null` when none of its objects leads to the Table. */
export function instrumentReadyMessage(instrument: CosmosInstrument): string | null {
	const parts = eraObjects(instrument).flatMap(object => {
		const links = objectLinks(object.id);
		return hasSourceLinks(links) ? [`discover ${object.name} to ${unlockPhrase(links, 'toast')}`] : [];
	});
	if (!parts.length) return null;
	const sentence = `${LIST.format(parts)} in the Periodic Table.`;
	return sentence[0].toUpperCase() + sentence.slice(1);
}
