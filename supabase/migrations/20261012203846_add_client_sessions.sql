-- Client sessions: one row per page load, written by /api/sessions with the service role. Perf summaries land here, and a session
-- turning degraded posts at most one Discord embed, throttled per player, per (source, build) and globally.

create table if not exists public.client_sessions (
	id uuid primary key,
	user_id uuid references public.profiles(id) on delete cascade,
	started_at timestamptz not null default now(),
	last_seen_at timestamptz not null default now(),
	app_version text not null,
	user_agent text not null,
	in_app_browser text,
	device_key text not null,
	device jsonb not null default '{}',
	game jsonb not null default '{}',
	perf jsonb,
	degraded boolean not null default false,
	degraded_at timestamptz,
	top_source text,
	write_key uuid not null default gen_random_uuid(),
	updates integer not null default 0,
	notified_at timestamptz,
	notify_skipped text check (notify_skipped in ('global', 'no_webhook', 'player', 'source'))
);

-- last_seen_at and perf change on every update and stay unindexed, so those updates remain HOT.
create index if not exists client_sessions_user_started_idx on public.client_sessions (user_id, started_at desc) where user_id is not null;
create index if not exists client_sessions_started_idx on public.client_sessions (started_at);
create index if not exists client_sessions_degraded_idx on public.client_sessions (started_at desc) where degraded;
-- Every anti-spam lookup of the trigger reads notified rows only, a handful per hour.
create index if not exists client_sessions_notified_idx on public.client_sessions (notified_at desc) where notified_at is not null;

-- Everything goes through the service role, which bypasses RLS, so no policy is defined on purpose.
alter table public.client_sessions enable row level security;
revoke all on public.client_sessions from anon, authenticated;

-- Degraded is sticky and the update count capped, so a leaked write key can neither clear a flag nor grow a row forever.
-- The top source is frozen once the alert went out, so the row keeps what the embed said.
create or replace function public.update_client_session(
	p_degraded boolean,
	p_game jsonb,
	p_id uuid,
	p_perf jsonb,
	p_top_source text,
	p_write_key uuid
) returns boolean
language plpgsql
set search_path = public
as $$
begin
	update client_sessions
	set degraded = degraded or p_degraded,
		degraded_at = coalesce(degraded_at, case when p_degraded then now() end),
		game = p_game,
		last_seen_at = now(),
		perf = p_perf,
		top_source = case when notified_at is not null then top_source else p_top_source end,
		updates = updates + 1
	where id = p_id
		and write_key = p_write_key
		and updates < 300
		and started_at > now() - interval '2 days';
	return found;
end;
$$;

create or replace function public.send_degraded_session_to_discord() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
	-- Client-controlled text goes into Discord code spans and blocks, so backticks are dropped before it can close one.
	v_probe text := replace(new.perf->'probe'->>'culprit', '`', '');
	v_skip text;
	v_totals jsonb := coalesce(new.perf->'totals', '{}'::jsonb);
	v_webhook text;
begin
	-- Serialises degraded transitions so the hourly caps below are exact, they are rare enough for the lock to cost nothing.
	perform pg_advisory_xact_lock(hashtext('client_sessions_discord'));

	-- Anonymous sessions have no player key: device_key is a hash of fields shared by every iPhone on the same iOS, so it only feeds
	-- the stats, and the client cooldown with the source and global caps below cover them.
	v_skip := case
		when new.user_id is not null and exists (
			select 1 from client_sessions s
			where s.notified_at > now() - interval '24 hours'
				and s.id <> new.id
				and s.user_id = new.user_id
		) then 'player'
		when exists (
			select 1 from client_sessions s
			where s.notified_at > now() - interval '1 hour'
				and s.app_version = new.app_version
				and s.top_source is not distinct from new.top_source
		) then 'source'
		when (select count(*) from client_sessions s where s.notified_at > now() - interval '1 hour') >= 6 then 'global'
	end;

	if v_skip is null then
		v_webhook := coalesce(nullif(get_secret('DISCORD_PERF_WEBHOOK_URL'), ''), nullif(get_secret('DISCORD_ERROR_WEBHOOK_URL'), ''));
		if v_webhook is null then
			v_skip := 'no_webhook';
		end if;
	end if;

	-- The row is stored either way, so skipped sessions still count in the stats.
	if v_skip is not null then
		new.notify_skipped := v_skip;
		return new;
	end if;

	new.notified_at := now();
	perform net.http_post(
		url := v_webhook,
		body := jsonb_build_object(
			'username', 'Atom Clicker Performance',
			'embeds', jsonb_build_array(jsonb_build_object(
				'color', 16753920,
				'description', 'Top source: `' || coalesce(replace(new.top_source, '`', ''), 'unknown') || '`' || coalesce(E'\nProbe culprit: `' || v_probe || '`', ''),
				'fields', jsonb_build_array(
					jsonb_build_object('inline', false, 'name', 'Device', 'value', '```' || substring(replace(
						coalesce(new.in_app_browser || E' in-app browser\n', '') ||
						substring(new.user_agent, 1, 160) ||
						E'\nScreen: ' || coalesce(new.device->>'screenWidth', '?') || 'x' || coalesce(new.device->>'screenHeight', '?') ||
						' @' || coalesce(new.device->>'pixelRatio', '?') ||
						E'\nCores: ' || coalesce(new.device->>'cores', '?') || ', memory: ' || coalesce(new.device->>'memoryGb', '?') || ' GB' ||
						E'\nStandalone: ' || coalesce(new.device->>'standalone', '?'), '`', ''), 1, 900) || '```'),
					jsonb_build_object('inline', true, 'name', 'Build', 'value', '`' || replace(new.app_version, '`', '') || '`'),
					jsonb_build_object('inline', true, 'name', 'Realm', 'value',
						replace(coalesce(new.game->>'realm', '?') || ' (level ' || coalesce(new.game->>'level', '?') || ')', '`', '')),
					jsonb_build_object('inline', true, 'name', 'Player', 'value', '`' || coalesce(new.user_id::text, 'Anonymous') || '`'),
					jsonb_build_object('inline', false, 'name', 'Numbers', 'value', '```json' || E'\n' || substring(replace(jsonb_build_object(
						'animations', new.game->'animations',
						'canvasMb', round(coalesce((new.game->>'canvasBytes')::numeric, 0) / 1048576, 1),
						'commitLagP95Ms', v_totals->'commitLagP95Ms',
						'frameP95GapMs', v_totals->'frameP95GapMs',
						'freezeCount', v_totals->'freezeCount',
						'freezeMs', v_totals->'freezeMs',
						'inputMaxMs', v_totals->'inputMaxMs',
						'jankRatio', v_totals->'jankRatio',
						'stallMsPer10s', v_totals->'stallMsPer10s',
						'unaccountedShare', v_totals->'unaccountedShare',
						'worstTarget', v_totals->'worstTarget'
					)::text, '`', ''), 1, 900) || E'\n```')
				),
				'footer', jsonb_build_object('text', 'Session ' || new.id::text),
				'timestamp', now()::text,
				'title', 'Degraded session',
				'url', 'https://supabase.com/dashboard/project/lsdiecobeqxchkiffdwj/editor'
			))
		),
		headers := jsonb_build_object('Content-Type', 'application/json')
	);
	return new;
end;
$$;

create or replace trigger client_sessions_degraded_discord
	before update of degraded on public.client_sessions
	for each row
	when (new.degraded and not old.degraded)
	execute function public.send_degraded_session_to_discord();

revoke execute on function public.update_client_session(boolean, jsonb, uuid, jsonb, text, uuid) from public, anon, authenticated;
revoke execute on function public.send_degraded_session_to_discord() from public, anon, authenticated;

select cron.schedule(
	'client-sessions-retention',
	'23 4 * * *',
	$$delete from public.client_sessions where started_at < now() - interval '90 days'$$
);
