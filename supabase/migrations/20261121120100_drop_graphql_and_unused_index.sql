-- The game reads its data through PostgREST only. Without pg_graphql, /graphql/v1 stops describing the profiles and game_messages tables
-- to every visitor, which is what the database advisor flags (lints 0026 and 0027).
drop extension if exists pg_graphql;

-- game_messages holds a handful of rows at most, so the planner always scans it and never used this index.
drop index if exists public.idx_game_messages_active_created;
