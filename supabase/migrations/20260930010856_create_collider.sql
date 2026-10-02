-- Collider: one counter shared by every player, fed by at most one injection per player per cooldown.

create table if not exists public.collider_total (
	id boolean primary key default true check (id),
	total bigint not null default 0 check (total >= 0)
);

insert into public.collider_total (id) values (true) on conflict (id) do nothing;

create table if not exists public.collider_players (
	user_id uuid primary key references public.profiles(id) on delete cascade,
	injections integer not null default 0 check (injections >= 0),
	last_injected_at timestamptz
);

-- Everything goes through the service role, which bypasses RLS, so no policy is defined on purpose.
alter table public.collider_total enable row level security;
alter table public.collider_players enable row level security;

-- The remaining cooldown is computed by Postgres so a skewed client clock can't shorten or stretch it.
create or replace function public.get_collider(
	p_cooldown_seconds integer,
	p_user_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
	v_injections integer := 0;
	v_last timestamptz;
	v_total bigint;
begin
	select total into v_total from public.collider_total;

	if p_user_id is not null then
		select injections, last_injected_at into v_injections, v_last
		from public.collider_players
		where user_id = p_user_id;
	end if;

	return jsonb_build_object(
		'injections', coalesce(v_injections, 0),
		'readyInMs', greatest(0, ceil(extract(epoch from (v_last + make_interval(secs => p_cooldown_seconds) - now())) * 1000))::bigint,
		'total', v_total
	);
end;
$$;

-- The player row lock serialises a player's injections, the singleton total row absorbs at most one update per player per cooldown.
create or replace function public.inject_collider(
	p_cooldown_seconds integer,
	p_user_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
	v_last timestamptz;
begin
	insert into public.collider_players (user_id) values (p_user_id)
		on conflict (user_id) do nothing;

	select last_injected_at into v_last
	from public.collider_players
	where user_id = p_user_id
	for update;

	if v_last is not null and v_last > now() - make_interval(secs => p_cooldown_seconds) then
		return public.get_collider(p_cooldown_seconds, p_user_id) || jsonb_build_object('status', 'cooldown');
	end if;

	update public.collider_players
	set injections = injections + 1,
		last_injected_at = now()
	where user_id = p_user_id;

	-- Supabase's pg_safeupdate rejects an UPDATE without a WHERE clause, even on this single row.
	update public.collider_total set total = total + 1 where id;

	return public.get_collider(p_cooldown_seconds, p_user_id) || jsonb_build_object('status', 'ok');
end;
$$;

revoke all on function public.get_collider(integer, uuid) from public, anon, authenticated;
revoke all on function public.inject_collider(integer, uuid) from public, anon, authenticated;
