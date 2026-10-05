-- RLS policies read auth.uid() through a subquery so Postgres evaluates it once per query instead of once per row.

alter policy "Users can update own profile" on public.profiles using ((select auth.uid()) = id);
alter policy player_entitlements_select_own on public.player_entitlements using ((select auth.uid()) = user_id);
alter policy player_quarks_select_own on public.player_quarks using ((select auth.uid()) = user_id);
alter policy quark_ledger_select_own on public.quark_ledger using ((select auth.uid()) = user_id);

-- "Public profiles viewable" already lets everyone read every row, this one only added a second policy check to each read.
drop policy if exists "Users can view own profile" on public.profiles;

-- The service role bypasses RLS, so this policy never granted anything and only cost a check per row.
drop policy if exists "Service role full access" on public.error_logs;

-- Never scanned, and the heartbeat rewrites updated_at on every tick, which keeps these indexes from allowing HOT updates.
drop index if exists public.idx_profiles_updated_at;
drop index if exists public.profiles_created_at_idx;
drop index if exists public.profiles_last_updated_idx;
