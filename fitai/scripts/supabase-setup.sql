-- FitAI: complete setup for a NEW, DEDICATED Supabase project.
-- Run this entire file in Supabase SQL Editor as postgres.
-- Generated from all SQL files currently in server/migrations (000-009, 011-012).
-- There is no migration 010 in this checkout.
--
-- Includes RLS, REST-role grant revocation and the migration ledger.
-- The Express backend owns data access; browser keys are for Supabase Auth.
-- Do not add public/anon access policies to make the app work.
-- Migration 012 revokes REST access across public: do NOT run in a project
-- shared with another app that depends on public-schema REST access.
-- Supabase manages auth.users; this does not copy or create real accounts.
-- No API keys or passwords belong in this SQL.
--
-- Re-running this file is supported for this schema. One transaction prevents
-- a partial setup; an error rolls back the whole transaction.
begin;
set local search_path = public, extensions;

create table if not exists public.schema_migrations (
  name text primary key,
  applied_at timestamptz default now()
);

-- ============================================================
-- 000_base_schema.sql
-- ============================================================
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

insert into public.schema_migrations (name) values ('000_base_schema.sql')
on conflict (name) do nothing;

-- ============================================================
-- 001_memory_and_tracking_layer.sql
-- ============================================================
-- Extends the existing supabase/schema.sql (users_profile, chat_messages)
-- with the tables the memory layer and progress-tracking features need.
-- The original schema's users_profile table is reused rather than
-- duplicated as user_profiles -- keep model files pointed at this name.

alter table public.users_profile
  add column if not exists target_weight_kg numeric(5,1),
  add column if not exists dietary_restrictions text,
  add column if not exists gym_availability text;

create table if not exists public.user_state (
  user_id            uuid primary key references auth.users(id) on delete cascade,
  current_program    text,
  calorie_target     integer,
  current_phase      text,
  body_fat_estimate  numeric(4,1),
  current_split      text,
  updated_at         timestamptz default now()
);

create table if not exists public.daily_checklists (
  id                  uuid primary key default uuid_generate_v4(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  date                date not null default current_date,
  workout_completed   boolean default false,
  protein_completed   boolean default false,
  water_completed     boolean default false,
  sleep_completed     boolean default false,
  steps_completed     boolean default false,
  mood                text,
  soreness_level      text,
  created_at          timestamptz default now(),
  unique(user_id, date)
);

create table if not exists public.memory_summaries (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  mode        text,
  summary     text not null,
  created_at  timestamptz default now()
);

create table if not exists public.workout_logs (
  id                   uuid primary key default uuid_generate_v4(),
  user_id              uuid not null references auth.users(id) on delete cascade,
  exercise_name        text not null,
  weight_kg            numeric(5,1),
  reps                 integer,
  set_number           integer,
  completed_all_reps   boolean,
  logged_at            timestamptz default now()
);

create index if not exists idx_workout_logs_user_exercise on public.workout_logs(user_id, exercise_name, logged_at desc);
create index if not exists idx_memory_summaries_user on public.memory_summaries(user_id, created_at desc);

insert into public.schema_migrations (name) values ('001_memory_and_tracking_layer.sql')
on conflict (name) do nothing;

-- ============================================================
-- 002_plans_pace_and_memory_depth.sql
-- ============================================================
-- Migration 002: timeframe-aware plans, body-weight tracking, 24h progress
-- snapshots, plan-aware daily checklists, and a deeper long-term memory.
-- Additive only — every statement is idempotent and no existing column is
-- altered or dropped, so this is safe to run against a live 001 database.

-- Onboarding now captures how the user wants to pace their goal.
alter table public.users_profile
  add column if not exists sex text,
  add column if not exists timeframe_weeks integer,
  add column if not exists plan_started_at timestamptz;

-- Each day's checklist stores the concrete targets it was generated from
-- (today's workout day or rest day, protein/water/steps/calories), so
-- history stays truthful even after the user edits their plan.
alter table public.daily_checklists
  add column if not exists plan_snapshot jsonb;

-- Long-term memory: summaries gain a category and an importance rank so
-- retrieval can prefer durable facts (injuries, constraints) over chatter.
alter table public.memory_summaries
  add column if not exists category text default 'conversation',
  add column if not exists importance integer default 1;

-- One weigh-in per user per day; re-logging the same day overwrites.
create table if not exists public.body_weight_logs (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  date        date not null default current_date,
  weight_kg   numeric(5,1) not null,
  created_at  timestamptz default now(),
  unique(user_id, date)
);

-- Progress is recomputed at most once per day (lazily, on first request)
-- and persisted here; a fresh weigh-in deletes today's row to force an
-- immediate recompute. unique(user_id, date) makes the lazy computation
-- race-safe under concurrent first-requests.
create table if not exists public.progress_snapshots (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  date        date not null default current_date,
  metrics     jsonb not null,
  created_at  timestamptz default now(),
  unique(user_id, date)
);

-- Deterministic achievement unlocks. unique(user_id, code) means awarding
-- is idempotent — the evaluator can re-run daily without double-awards.
create table if not exists public.achievements (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  code         text not null,
  name         text not null,
  description  text,
  unlocked_at  timestamptz default now(),
  unique(user_id, code)
);

-- Weekly/monthly reviews, generated lazily for completed periods and then
-- immutable. data = deterministic stats; narrative = AI text (or fallback).
create table if not exists public.reviews (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  period_type   text not null check (period_type in ('weekly', 'monthly')),
  period_start  date not null,
  period_end    date not null,
  data          jsonb not null,
  narrative     jsonb,
  created_at    timestamptz default now(),
  unique(user_id, period_type, period_start)
);

-- Behavior memory the plan editor learns from: removing an exercise
-- repeatedly marks it disliked; adding one marks it favored. Future plan
-- generation prompts avoid strong dislikes.
create table if not exists public.user_exercise_preferences (
  user_id       uuid not null references auth.users(id) on delete cascade,
  exercise_name text not null,
  sentiment     text not null check (sentiment in ('disliked', 'favorite')),
  strength      integer not null default 1,
  updated_at    timestamptz default now(),
  primary key (user_id, exercise_name)
);

create index if not exists idx_achievements_user on public.achievements(user_id, unlocked_at desc);
create index if not exists idx_reviews_user on public.reviews(user_id, period_type, period_start desc);
create index if not exists idx_body_weight_logs_user on public.body_weight_logs(user_id, date desc);
create index if not exists idx_progress_snapshots_user on public.progress_snapshots(user_id, date desc);
create index if not exists idx_daily_checklists_user_date on public.daily_checklists(user_id, date desc);

insert into public.schema_migrations (name) values ('002_plans_pace_and_memory_depth.sql')
on conflict (name) do nothing;

-- ============================================================
-- 003_meal_diary.sql
-- ============================================================
-- Migration 003: meal diary. Food analyses stop vanishing — each analyzed
-- photo (or manual entry) becomes a meal row, so daily calorie/protein
-- totals exist and the checklist's nutrition items can complete themselves.
-- Additive and idempotent, same policy as 001/002.

create table if not exists public.meals (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  date        date not null default current_date,
  name        text not null,
  grams       numeric(6,1),
  calories    integer not null check (calories >= 0 and calories <= 5000),
  protein     numeric(5,1) not null default 0 check (protein >= 0),
  carbs       numeric(5,1),
  fat         numeric(5,1),
  source      text not null default 'manual' check (source in ('photo', 'manual')),
  created_at  timestamptz default now()
);

create index if not exists idx_meals_user_date on public.meals(user_id, date desc);

insert into public.schema_migrations (name) values ('003_meal_diary.sql')
on conflict (name) do nothing;

-- ============================================================
-- 004_user_timezone.sql
-- ============================================================
-- Migration 004: user timezone. Daily rollover (checklist, meals,
-- weigh-ins, progress snapshots) previously keyed on the SERVER's
-- CURRENT_DATE — wrong for any user in a different timezone. The client
-- captures the browser's IANA timezone at onboarding/profile save; all
-- date-keyed reads/writes now resolve "today" in the user's timezone,
-- falling back to server date when unset (identical to old behavior).

alter table public.users_profile
  add column if not exists timezone text;

insert into public.schema_migrations (name) values ('004_user_timezone.sql')
on conflict (name) do nothing;

-- ============================================================
-- 005_row_level_security.sql
-- ============================================================
-- Migration 005: lock the public REST surface. Supabase exposes every
-- public table through PostgREST using the anon key — which ships inside
-- the frontend bundle by design. This app's data access goes exclusively
-- through the Express API (service role / table owner, which bypasses
-- RLS), so the correct posture is: RLS enabled, ZERO policies = deny-all
-- for anon and authenticated REST callers. The server is unaffected.
-- Idempotent; harmless on plain Postgres (owner connections bypass RLS).

alter table public.users_profile              enable row level security;
alter table public.user_state                 enable row level security;
alter table public.daily_checklists           enable row level security;
alter table public.memory_summaries           enable row level security;
alter table public.workout_logs               enable row level security;
alter table public.body_weight_logs           enable row level security;
alter table public.progress_snapshots         enable row level security;
alter table public.achievements               enable row level security;
alter table public.reviews                    enable row level security;
alter table public.user_exercise_preferences  enable row level security;
alter table public.meals                      enable row level security;

insert into public.schema_migrations (name) values ('005_row_level_security.sql')
on conflict (name) do nothing;

-- ============================================================
-- 006_daily_values_and_briefing.sql
-- ============================================================
-- Migration 006: manual daily values + the AI daily briefing.
--
-- (1) "Today's Mission" stops being tick-only: the user types actual numbers
--     (protein, water, sleep, steps), a daily weigh-in, and a free-text note.
--     Entering a value auto-completes the matching boolean item server-side,
--     so the existing five *_completed columns stay the source of truth for
--     adherence while these columns carry the real figures the AI reads.
alter table public.daily_checklists
  add column if not exists protein_grams numeric(6,1),
  add column if not exists water_ml       integer,
  add column if not exists sleep_hours    numeric(4,1),
  add column if not exists steps_count    integer,
  add column if not exists weight_kg      numeric(5,1),
  add column if not exists notes          text;

-- (2) The AI-authored progress briefing. The coach reads the user's plan and
--     their logged history and writes it at most once per user per local day
--     (computed lazily on the first dashboard load, reused for 24h). One row
--     per user per day; a re-run the same day overwrites in place.
create table if not exists public.daily_briefings (
  user_id    uuid not null references auth.users(id) on delete cascade,
  date       date not null default current_date,
  briefing   jsonb not null,
  created_at timestamptz default now(),
  primary key (user_id, date)
);

-- Same posture as every other user-owned table (migration 005): RLS on, no
-- policies = deny-all for the anon/authenticated REST surface. The Express
-- server connects as owner and is unaffected.
alter table public.daily_briefings enable row level security;

insert into public.schema_migrations (name) values ('006_daily_values_and_briefing.sql')
on conflict (name) do nothing;

-- ============================================================
-- 007_training_prefs_custom_items_progress.sql
-- ============================================================
-- Migration 007: training preferences, custom checklist items, AI progress analyses.
--
-- (1) Onboarding stops forcing training frequency through the activity-level
--     heuristic: the user states how many days they can train and describes
--     their own training style in free text ("yoga + powerlifting", "calisthenics
--     and cardio"). Both flow verbatim (sanitized) into plan generation — the AI
--     designs the split around them instead of a hardcoded activity->days table.
alter table public.users_profile
  add column if not exists training_days_per_week integer,
  add column if not exists training_style text;

-- (2) "Today's Mission" accepts user-authored items alongside the plan-derived
--     five. Stored as a jsonb array of { id, label, done } on the day's row so
--     they roll over daily like everything else and stay immutable history.
alter table public.daily_checklists
  add column if not exists custom_items jsonb not null default '[]'::jsonb;

-- (3) The AI-authored progress analysis (Progress page). Computed lazily on
--     first view, one row per user per local day. input_hash fingerprints the
--     data the analysis was computed from (weigh-ins, adherence, workouts) so
--     new data the same day triggers a recompute instead of serving a stale
--     read of the user's journey.
create table if not exists public.progress_analyses (
  user_id    uuid not null references auth.users(id) on delete cascade,
  date       date not null default current_date,
  input_hash text not null,
  analysis   jsonb not null,
  created_at timestamptz default now(),
  primary key (user_id, date)
);

-- Same posture as migration 005: RLS on, no policies = deny-all for the
-- anon/authenticated REST surface; the Express server connects as owner.
alter table public.progress_analyses enable row level security;

-- (4) The progress analysis summarizes workout_logs by day for one user.
--     The existing (user_id, exercise_name, logged_at) index serves the
--     progression lookups; this one serves the time-window scan.
create index if not exists idx_workout_logs_user_logged_at
  on public.workout_logs(user_id, logged_at desc);

insert into public.schema_migrations (name) values ('007_training_prefs_custom_items_progress.sql')
on conflict (name) do nothing;

-- ============================================================
-- 008_calories_tracking.sql
-- ============================================================
-- Migration 008: calories join the daily mission as a first-class tracked
-- value, same shape as protein (006): the user types (or the meal diary
-- syncs) the day's actual kcal, and a boolean completion is derived from
-- the plan's calorie target — directionally per goal (lose_fat: stay at or
-- under; build_muscle: reach it; otherwise: within ±10%).
alter table public.daily_checklists
  add column if not exists calories_kcal      integer,
  add column if not exists calories_completed boolean not null default false;

insert into public.schema_migrations (name) values ('008_calories_tracking.sql')
on conflict (name) do nothing;

-- ============================================================
-- 009_backfill_plan_started_at.sql
-- ============================================================
-- Migration 009: give every onboarded profile a real plan_started_at.
--
-- plan_started_at arrived in 002. Profiles onboarded before that ran kept it
-- NULL, and the services fell back to users_profile.updated_at to answer
-- "which week of the plan is this?". updated_at moves on every profile edit
-- (PATCH /api/profile), so for those legacy rows changing your height reset
-- "week 6 of 16" back to week 0. The clock must not be editable.
--
-- Backfill order, most truthful first:
--   1. the user's earliest logged day  — when they actually started working
--   2. the profile row's created_at    — when the account was set up
--   3. now()                           — last resort, so the column is never
--                                        NULL for someone who has a plan
-- Only NULL rows are touched; a profile that already has a start keeps it.
-- Profiles that never completed onboarding stay NULL on purpose: they have no
-- plan, so they have no clock, and the services already render that as "—".
update public.users_profile p
set plan_started_at = coalesce(
      (select min(c.date)::timestamptz from public.daily_checklists c where c.user_id = p.user_id),
      p.created_at,
      now()
    )
where p.plan_started_at is null
  and p.onboarding_completed = true;

insert into public.schema_migrations (name) values ('009_backfill_plan_started_at.sql')
on conflict (name) do nothing;

-- ============================================================
-- 011_user_local_dates_and_value_provenance.sql
-- ============================================================
-- Migration 011: two day-boundary correctness fixes.
--
-- (1) workout_logs had no date column — "today" was `logged_at::date`,
--     evaluated in the DATABASE server's timezone (UTC in production) and
--     then compared against the USER's local date. The two disagree for
--     part of every day for anyone not on UTC: a user in Los Angeles who
--     trains at 18:00 logs sets stamped with tomorrow's UTC date, so
--     GET /api/workout/today-sets returns {} and the Workout page restarts
--     their session at 0 sets. Every other date-keyed table (meals,
--     daily_checklists, daily_briefings) already stores the user-local date
--     explicitly; this brings workout_logs in line.
--
--     Backfill uses logged_at::date, which is what the old queries computed,
--     so historical rows keep the meaning they were read with.
alter table public.workout_logs
  add column if not exists date date;

update public.workout_logs
set date = logged_at::date
where date is null;

alter table public.workout_logs
  alter column date set default current_date;

create index if not exists idx_workout_logs_user_date
  on public.workout_logs(user_id, date desc);

-- (2) daily_checklists.values_source records WHO last wrote each of the
--     day's figures — the user typing on Today's Mission, or the meal diary
--     syncing its totals. Without it the diary's sync overwrites a manually
--     entered value unconditionally: someone who types "2200 kcal" for a
--     restaurant day and then logs a single 250 kcal snack watches the day
--     silently become 250, with the completion booleans and the AI's input
--     hash following it down. Shape: { "calories_kcal": "manual",
--     "protein_grams": "diary" }. Absent key = never explicitly written.
alter table public.daily_checklists
  add column if not exists values_source jsonb not null default '{}'::jsonb;

insert into public.schema_migrations (name) values ('011_user_local_dates_and_value_provenance.sql')
on conflict (name) do nothing;

-- ============================================================
-- 012_secure_schema_migrations_and_revoke_rest_grants.sql
-- ============================================================
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

insert into public.schema_migrations (name) values ('012_secure_schema_migrations_and_revoke_rest_grants.sql')
on conflict (name) do nothing;

commit;

-- Expected for this version: 12 migrations applied.
select count(*) as migrations_applied from public.schema_migrations;
