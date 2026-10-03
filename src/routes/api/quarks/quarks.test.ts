import { afterAll, beforeEach, describe, expect, mock, setSystemTime, test } from 'bun:test';
import { DAILY_QUEST_COUNT, getDailyCap, pickDailyQuests } from '#data/dailyQuests.js';
import { QUARK_ACHIEVEMENT_REWARD } from '#data/quarkAchievements.js';
import { QUARK_SHOP } from '#data/quarkShop.js';
import { obfuscateClientData } from '#lib/utils/obfuscation.js';

const service = {
	equipBanner: mock(async () => {}),
	equipTheme: mock(async () => ({})),
	getEntitlements: mock(async (): Promise<string[]> => []),
	grantAchievementQuarks: mock(async () => ({ balance: 0, granted: 0 })),
	grantQuarks: mock(async () => ({ balance: 1, status: 'ok' })),
	purchaseItem: mock(async () => ({ balance: 0, status: 'ok' })),
	refundItem: mock(async () => ({ balance: 0, status: 'ok' })),
};

/** The real module opens a Supabase client from private env vars, the routes only need the service and the caller's id. */
mock.module('#lib/server/supabase.server.js', () => ({
	quarksService: service,
	resolveUserFromRequest: async (request: Request) => (request.headers.has('Authorization') ? 'user-1' : null),
}));

const { POST: achievement } = await import('./achievement/+server.js');
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
	for (const fn of Object.values(service)) fn.mockClear();
	service.getEntitlements.mockImplementation(async () => []);
});

afterAll(() => setSystemTime());

test('every route needs a session and an untouched signed payload', async () => {
	expect((await call(purchase, { itemId: 'boost_click_power' }, { auth: false })).status).toBe(401);
	expect((await call(purchase, { itemId: 'boost_click_power' }, { tamper: true })).status).toBe(400);
	expect(service.purchaseItem).not.toHaveBeenCalled();
});

describe('purchase and refund', () => {
	test('the price comes from the shop data, never from the request', async () => {
		const { status } = await call(purchase, { cost: 0, itemId: 'boost_click_power' });
		expect(status).toBe(200);
		expect(service.purchaseItem).toHaveBeenCalledWith('user-1', 'boost_click_power', QUARK_SHOP.boost_click_power.cost);
	});

	test('unknown or malformed items are refused', async () => {
		expect((await call(purchase, { itemId: 'free_quarks' })).status).toBe(400);
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
	test('achievement claims drop unknown ids and pay the server reward', async () => {
		await call(achievement, { achievementIds: ['not_an_achievement', 'reset_modal_opener'], reward: 1e6 });
		expect(service.grantAchievementQuarks).toHaveBeenCalledWith('user-1', ['reset_modal_opener'], QUARK_ACHIEVEMENT_REWARD);
		expect((await call(achievement, { achievementIds: Array.from({ length: 251 }, () => 'reset_modal_opener') })).status).toBe(400);
		expect((await call(achievement, { achievementIds: [1] })).status).toBe(400);
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
