import { beforeEach, expect, mock, test } from 'bun:test';
import type { ScoreAudit } from '#lib/server/scoreAudit.server.js';
import type { ScoreContext, ScoreStatus } from '#lib/server/supabase.server.js';
import { obfuscateClientData } from '#lib/utils/obfuscation.js';

const passing: ScoreAudit = {
	atoms: 1e40,
	issues: [],
	level: 120,
	snapshot: { atomsEarnedRun: 1e41, clicksAllTime: 10, clicksRun: 5, electronizes: 0, inGameTime: 1000, ionizes: 0, protonises: 1, runStartedAt: 1, startDate: 1 },
	warnings: [],
};

let verdict: ScoreAudit | 'malformed' | 'outdated' = passing;
let context: ScoreContext = { colliderTotal: 0, lastReceivedAt: null, previous: null };

const service = {
	getLeaderboard: mock(async () => []),
	getScoreContext: mock(async () => context),
	recordScore: mock(async (_userId: string, audit: ScoreAudit): Promise<ScoreStatus> => (audit.issues.length > 0 ? 'rolled_back' : 'valid')),
};
const auditScore = mock(() => verdict);

/**
 * The real modules open a Supabase client and load the game, the route only needs their answers. Bun keeps one export list per
 * mocked module for the whole run, so every export of the real one is declared or other test files lose theirs.
 */
mock.module('#lib/server/supabase.server.js', () => ({
	colliderService: {},
	leaderboardService: service,
	quarksService: {},
	resolveUserFromRequest: async (request: Request) => (request.headers.has('Authorization') ? 'user-1' : null),
	supabaseAdmin: {},
}));
mock.module('#lib/server/scoreAudit.server.js', () => ({ auditScore }));

const { POST } = await import('./+server.js');

async function submit(data: Record<string, unknown>, auth = true) {
	const request = new Request('http://localhost/api/leaderboard', {
		body: JSON.stringify(obfuscateClientData(data)),
		headers: auth ? { Authorization: 'Bearer token' } : {},
		method: 'POST',
	});
	const response = await POST({ request } as never);
	return { body: await response.json(), status: response.status };
}

const payload = { picture: 'https://cdn.example/avatar.png', state: { version: 31 }, username: 'Player' };

beforeEach(() => {
	verdict = passing;
	context = { colliderTotal: 0, lastReceivedAt: null, previous: null };
	service.recordScore.mockClear();
	auditScore.mockClear();
});

test('a passing state is recorded with the score the audit read', async () => {
	expect(await submit(payload)).toEqual({ body: { issues: [], status: 'valid' }, status: 200 });
	expect(service.recordScore).toHaveBeenCalledWith('user-1', passing, 'Player', 'https://cdn.example/avatar.png');
});

test('a failing state is still recorded so the board can roll back', async () => {
	verdict = { ...passing, issues: ['production'] };
	expect(await submit(payload)).toEqual({ body: { issues: ['production'], status: 'rolled_back' }, status: 200 });
});

test('older clients reload, junk and bad profile fields are refused before anything is stored', async () => {
	verdict = 'outdated';
	expect((await submit(payload)).status).toBe(409);
	verdict = 'malformed';
	expect((await submit(payload)).status).toBe(400);
	verdict = passing;
	expect((await submit({ ...payload, username: '' })).status).toBe(400);
	expect((await submit({ ...payload, picture: 'javascript:alert(1)' })).status).toBe(400);
	expect((await submit(payload, false)).status).toBe(401);
	expect(service.recordScore).not.toHaveBeenCalled();
});

test('the throttle reads the stored history, so it holds across Worker isolates', async () => {
	context = { ...context, lastReceivedAt: Date.now() - 5000 };
	const { body, status } = await submit(payload);
	expect(status).toBe(429);
	expect(body.nextUpdateIn).toBeGreaterThan(10);
	expect(auditScore).not.toHaveBeenCalled();
});
