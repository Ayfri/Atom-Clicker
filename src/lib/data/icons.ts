import type { Component } from 'svelte';
import { CurrenciesTypes, type CurrencyName } from '$data/currencies';
import { GeneratorTypes, type GeneratorType } from '$data/generators';
import AtomIcon from '@components/icons/Atom.svelte';
import DiscordIcon from '@components/icons/Discord.svelte';
import ElectronIcon from '@components/icons/Electron.svelte';
import ExcitedPhotonIcon from '@components/icons/ExcitedPhoton.svelte';
import BlackHoleIcon from '@components/icons/generators/BlackHole.svelte';
import CrystalIcon from '@components/icons/generators/Crystal.svelte';
import MicroorganismIcon from '@components/icons/generators/Microorganism.svelte';
import MoleculeIcon from '@components/icons/generators/Molecule.svelte';
import NanostructureIcon from '@components/icons/generators/Nanostructure.svelte';
import NeutronStarIcon from '@components/icons/generators/NeutronStar.svelte';
import PlanetIcon from '@components/icons/generators/Planet.svelte';
import RockIcon from '@components/icons/generators/Rock.svelte';
import StarIcon from '@components/icons/generators/Star.svelte';
import GitHubIcon from '@components/icons/GitHub.svelte';
import HiggsBosonIcon from '@components/icons/HiggsBoson.svelte';
import PhotonIcon from '@components/icons/Photon.svelte';
import ProtonIcon from '@components/icons/Proton.svelte';
import QuarkIcon from '@components/icons/Quark.svelte';
import { Activity, ArrowBigUp, Award, Clock, Coffee, Factory, FileText, Gauge, Globe, Layers, Milestone, MousePointerClick, Network, Radiation, Sparkles, TrendingUp, Trophy, Zap } from '@lucide/svelte';

/** Every icon component in the game accepts at least these two props, which is all `IconStack` needs. */
export type IconComponent = Component<{ color?: string; size?: number }>;

/**
 * Single registry of every icon that can be referenced by name (in game data, achievements, tutorials, ...)
 * instead of by import. Keeping it flat and string-keyed is what lets static data files describe an icon
 * without importing Svelte components.
 */
export const ICONS = {
	atom: AtomIcon,
	award: Award,
	blackHole: BlackHoleIcon,
	changelog: FileText,
	click: MousePointerClick,
	coffee: Coffee,
	crystal: CrystalIcon,
	discord: DiscordIcon,
	electron: ElectronIcon,
	excitedPhoton: ExcitedPhotonIcon,
	generatorLevel: Factory,
	github: GitHubIcon,
	globe: Globe,
	higgsBoson: HiggsBosonIcon,
	layers: Layers,
	level: ArrowBigUp,
	microorganism: MicroorganismIcon,
	milestone: Milestone,
	molecule: MoleculeIcon,
	nanostructure: NanostructureIcon,
	neutronStar: NeutronStarIcon,
	offline: Clock,
	photon: PhotonIcon,
	planet: PlanetIcon,
	proton: ProtonIcon,
	quark: QuarkIcon,
	radiation: Radiation,
	rock: RockIcon,
	skillTreeMaster: Network,
	speed: Gauge,
	sparkles: Sparkles,
	stabilityMeter: Activity,
	star: StarIcon,
	trendingUp: TrendingUp,
	trophy: Trophy,
	upgrade: Zap,
} as const satisfies Record<string, IconComponent>;

export type IconName = keyof typeof ICONS;

export const CURRENCY_ICON_NAMES: Record<CurrencyName, IconName> = {
	[CurrenciesTypes.ATOMS]: 'atom',
	[CurrenciesTypes.ELECTRONS]: 'electron',
	[CurrenciesTypes.EXCITED_PHOTONS]: 'excitedPhoton',
	[CurrenciesTypes.HIGGS_BOSON]: 'higgsBoson',
	[CurrenciesTypes.PHOTONS]: 'photon',
	[CurrenciesTypes.PROTONS]: 'proton',
};

export const GENERATOR_ICON_NAMES: Record<GeneratorType, IconName> = {
	[GeneratorTypes.BLACK_HOLE]: 'blackHole',
	[GeneratorTypes.CRYSTAL]: 'crystal',
	[GeneratorTypes.MICROORGANISM]: 'microorganism',
	[GeneratorTypes.MOLECULE]: 'molecule',
	[GeneratorTypes.NANOSTRUCTURE]: 'nanostructure',
	[GeneratorTypes.NEUTRON_STAR]: 'neutronStar',
	[GeneratorTypes.PLANET]: 'planet',
	[GeneratorTypes.ROCK]: 'rock',
	[GeneratorTypes.STAR]: 'star',
};
