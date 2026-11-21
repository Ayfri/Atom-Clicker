import { afterAll, beforeEach, describe, expect, mock, setSystemTime, spyOn, test } from 'bun:test';
import { DAILY_QUEST_COUNT, getDailyCap, pickDailyQuests } from '#data/dailyQuests.js';
import { APP_REWARD_QUARKS, QUARK_ACHIEVEMENT_REWARD } from '#data/quarks.js';
import { QUARK_SHOP } from '#data/quarkShop.js';
import { obfuscateClientData } from '#helpers/obfuscation.js';
import type { ScoreAudit } from '#lib/server/audit/scoreAudit.server.js';

const service = {
	claimAchievementQuarks: mock(async (..._args: unknown[]) => ({ balance: 0, claimed: [] as string[], granted: 0 })),
	equipBanner: mock(async () => {}),
	equipTheme: mock(async () => ({})),
	getEntitlements: mock(async (): Promise<string[]> => []),
	grantQuarks: mock(async () => ({ balance: 1, status: 'ok' })),
	purchaseItem: mock(async () => ({ balance: 0, status: 'ok' })),
	refundItem: mock(async () => ({ balance: 0, status: 'ok' })),
};
const leaderboard = {
	countUsers: mock(async () => 1234),
	getScoreContext: mock(async () => ({ accountCreatedAt: 5, colliderTotal: 7, lastReceivedAt: null, previous: null })),
};
let verdict: Pick<ScoreAudit, 'earnedAchievements' | 'issues'> | 'malformed' | 'outdated' = { earnedAchievements: [], issues: [] };
const auditScore = mock((..._args: unknown[]) => verdict);
const unmocked = () => {
	throw new Error('Only auditScore is mocked in this file');
};

/**
 * The real modules open a Supabase client from private env vars and load the game, the routes only need the services, the audit verdict and the caller's id.
 * Bun keeps one export list per mocked module for the whole run, so every export of the real ones is declared or other test files lose theirs.
 */
mock.module('#lib/server/supabase.server.js', () => ({
	colliderService: {},
	leaderboardService: leaderboard,
	quarksService: service,
	resolveUserFromRequest: async (request: Request) => (request.headers.has('Authorization') ? 'user-1' : null),
	supabaseAdmin: {},
}));
mock.module('#lib/server/audit/scoreAudit.server.js', () => ({ auditScore, inspectScore: unmocked, keptSpending: unmocked, runSpending: unmocked }));

const { POST: achievement } = await import('./achievement/+server.js');
const { POST: appReward } = await import('./app-reward/+server.js');
const { POST: claim } = await import('./claim/+server.js');
const { POST: equipBanner } = await import('./equip-banner/+server.js');
const { POST: equipTheme } = await import('./equip-theme/+server.js');
const { POST: purchase } = await import('./purchase/+server.js');
const { POST: refund } = await import('./refund/+server.js');

/** Route handlers only read `request`, so the rest of the SvelteKit event is left out. */
async function call(handler: (event: never) => Response | Promise<Response>, data: Record<string, unknown>, { auth = true, tamper = false } = {}) {
	const payload = obfuscateClientData(data);
	if (tamper) payload.data = btoa(JSON.stringify({ ...data, extra: 1 }));
	const request = new Request('http://localhost/api', { body: JSON.stringify(payload), headers: auth ? { Authorization: 'Bearer token' } : {}, method: 'POST' });
	const response = await handler({ request } as never);
	return { body: await response.json(), status: response.status };
}

beforeEach(() => {
	for (const fn of [...Object.values(service), ...Object.values(leaderboard), auditScore]) fn.mockClear();
	service.getEntitlements.mockImplementation(async () => []);
	verdict = { earnedAchievements: [], issues: [] };
});

afterAll(() => setSystemTime());

test('every route needs a session and an untouched signed payload', async () => {
	expect((await call(purchase, { itemId: 'boost_click_power' }, { auth: false })).status).toBe(401);
	expect((await call(purchase, { itemId: 'boost_click_power' }, { tamper: true })).status).toBe(400);
	expect(service.purchaseItem).not.toHaveBeenCalled();
});

test('a service that rejects becomes a 500 carrying the route failure message', async () => {
	const error = spyOn(console, 'error').mockImplementation(() => {});
	service.purchaseItem.mockImplementationOnce(async () => {
		throw new Error('database down');
	});
	try {
		expect(await call(purchase, { itemId: 'boost_click_power' })).toEqual({ body: { error: 'Failed to purchase quark item' }, status: 500 });
		expect(error).toHaveBeenCalledTimes(1);
	} finally {
		error.mockRestore();
	}
});

describe('purchase and refund', () => {
	test('the price comes from the shop data, never from the request', async () => {
		const { status } = await call(purchase, { cost: 0, itemId: 'boost_click_power' });
		expect(status).toBe(200);
		expect(service.purchaseItem).toHaveBeenCalledWith('user-1', 'boost_click_power', QUARK_SHOP.boost_click_power.cost);
	});

	test('unknown or malformed items are refused', async () => {
		expect((await call(purchase, { itemId: 'free_quarks' })).status).toBe(400);
		expect((await call(purchase, { itemId: 'constructor' })).status).toBe(400);
		expect((await call(purchase, { itemId: 42 })).status).toBe(400);
		expect(service.purchaseItem).not.toHaveBeenCalled();
	});

	test('themes and banners are never refundable, boosts are', async () => {
		expect((await call(refund, { itemId: 'theme_atoms_amethyst' })).status).toBe(400);
		expect((await call(refund, { itemId: 'banner_up' })).status).toBe(400);
		expect((await call(refund, { itemId: 'boost_click_power' })).status).toBe(200);
		expect(service.refundItem).toHaveBeenCalledTimes(1);
	});
});

describe('cosmetics', () => {
	test('a theme must be owned and belong to the realm it is equipped on', async () => {
		expect((await call(equipTheme, { itemId: 'theme_atoms_amethyst', realmId: 'atoms' })).status).toBe(403);
		service.getEntitlements.mockImplementation(async () => ['theme_atoms_amethyst']);
		expect((await call(equipTheme, { itemId: 'theme_atoms_amethyst', realmId: 'photons' })).status).toBe(400);
		expect((await call(equipTheme, { itemId: 'theme_atoms_amethyst', realmId: 'atoms' })).status).toBe(200);
		expect(service.equipTheme).toHaveBeenCalledTimes(1);
	});

	test('a banner must be owned and be a banner, unequipping needs nothing', async () => {
		expect((await call(equipBanner, { itemId: 'banner_up' })).status).toBe(403);
		service.getEntitlements.mockImplementation(async () => ['theme_atoms_amethyst']);
		expect((await call(equipBanner, { itemId: 'theme_atoms_amethyst' })).status).toBe(400);
		expect((await call(equipBanner, { itemId: null })).status).toBe(200);
		expect(service.equipBanner).toHaveBeenCalledWith('user-1', null);
	});
});

describe('rewards', () => {
	describe('achievement claims', () => {
		const state = { version: 31 };

		test('drop unknown ids and prototype names, and pay the server reward whatever the request says', async () => {
			await call(achievement, { achievementIds: ['not_an_achievement', 'constructor', 'toString', 'reset_modal_opener'], reward: 1e6, state });
			expect(service.claimAchievementQuarks).toHaveBeenCalledWith('user-1', ['reset_modal_opener'], [], QUARK_ACHIEVEMENT_REWARD);
			expect((await call(achievement, { achievementIds: Array.from({ length: 251 }, () => 'reset_modal_opener'), state })).status).toBe(400);
			expect((await call(achievement, { achievementIds: [1], state })).status).toBe(400);
		});

		test('a state that passes the audit hands the achievements it earned to the claim, along with the requested ids', async () => {
			verdict = { earnedAchievements: ['aps_10', 'reset_modal_opener'], issues: [] };
			service.claimAchievementQuarks.mockImplementationOnce(async () => ({ balance: 3, claimed: ['aps_10'], granted: 1 }));
			service.getEntitlements.mockImplementation(async () => ['boost_global_production']);
			expect(await call(achievement, { achievementIds: ['aps_10'], state })).toEqual({ body: { balance: 3, claimed: ['aps_10'], granted: 1 }, status: 200 });
			expect(service.claimAchievementQuarks).toHaveBeenCalledWith('user-1', ['aps_10'], ['aps_10', 'reset_modal_opener'], QUARK_ACHIEVEMENT_REWARD);
			expect(auditScore).toHaveBeenCalledWith(state, expect.objectContaining({ accountCreatedAt: 5, colliderTotal: 7, ownedQuarkItems: ['boost_global_production'], totalUsers: 1234 }));
		});

		test('a payload without a state comes from a tab opened before the update, it is told to reload and nothing is audited', async () => {
			expect(await call(achievement, { achievementIds: ['aps_10'] })).toEqual({ body: { error: 'This game version is outdated, reload the page' }, status: 409 });
			expect(auditScore).not.toHaveBeenCalled();
			expect(service.claimAchievementQuarks).not.toHaveBeenCalled();
		});

		test('a state that fails the audit proves nothing, but the claim still collects what was remembered before', async () => {
			verdict = { earnedAchievements: ['aps_10'], issues: ['production'] };
			expect((await call(achievement, { achievementIds: ['aps_10'], state })).status).toBe(200);
			expect(service.claimAchievementQuarks).toHaveBeenCalledWith('user-1', ['aps_10'], [], QUARK_ACHIEVEMENT_REWARD);
		});

		test('an outdated client reloads and a state that is not a game state is refused, before any claim', async () => {
			verdict = 'outdated';
			expect((await call(achievement, { achievementIds: ['aps_10'], state })).status).toBe(409);
			verdict = 'malformed';
			expect((await call(achievement, { achievementIds: ['aps_10'], state })).status).toBe(400);
			expect(service.claimAchievementQuarks).not.toHaveBeenCalled();
		});

		/** Last of its describe: it fills the player's window, and the clock is moved ahead first so the claims of the tests above are out of it. */
		test('each player gets a few claims per minute, the rest are refused before any audit', async () => {
			setSystemTime(new Date(Date.now() + 120_000));
			for (let claim = 0; claim < 15; claim++) expect((await call(achievement, { achievementIds: ['aps_10'], state })).status).toBe(200);
			expect((await call(achievement, { achievementIds: ['aps_10'], state })).status).toBe(429);
			expect(auditScore).toHaveBeenCalledTimes(15);
			expect(leaderboard.getScoreContext).toHaveBeenCalledTimes(15);
		});
	});

	test('the app reward is one fixed grant per account, whatever the request says', async () => {
		expect((await call(appReward, { delta: 1e6, ref: 'other', reward: 1e6 })).status).toBe(200);
		expect(service.grantQuarks).toHaveBeenCalledWith('user-1', APP_REWARD_QUARKS, 'app_install', 'app_install');
		expect((await call(appReward, {}, { auth: false })).status).toBe(401);
		expect((await call(appReward, {}, { tamper: true })).status).toBe(400);
		expect(service.grantQuarks).toHaveBeenCalledTimes(1);
	});

	test('quest claims are keyed on the UTC day and capped by the day quest count', async () => {
		setSystemTime(new Date('2026-10-03T23:30:00Z'));
		await call(claim, { questId: 'clicks_100' });
		expect(service.grantQuarks).toHaveBeenCalledWith('user-1', 1, 'quest', 'quest:2026-10-03:clicks_100', getDailyCap(pickDailyQuests('2026-10-03', DAILY_QUEST_COUNT)));
		expect((await call(claim, { questId: 'made_up' })).status).toBe(400);
	});

	test('the third quest needs the Third Daily Quest upgrade', async () => {
		expect((await call(claim, { questId: 'complete_other_daily_quests' })).status).toBe(400);
		service.getEntitlements.mockImplementation(async () => ['convenience_third_daily_quest']);
		expect((await call(claim, { questId: 'complete_other_daily_quests' })).status).toBe(200);
	});
});
