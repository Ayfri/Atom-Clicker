-- Score history: the leaderboard route audits every submitted game state and keeps one rolling row per player and hour.
-- The board value in profiles.atoms is the best valid row, and a rejected state close to it rolls the board back
-- instead of banning anyone: the player shows up again with their next state that passes the checks.

create table if not exists public.score_snapshots (
	id bigint generated always as identity primary key,
	user_id uuid not null references public.profiles(id) on delete cascade,
	opened_at timestamptz not null default now(),
	received_at timestamptz not null default now(),
	atoms numeric not null,
	level integer not null,
	status text not null check (status in ('valid', 'rejected', 'rolled_back')),
	issues text[] not null default '{}',
	warnings text[] not null default '{}',
	snapshot jsonb not null
);

create index if not exists score_snapshots_user_received_idx on public.score_snapshots (user_id, received_at desc);

-- Everything goes through the service role, which bypasses RLS, so no policy is defined on purpose.
alter table public.score_snapshots enable row level security;
revoke all on public.score_snapshots from anon, authenticated;

-- Everything the audit of a submission needs, in one round trip.
create or replace function public.get_score_context(p_user_id uuid) returns jsonb
language sql
stable
set search_path = public
as $$
	select jsonb_build_object(
		'colliderTotal', coalesce((select total from collider_total limit 1), 0),
		'lastReceivedAt', (select extract(epoch from max(received_at)) * 1000 from score_snapshots where user_id = p_user_id),
		'previous', (
			select jsonb_build_object('receivedAt', extract(epoch from received_at) * 1000, 'snapshot', snapshot)
			from score_snapshots
			where user_id = p_user_id and status = 'valid'
			order by received_at desc
			limit 1
		)
	);
$$;

create or replace function public.record_score(
	p_user_id uuid,
	p_atoms numeric,
	p_level integer,
	p_valid boolean,
	p_issues text[],
	p_warnings text[],
	p_snapshot jsonb,
	p_username text default null,
	p_picture text default null
) returns jsonb
language plpgsql
set search_path = public
as $$
declare
	v_best numeric;
	v_board_atoms numeric;
	v_board_level integer;
	v_latest score_snapshots%rowtype;
	v_status text := case when p_valid then 'valid' else 'rejected' end;
begin
	-- The profile row lock serialises the submissions of one player.
	select case when atoms ~ '^[0-9.eE+-]+$' then atoms::numeric end into v_best from profiles where id = p_user_id for update;
	if not found then
		raise exception 'Profile not found for user %', p_user_id;
	end if;

	select * into v_latest from score_snapshots where user_id = p_user_id order by received_at desc limit 1;

	if v_latest.id is not null and v_latest.status = v_status and v_latest.opened_at > now() - interval '1 hour' then
		update score_snapshots
		set atoms = greatest(atoms, p_atoms),
			issues = p_issues,
			level = greatest(level, p_level),
			received_at = now(),
			snapshot = p_snapshot,
			warnings = array(select distinct unnest(warnings || p_warnings))
		where id = v_latest.id;
	else
		insert into score_snapshots (atoms, issues, level, snapshot, status, user_id, warnings)
		values (p_atoms, p_issues, p_level, p_snapshot, v_status, p_user_id, p_warnings);
		-- A month of hourly rows is enough to roll back to, the best valid row always stays.
		delete from score_snapshots s
		where s.user_id = p_user_id
			and s.received_at < now() - interval '30 days'
			and s.id is distinct from (select id from score_snapshots where user_id = p_user_id and status = 'valid' order by atoms desc limit 1);
	end if;

	-- The board only ever shows verified rows, so a score written before the audit existed is replaced by the first verified one.
	if p_valid then
		select max(atoms), max(level) into v_board_atoms, v_board_level from score_snapshots where user_id = p_user_id and status = 'valid';
		update profiles
		set atoms = v_board_atoms::text,
			last_updated = case when v_best is null or v_board_atoms > v_best then now() else last_updated end,
			level = v_board_level,
			picture = coalesce(p_picture, picture),
			updated_at = now(),
			username = coalesce(p_username, username)
		where id = p_user_id;
		return jsonb_build_object('status', 'valid');
	end if;

	-- A rejected state within three orders of magnitude of the board score taints it, along with every valid row it could have grown from.
	if v_best is null or p_atoms * 1000 >= v_best then
		update score_snapshots set status = 'rolled_back' where user_id = p_user_id and status = 'valid' and atoms * 1000 >= p_atoms;
		select max(atoms), max(level) into v_board_atoms, v_board_level from score_snapshots where user_id = p_user_id and status = 'valid';
		update profiles set atoms = coalesce(v_board_atoms::text, ''), level = coalesce(v_board_level, 0), updated_at = now() where id = p_user_id;
		return jsonb_build_object('status', 'rolled_back');
	end if;

	return jsonb_build_object('status', 'rejected');
end;
$$;

revoke execute on function public.get_score_context(uuid) from public, anon, authenticated;
revoke execute on function public.record_score(uuid, numeric, integer, boolean, text[], text[], jsonb, text, text) from public, anon, authenticated;

-- Scores only reach profiles through record_score now.
drop function if exists public.update_profile_stats(uuid, text, integer, text, text);
