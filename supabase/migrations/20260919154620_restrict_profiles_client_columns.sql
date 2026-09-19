-- The browser client only ever edits its own presence, save blob and display fields.
-- Every stat and cosmetic column is written by the server through the service role,
-- so a signed-in player must not be able to PATCH them through PostgREST with their own JWT.
revoke update on public.profiles from anon, authenticated;
grant update (is_online, picture, save, updated_at, username) on public.profiles to authenticated;
