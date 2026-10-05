import { mul } from '#helpers/effects.js';
import type { Effect, EffectStat } from '#lib/types.js';

const CosmosEras = {
	NAKED_EYE: 'naked_eye',
	REFRACTOR: 'refractor',
} as const;

export type CosmosEra = (typeof CosmosEras)[keyof typeof CosmosEras];

export interface CosmosInstrument {
	/** Starlight price, 0 for the instrument the player starts with. */
	cost: number;
	description: string;
	era: CosmosEra;
	id: string;
	name: string;
	year: string;
}

export interface CosmosObject {
	/** Each study level and the discovery itself multiply `boost.stat` by `1 + boost.amount`, additively. */
	boost: { amount: number; label: string; stat: EffectStat };
	color: string;
	discoverer: string;
	era: CosmosEra;
	fact: string;
	/** Part of the sky from the start, never observed. */
	given?: boolean;
	id: string;
	name: string;
	/** Starlight per second at discovery, each study level adds it again. */
	starlight: number;
	year: string;
}

/** Every Ionize adds a quarter of the base Starlight. */
export const IONIZE_STARLIGHT_STEP = 0.25;
/** An Ionize pays this many seconds of Starlight, scaled by how far the reactor went past the ionization line. */
export const IONIZE_FLASH_SECONDS = 600;
const STUDY_COST_GROWTH = 1.5;
/** Seconds of the object's own Starlight the first study costs. */
const STUDY_COST_SECONDS = 30;

export const COSMOS_INSTRUMENTS: CosmosInstrument[] = [
	{ cost: 0, description: 'The planets wander among the fixed stars.', era: CosmosEras.NAKED_EYE, id: 'eye', name: 'Naked eye', year: 'Antiquity' },
	{
		cost: 50_000,
		description: 'Moons around Jupiter, rings around Saturn.',
		era: CosmosEras.REFRACTOR,
		id: 'refractor',
		name: "Galileo's refractor",
		year: '1609',
	},
];

/** In discovery order, which follows the history of astronomy. */
export const COSMOS_OBJECTS: CosmosObject[] = [
	{
		boost: { amount: 0.25, label: 'photon value', stat: 'photon_value' },
		color: '#ffb52e',
		discoverer: 'Everyone',
		era: CosmosEras.NAKED_EYE,
		fact: 'It holds 99.8% of the mass of the Solar System.',
		given: true,
		id: 'sun',
		name: 'Sun',
		starlight: 1,
		year: 'Prehistory',
	},
	{
		boost: { amount: 0.1, label: 'production', stat: 'global' },
		color: '#4f8fd6',
		discoverer: 'Everyone',
		era: CosmosEras.NAKED_EYE,
		fact: 'The only world known to carry life.',
		given: true,
		id: 'earth',
		name: 'Earth',
		starlight: 1,
		year: 'Prehistory',
	},
	{
		boost: { amount: 0.25, label: 'click power', stat: 'click' },
		color: '#c9ccd6',
		discoverer: 'Prehistoric skywatchers',
		era: CosmosEras.NAKED_EYE,
		fact: 'It drifts 3.8 cm farther from the Earth every year.',
		id: 'moon',
		name: 'Moon',
		starlight: 2,
		year: 'Prehistory',
	},
	{
		boost: { amount: 0.25, label: 'XP', stat: 'xp_gain' },
		color: '#a39a90',
		discoverer: 'Babylonian astronomers',
		era: CosmosEras.NAKED_EYE,
		fact: 'Its year lasts 88 days, but one sunrise to the next takes 176.',
		id: 'mercury',
		name: 'Mercury',
		starlight: 4,
		year: 'Antiquity',
	},
	{
		boost: { amount: 0.25, label: 'power-up duration', stat: 'power_up_duration' },
		color: '#e8cf9a',
		discoverer: 'Babylonian astronomers',
		era: CosmosEras.NAKED_EYE,
		fact: 'Its clouds trap so much heat that it is hotter than Mercury.',
		id: 'venus',
		name: 'Venus',
		starlight: 8,
		year: 'Antiquity',
	},
	{
		boost: { amount: 0.25, label: 'Protons', stat: 'proton_gain' },
		color: '#ffb08a',
		discoverer: 'Babylonian astronomers',
		era: CosmosEras.NAKED_EYE,
		fact: 'Its red comes from iron oxide dust covering the whole surface.',
		id: 'mars',
		name: 'Mars',
		starlight: 16,
		year: 'Antiquity',
	},
	{
		boost: { amount: 0.1, label: 'production', stat: 'global' },
		color: '#d9a877',
		discoverer: 'Babylonian astronomers',
		era: CosmosEras.NAKED_EYE,
		fact: 'It weighs more than twice all the other planets put together.',
		id: 'jupiter',
		name: 'Jupiter',
		starlight: 40,
		year: 'Antiquity',
	},
	{
		boost: { amount: 0.25, label: 'Electrons', stat: 'electron_gain' },
		color: '#e6d39c',
		discoverer: 'Babylonian astronomers',
		era: CosmosEras.NAKED_EYE,
		fact: 'It is so light that, on average, it is less dense than water.',
		id: 'saturn',
		name: 'Saturn',
		starlight: 100,
		year: 'Antiquity',
	},
	{
		boost: { amount: 0.25, label: 'click power', stat: 'click' },
		color: '#e8d46a',
		discoverer: 'Galileo Galilei',
		era: CosmosEras.REFRACTOR,
		fact: 'The most volcanic world in the Solar System.',
		id: 'io',
		name: 'Io',
		starlight: 250,
		year: '1610',
	},
	{
		boost: { amount: 0.25, label: 'XP', stat: 'xp_gain' },
		color: '#d8c8b0',
		discoverer: 'Galileo Galilei',
		era: CosmosEras.REFRACTOR,
		fact: 'An ocean of liquid water lies under its ice shell.',
		id: 'europa',
		name: 'Europa',
		starlight: 600,
		year: '1610',
	},
	{
		boost: { amount: 0.1, label: 'production', stat: 'global' },
		color: '#9c8f80',
		discoverer: 'Galileo Galilei',
		era: CosmosEras.REFRACTOR,
		fact: 'The largest moon in the Solar System, wider than Mercury.',
		id: 'ganymede',
		name: 'Ganymede',
		starlight: 1500,
		year: '1610',
	},
	{
		boost: { amount: 0.25, label: 'Stability Field capacity', stat: 'stability_capacity' },
		color: '#6f675e',
		discoverer: 'Galileo Galilei',
		era: CosmosEras.REFRACTOR,
		fact: 'One of the most heavily cratered surfaces known.',
		id: 'callisto',
		name: 'Callisto',
		starlight: 4000,
		year: '1610',
	},
	{
		boost: { amount: 0.25, label: 'photon value', stat: 'photon_value' },
		color: '#e0a64a',
		discoverer: 'Christiaan Huygens',
		era: CosmosEras.REFRACTOR,
		fact: 'The only moon with a thick atmosphere, denser than the Earth’s.',
		id: 'titan',
		name: 'Titan',
		starlight: 10_000,
		year: '1655',
	},
	{
		boost: { amount: 0.25, label: 'power-up strength', stat: 'power_up_multiplier' },
		color: '#d9cfb8',
		discoverer: 'Christiaan Huygens',
		era: CosmosEras.REFRACTOR,
		fact: 'Mostly water ice, hundreds of thousands of km wide yet often about ten meters thick.',
		id: 'saturn_rings',
		name: "Saturn's rings",
		starlight: 25_000,
		year: '1659',
	},
];

export const COSMOS_OBJECTS_BY_ID = Object.fromEntries(COSMOS_OBJECTS.map(object => [object.id, object]));

export const ionizeStarlightMultiplier = (ionizes: number): number => 1 + IONIZE_STARLIGHT_STEP * ionizes;

export const studyCost = (object: CosmosObject, level: number): number => object.starlight * STUDY_COST_SECONDS * STUDY_COST_GROWTH ** level;

/** Discovery counts as the first step, so a freshly discovered object already boosts its stat. */
export const cosmosEffects = (object: CosmosObject, level: number): Effect[] => [mul(object.boost.stat, 1 + object.boost.amount * (level + 1))];
