-- Collider: particles injected since midnight UTC, kept on the singleton row and reset by the first injection of a new day.

alter table public.collider_total
	add column if not exists today integer not null default 0 check (today >= 0),
	add column if not exists today_date date not null default (now() at time zone 'utc')::date;

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
	v_today integer;
	v_total bigint;
begin
	select total, case when today_date = (now() at time zone 'utc')::date then today else 0 end
	into v_total, v_today
	from public.collider_total;

	if p_user_id is not null then
		select injections, last_injected_at into v_injections, v_last
		from public.collider_players
		where user_id = p_user_id;
	end if;

	return jsonb_build_object(
		'injections', coalesce(v_injections, 0),
		'readyInMs', greatest(0, ceil(extract(epoch from (v_last + make_interval(secs => p_cooldown_seconds) - now())) * 1000))::bigint,
		'today', v_today,
		'total', v_total
	);
end;
$$;

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
	update public.collider_total
	set today = case when today_date = (now() at time zone 'utc')::date then today + 1 else 1 end,
		today_date = (now() at time zone 'utc')::date,
		total = total + 1
	where id;

	return public.get_collider(p_cooldown_seconds, p_user_id) || jsonb_build_object('status', 'ok');
end;
$$;

revoke all on function public.get_collider(integer, uuid) from public, anon, authenticated;
revoke all on function public.inject_collider(integer, uuid) from public, anon, authenticated;
