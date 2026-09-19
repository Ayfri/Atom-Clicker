import { createClient } from '@supabase/supabase-js'
import type { Database } from '$lib/types/supabase'
import { PUBLIC_SUPABASE_URL } from '$env/static/public'
import { SUPABASE_SECRET_KEY } from '$env/static/private'

export const supabaseAdmin = createClient<Database>(PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY, {
	auth: {
		autoRefreshToken: false,
		persistSession: false
	}
})

/** The caller's identity comes from their session token only: user ids are public in the leaderboard, so a payload-supplied one is worthless. */
export async function resolveUserFromRequest(request: Request): Promise<string | null> {
	const authHeader = request.headers.get('Authorization');
	if (!authHeader) return null;

	const token = authHeader.replace('Bearer ', '');
	const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
	if (error || !user) return null;

	return user.id;
}

export const leaderboardService = {
	async getLeaderboard(limit: number = 1000) {
		const { data, error } = await supabaseAdmin.rpc('get_leaderboard', {
			p_limit: limit
		});

		if (error) {
			console.error('Error fetching leaderboard:', error);
			throw error;
		}

		return data;
	},

	async updateProfileStats(
		userId: string,
		atoms: number,
		level: number,
		username?: string,
		picture?: string
	) {
		const atomsString = atoms.toString();

		const { error } = await supabaseAdmin.rpc('update_profile_stats', {
			p_user_id: userId,
			p_atoms: atomsString,
			p_level: level,
			p_username: username,
			p_picture: picture
		});

		if (error) {
			console.error('Error updating profile stats:', error);
			throw error;
		}
	},

	async getProfile(userId: string) {
		const { data, error } = await supabaseAdmin
			.from('profiles')
			.select('*')
			.eq('id', userId)
			.single()

		if (error && error.code !== 'PGRST116') {
			// PGRST116 is "not found" error, which is expected for new users
			console.error('Error fetching profile:', error)
			throw error
		}

		return data
	}
}

interface QuarkGrantResult {
	balance: number;
	status: 'already_claimed' | 'cap_reached' | 'ok';
}

interface QuarkPurchaseResult {
	balance: number;
	status: 'already_owned' | 'insufficient_balance' | 'ok';
}

interface QuarkRefundResult {
	balance: number;
	refunded?: number;
	status: 'no_purchase_record' | 'not_owned' | 'ok';
}

/** Every write goes through these RPCs so the daily cap, idempotency and refund-at-paid-price rules stay atomic in Postgres. */
export const quarksService = {
	async grantAchievementQuarks(userId: string, achievementIds: string[], reward: number): Promise<{ balance: number; granted: number }> {
		const { data, error } = await supabaseAdmin.rpc('grant_achievement_quarks', {
			p_achievement_ids: achievementIds,
			p_reward: reward,
			p_user_id: userId,
		});

		if (error) {
			console.error('Error granting achievement quarks:', error);
			throw error;
		}

		return data as unknown as { balance: number; granted: number };
	},

	async grantQuarks(userId: string, delta: number, reason: string, ref: string, dailyCap?: number): Promise<QuarkGrantResult> {
		const { data, error } = await supabaseAdmin.rpc('grant_quarks', {
			p_user_id: userId,
			p_delta: delta,
			p_reason: reason,
			p_ref: ref,
			p_daily_cap: dailyCap,
		});

		if (error) {
			console.error('Error granting quarks:', error);
			throw error;
		}

		return data as unknown as QuarkGrantResult;
	},

	async purchaseItem(userId: string, itemId: string, cost: number): Promise<QuarkPurchaseResult> {
		const { data, error } = await supabaseAdmin.rpc('purchase_quark_item', {
			p_user_id: userId,
			p_item_id: itemId,
			p_cost: cost,
		});

		if (error) {
			console.error('Error purchasing quark item:', error);
			throw error;
		}

		return data as unknown as QuarkPurchaseResult;
	},

	async refundItem(userId: string, itemId: string): Promise<QuarkRefundResult> {
		const { data, error } = await supabaseAdmin.rpc('refund_quark_item', {
			p_user_id: userId,
			p_item_id: itemId,
		});

		if (error) {
			console.error('Error refunding quark item:', error);
			throw error;
		}

		return data as unknown as QuarkRefundResult;
	},

	async getBalance(userId: string) {
		const { data, error } = await supabaseAdmin
			.from('player_quarks')
			.select('*')
			.eq('user_id', userId)
			.maybeSingle();

		if (error) {
			console.error('Error fetching quark balance:', error);
			throw error;
		}

		return data;
	},

	async getEntitlements(userId: string) {
		const { data, error } = await supabaseAdmin
			.from('player_entitlements')
			.select('item_id')
			.eq('user_id', userId);

		if (error) {
			console.error('Error fetching entitlements:', error);
			throw error;
		}

		return (data ?? []).map(row => row.item_id);
	},

	async getClaimedAchievementIds(userId: string) {
		const { data, error } = await supabaseAdmin
			.from('quark_ledger')
			.select('ref')
			.eq('user_id', userId)
			.eq('reason', 'achievement');

		if (error) {
			console.error('Error fetching claimed achievements:', error);
			throw error;
		}

		return (data ?? []).map(row => row.ref.replace('achievement:', ''));
	},

	async getClaimedQuestIds(userId: string, dayKey: string) {
		const dayStart = new Date(`${dayKey}T00:00:00.000Z`).toISOString();
		const { data, error } = await supabaseAdmin
			.from('quark_ledger')
			.select('ref')
			.eq('user_id', userId)
			.eq('reason', 'quest')
			.gte('created_at', dayStart);

		if (error) {
			console.error('Error fetching claimed quests:', error);
			throw error;
		}

		return (data ?? []).map(row => row.ref.split(':').slice(2).join(':'));
	},

	async equipBanner(userId: string, itemId: string | null) {
		const { error } = await supabaseAdmin
			.from('profiles')
			.update({ equipped_banner: itemId })
			.eq('id', userId);

		if (error) {
			console.error('Error equipping banner:', error);
			throw error;
		}
	},

	async getEquippedThemes(userId: string): Promise<Record<string, string>> {
		const { data, error } = await supabaseAdmin
			.from('profiles')
			.select('equipped_themes')
			.eq('id', userId)
			.maybeSingle();

		if (error) {
			console.error('Error fetching equipped themes:', error);
			throw error;
		}

		return (data as { equipped_themes?: Record<string, string> } | null)?.equipped_themes ?? {};
	},

	// Read-modify-write on a small per-user jsonb map -
	// cosmetic preferences don't need the row-lock/RPC treatment the balance-affecting Quark ops get.
	async equipTheme(userId: string, realmId: string, itemId: string | null): Promise<Record<string, string>> {
		const current = await this.getEquippedThemes(userId);
		const next = { ...current };
		if (itemId) next[realmId] = itemId;
		else delete next[realmId];

		const { error } = await supabaseAdmin
			.from('profiles')
			.update({ equipped_themes: next })
			.eq('id', userId);

		if (error) {
			console.error('Error equipping theme:', error);
			throw error;
		}

		return next;
	},
}
