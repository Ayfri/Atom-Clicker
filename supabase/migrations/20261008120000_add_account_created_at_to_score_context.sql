-- The audit bounds a first submission's run by the account's age, since the client sets its own run and save start.

create or replace function public.get_score_context(p_user_id uuid) returns jsonb
language sql
stable
set search_path = public
as $$
	select jsonb_build_object(
		'accountCreatedAt', (select extract(epoch from created_at) * 1000 from profiles where id = p_user_id),
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

revoke execute on function public.get_score_context(uuid) from public, anon, authenticated;
