-- Migration 012: close the one gap the Supabase RLS linter flagged, and
-- harden the REST surface with defence-in-depth grant revocation.
--
-- Context: migration 005 already enabled RLS (deny-all, zero policies) on
-- every APPLICATION table, and all data access goes through the Express API
-- as the table owner (which bypasses RLS). The client's anon key is used
-- ONLY for Supabase Auth — it never calls PostgREST (.from/.rpc/.storage).
--
-- Two things were still open:
--   1. `schema_migrations` is created at runtime by scripts/migrate.js, so it
--      was never in 005's list — it is the sole `rls_disabled_in_public`
--      table the linter reports. Enable + force RLS with no policy: deny-all.
--   2. migration 005 neutered anon/authenticated via RLS but left their broad
--      table GRANTs in place. RLS already blocks them, but revoking the grants
--      means a future policy mistake cannot silently re-expose a table. The
--      server is the owner and is unaffected.
-- Idempotent; harmless on plain Postgres (owner connections bypass RLS).

alter table public.schema_migrations enable row level security;
alter table public.schema_migrations force row level security;

-- Defence in depth: the REST roles have no legitimate use here.
do $$
declare t record;
begin
  for t in
    select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('revoke all on public.%I from anon, authenticated', t.tablename);
  end loop;
end $$;

-- Also revoke the schema-usage + default privileges so newly created tables
-- do not silently re-grant to the REST roles on the next migration.
revoke all on schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated;
