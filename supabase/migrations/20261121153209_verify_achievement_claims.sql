-- An achievement Quark is only paid for an achievement the server saw earned: its condition held on a game state that passed the
-- leaderboard audit. Atoms per second, level, generator and reactor tiers stop holding after a prestige, so the server remembers every
-- achievement it saw earned, from each passing leaderboard submission and from the state a claim sends.

create table if not exists public.verified_achievements (
	user_id uuid not null references public.profiles(id) on delete cascade,
	achievement_id text not null,
	verified_at timestamptz not null default now(),
	primary key (user_id, achievement_id)
);

-- Everything goes through the service role, which bypasses RLS, so no policy is defined on purpose.
alter table public.verified_achievements enable row level security;
revoke all on public.verified_achievements from anon, authenticated;

create or replace function public.remember_achievements(p_user_id uuid, p_achievement_ids text[]) returns void
language sql
security definer
set search_path = public
as $$
	insert into verified_achievements (user_id, achievement_id)
	select p_user_id, achievement_id from unnest(p_achievement_ids) as achievement_id
	on conflict do nothing;
$$;

-- Remembers what the claim's own audited state earns, then pays each requested achievement the server has seen earned, once per account.
-- Returns the requested ids that are now claimed, newly or before, so the client keeps the others claimable.
create or replace function public.claim_achievement_quarks(
	p_user_id uuid,
	p_achievement_ids text[],
	p_earned_ids text[],
	p_reward integer
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
	v_balance integer;
	v_claimed text[];
	v_granted integer := 0;
begin
	if p_reward <= 0 then
		raise exception 'claim_achievement_quarks requires a positive reward, got %', p_reward;
	end if;

	perform remember_achievements(p_user_id, p_earned_ids);

	insert into public.player_quarks (user_id) values (p_user_id)
		on conflict (user_id) do nothing;

	select balance into v_balance
	from public.player_quarks
	where user_id = p_user_id
	for update;

	with inserted as (
		insert into public.quark_ledger (user_id, delta, reason, ref)
		select p_user_id, p_reward, 'achievement', 'achievement:' || v.achievement_id
		from public.verified_achievements v
		where v.user_id = p_user_id and v.achievement_id = any(p_achievement_ids)
		on conflict (user_id, ref) do nothing
		returning id
	)
	select count(*) into v_granted from inserted;

	if v_granted > 0 then
		update public.player_quarks
		set balance = balance + v_granted * p_reward,
			lifetime_earned = lifetime_earned + v_granted * p_reward,
			updated_at = now()
		where user_id = p_user_id
		returning balance into v_balance;
	end if;

	select coalesce(array_agg(substring(l.ref from length('achievement:') + 1)), '{}') into v_claimed
	from public.quark_ledger l
	where l.user_id = p_user_id and l.ref = any(array(select 'achievement:' || id from unnest(p_achievement_ids) as id));

	return jsonb_build_object('balance', v_balance, 'claimed', v_claimed, 'granted', v_granted);
end;
$$;

revoke all on function public.remember_achievements(uuid, text[]) from public, anon, authenticated;
revoke all on function public.claim_achievement_quarks(uuid, text[], text[], integer) from public, anon, authenticated;
