import type { CurrencyName } from '#data/currencies.js';
import type { GeneratorType } from '#data/generators.js';
import type { RealmType } from '#data/realms.js';

export interface LeaderboardEntry {
    atoms: number;
    equippedBanner?: string | null;
    lastSeen: number;
    level: number;
    is_online?: boolean;
    picture?: string;
    rank: number;
    self?: boolean;
    userId?: string;
    username: string;
}

/** Play stats read from a player's cloud save, `stats` is null when they never uploaded one. */
export interface PublicProfile {
    joinedAt: number | null;
    stats: PublicProfileStats | null;
}

export interface PublicProfileStats {
    /** Raw ids, counted against the client's achievement list so removed ones never inflate the total. */
    achievements: string[];
    clicks: number;
    electronizes: number;
    generators: Partial<Record<GeneratorType, number>>;
    highestAPS: number;
    ionizes: number;
    lifetime: Partial<Record<CurrencyName, number>>;
    playTime: number;
    protonizes: number;
    realms: RealmType[];
    skills: string[];
}
