import { dev } from '$app/env';
import type { RequestHandler } from './$types';
import { planAuditFixes } from '#lib/server/auditFixes.server.js';
import { readJsonBody } from '#lib/server/requestBody.server.js';
import type { DevAuditRequest, DevAuditResponse } from '#lib/types/audit.js';

const MAX_BODY_BYTES = 1024 * 1024;

const num = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0);

/** Dev only: runs the leaderboard audit on the local game state as a first submission, without auth or database. */
export const POST: RequestHandler = async ({ request }) => {
	if (!dev) return new Response(null, { status: 404 });

	const read = await readJsonBody(request, MAX_BODY_BYTES);
	if ('error' in read) return read.error;

	const { colliderTotal, state, totalUsers } = (read.body ?? {}) as Partial<DevAuditRequest>;
	const startDate = (state as { startDate?: unknown } | null)?.startDate;
	const result = planAuditFixes(state, {
		accountCreatedAt: typeof startDate === 'number' ? startDate : null,
		colliderTotal: num(colliderTotal),
		now: Date.now(),
		previous: null,
		totalUsers: num(totalUsers),
	});

	return Response.json((typeof result === 'string' ? { status: result } : { status: 'checked', ...result }) satisfies DevAuditResponse);
};
