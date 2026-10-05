-- Trigger functions only run from their triggers, which never check EXECUTE, so nobody needs to call them through /rest/v1/rpc.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

-- A fixed search_path stops a caller from shadowing the tables or functions these bodies reference.
alter function public.get_leaderboard(integer) set search_path = public;
alter function public.get_secret(text) set search_path = public;
alter function public.handle_new_user() set search_path = public;
alter function public.send_discord_daily_recap() set search_path = public;
alter function public.send_error_to_discord() set search_path = public;
alter function public.update_profile_stats(uuid, text, integer, text, text) set search_path = public;

-- Only the server reads these tables, with the service role, so the client roles neither query them nor see them in the GraphQL schema.
revoke all on public.collider_players, public.collider_total, public.error_logs, public.leaderboard_backup_20260915, public.player_entitlements,
	public.player_quarks, public.quark_ledger from anon, authenticated;
