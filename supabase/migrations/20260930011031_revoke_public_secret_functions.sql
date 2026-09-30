-- get_secret reads decrypted Vault secrets and the Discord senders post to webhooks, so only postgres may run them.
-- Their callers keep working: the error_logs trigger and the daily recap cron job both run as postgres.

revoke execute on function public.get_secret(text) from public, anon, authenticated;
revoke execute on function public.send_discord_daily_recap() from public, anon, authenticated;
revoke execute on function public.send_error_to_discord() from public, anon, authenticated;
