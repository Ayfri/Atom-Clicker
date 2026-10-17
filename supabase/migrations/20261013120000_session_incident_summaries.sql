-- The server writes the problem, cause and readable summary of a session, the trigger only throttles and posts them.
alter table public.client_sessions rename column top_source to cause;
alter table public.client_sessions add column if not exists problem text
	check (problem in ('freezes', 'low-frame-rate', 'render-bound', 'slow-interactions'));
alter table public.client_sessions add column if not exists summary text;

alter table public.client_sessions drop constraint if exists client_sessions_notify_skipped_check;
update public.client_sessions set notify_skipped = 'cause' where notify_skipped = 'source';
alter table public.client_sessions add constraint client_sessions_notify_skipped_check
	check (notify_skipped in ('cause', 'global', 'no_webhook', 'player'));

drop function if exists public.update_client_session(boolean, jsonb, uuid, jsonb, text, uuid);

-- Degraded is sticky and the update count capped. The cause, problem and summary freeze once the alert went out.
create or replace function public.update_client_session(
	p_cause text, p_degraded boolean, p_game jsonb, p_id uuid, p_perf jsonb, p_problem text, p_summary text, p_write_key uuid
) returns boolean
language plpgsql
set search_path = public
as $$
begin
	update client_sessions
	set cause = case when notified_at is not null then cause else p_cause end,
		degraded = degraded or p_degraded,
		degraded_at = coalesce(degraded_at, case when p_degraded then now() end),
		game = p_game,
		last_seen_at = now(),
		perf = p_perf,
		problem = case when notified_at is not null then problem else p_problem end,
		summary = case when notified_at is not null then summary else p_summary end,
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
	v_skip text;
	v_webhook text;
begin
	perform pg_advisory_xact_lock(hashtext('client_sessions_discord'));

	v_skip := case
		when new.user_id is not null and exists (
			select 1 from client_sessions s
			where s.notified_at > now() - interval '24 hours' and s.id <> new.id and s.user_id = new.user_id
		) then 'player'
		when exists (
			select 1 from client_sessions s
			where s.notified_at > now() - interval '1 hour' and s.app_version = new.app_version and s.cause is not distinct from new.cause
		) then 'cause'
		when (select count(*) from client_sessions s where s.notified_at > now() - interval '1 hour') >= 6 then 'global'
	end;

	if v_skip is null then
		v_webhook := coalesce(nullif(get_secret('DISCORD_PERF_WEBHOOK_URL'), ''), nullif(get_secret('DISCORD_ERROR_WEBHOOK_URL'), ''));
		if v_webhook is null then
			v_skip := 'no_webhook';
		end if;
	end if;

	if v_skip is not null then
		new.notify_skipped := v_skip;
		return new;
	end if;

	new.notified_at := now();
	-- The summary is built and sanitized by the server, device fields come from the row and lose their backticks here.
	perform net.http_post(
		url := v_webhook,
		body := jsonb_build_object(
			'allowed_mentions', jsonb_build_object('parse', '[]'::jsonb),
			'embeds', jsonb_build_array(jsonb_build_object(
				'color', 16753920,
				'description', substring(coalesce(new.summary, 'No summary'), 1, 3800),
				'fields', jsonb_build_array(
					jsonb_build_object('inline', false, 'name', 'Device', 'value', '```' || substring(replace(
						coalesce(new.in_app_browser || E' in-app browser\n', '') ||
						substring(new.user_agent, 1, 160) ||
						E'\nScreen: ' || coalesce(new.device->>'screenWidth', '?') || 'x' || coalesce(new.device->>'screenHeight', '?') ||
						' @' || coalesce(new.device->>'pixelRatio', '?') ||
						E'\nCores: ' || coalesce(new.device->>'cores', '?') || ', memory: ' || coalesce(new.device->>'memoryGb', '?') || ' GB' ||
						E'\nStandalone: ' || coalesce(new.device->>'standalone', '?'), '`', ''), 1, 900) || '```'),
					jsonb_build_object('inline', true, 'name', 'Build', 'value', '`' || replace(new.app_version, '`', '') || '`'),
					jsonb_build_object('inline', true, 'name', 'Player', 'value', '`' || coalesce(new.user_id::text, 'Anonymous') || '`')
				),
				'footer', jsonb_build_object('text', 'Session ' || new.id::text),
				'timestamp', now()::text,
				'title', substring('Degraded session: ' || coalesce(new.problem, 'unclassified'), 1, 250),
				'url', 'https://supabase.com/dashboard/project/lsdiecobeqxchkiffdwj/editor'
			)),
			'username', 'Atom Clicker Performance'
		),
		headers := jsonb_build_object('Content-Type', 'application/json')
	);
	return new;
end;
$$;

revoke execute on function public.update_client_session(text, boolean, jsonb, uuid, jsonb, text, text, uuid) from public, anon, authenticated;
revoke execute on function public.send_degraded_session_to_discord() from public, anon, authenticated;
