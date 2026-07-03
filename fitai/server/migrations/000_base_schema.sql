-- Migration 000: base schema. The original project relied on a
-- supabase/schema.sql that was never carried into this tree, so migration
-- 001 altered a table nothing had created — a fresh database couldn't be
-- provisioned. This file closes that hole and is safe everywhere.

create extension if not exists "uuid-ossp";

-- Supabase owns the auth schema, and Postgres checks schema permissions
-- BEFORE "if not exists" can short-circuit — so a bare
-- `create table if not exists auth.users` fails with "permission denied"
-- on hosted Supabase even though the table exists. This guard checks for
-- auth.users FIRST and only materializes the shim on databases that
-- genuinely lack it (plain Postgres: local dev, the smoke test,
-- self-hosted). On Supabase the block runs zero create statements.
do $$
begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'auth' and table_name = 'users'
  ) then
    execute 'create schema if not exists auth';
    execute 'create table auth.users (
      id          uuid primary key default uuid_generate_v4(),
      email       text unique,
      created_at  timestamptz default now()
    )';
  end if;
end $$;

-- Permanent memory tier. 001/002 extend this with more columns.
create table if not exists public.users_profile (
  user_id               uuid primary key references auth.users(id) on delete cascade,
  age                   integer,
  height_cm             numeric(5,1),
  weight_kg             numeric(5,1),
  goal                  text,
  activity_level        text,
  injuries              text,
  ai_plan               jsonb,
  onboarding_completed  boolean default false,
  created_at            timestamptz default now(),
  updated_at            timestamptz default now()
);
