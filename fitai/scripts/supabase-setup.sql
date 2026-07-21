-- FitAI: all migrations combined (000-011), in order. Idempotent —
-- safe to run more than once. On hosted Supabase the auth-schema shim
-- is guarded by an existence check, so it executes nothing there.

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

-- ============================================================
-- 006_daily_values_and_briefing.sql
-- ============================================================
-- (1) "Today's Mission" stops being tick-only: the user types actual numbers
--     (protein, water, sleep, steps), a daily weigh-in, and a free-text note.
--     Entering a value auto-completes the matching boolean item server-side.
alter table public.daily_checklists
  add column if not exists protein_grams numeric(6,1),
  add column if not exists water_ml       integer,
  add column if not exists sleep_hours    numeric(4,1),
  add column if not exists steps_count    integer,
  add column if not exists weight_kg      numeric(5,1),
  add column if not exists notes          text;

-- (2) The AI-authored progress briefing, at most once per user per local day.
create table if not exists public.daily_briefings (
  user_id    uuid not null references auth.users(id) on delete cascade,
  date       date not null default current_date,
  briefing   jsonb not null,
  created_at timestamptz default now(),
  primary key (user_id, date)
);

alter table public.daily_briefings enable row level security;

-- ============================================================
-- 007_training_prefs_custom_items_progress.sql
-- ============================================================
-- (1) Onboarding: the user states how many days they can train and describes
--     their training style in free text; both drive AI plan generation.
alter table public.users_profile
  add column if not exists training_days_per_week integer,
  add column if not exists training_style text;

-- (2) User-authored "Today's Mission" items: jsonb array of {id, label, done}.
alter table public.daily_checklists
  add column if not exists custom_items jsonb not null default '[]'::jsonb;

-- (3) The AI-authored progress analysis (Progress page), one row per user per
--     local day; input_hash triggers a recompute when new data lands.
create table if not exists public.progress_analyses (
  user_id    uuid not null references auth.users(id) on delete cascade,
  date       date not null default current_date,
  input_hash text not null,
  analysis   jsonb not null,
  created_at timestamptz default now(),
  primary key (user_id, date)
);

alter table public.progress_analyses enable row level security;

-- (4) The progress analysis summarizes workout_logs by day for one user.
create index if not exists idx_workout_logs_user_logged_at
  on public.workout_logs(user_id, logged_at desc);

-- ============================================================
-- 008_calories_tracking.sql
-- ============================================================
-- Calories join the daily mission as a first-class tracked value, same
-- shape as protein (006): the user types (or the meal diary syncs) the
-- day's actual kcal, and a boolean completion is derived from the plan's
-- calorie target — directionally per goal (lose_fat: stay at or under;
-- build_muscle: reach it; otherwise: within ±10%).
alter table public.daily_checklists
  add column if not exists calories_kcal      integer,
  add column if not exists calories_completed boolean not null default false;

-- ============================================================
-- 009_backfill_plan_started_at.sql
-- ============================================================
-- Profiles onboarded before 002 kept plan_started_at NULL, and the services
-- fell back to users_profile.updated_at to answer "which week is this?" —
-- so a profile edit reset "week 6 of 16" to week 0. Give those rows a real
-- start (earliest logged day, else account creation) so the clock can't be
-- edited. Only NULL rows are touched; never-onboarded profiles stay NULL.
update public.users_profile p
set plan_started_at = coalesce(
      (select min(c.date)::timestamptz from public.daily_checklists c where c.user_id = p.user_id),
      p.created_at,
      now()
    )
where p.plan_started_at is null
  and p.onboarding_completed = true;

-- ============================================================
-- 010_drop_orphan_tables.sql
-- ============================================================
-- Migration 010: remove the four tables from 002 that no code ever reads or
-- writes. They were built for a Progress page that has since been rebuilt
-- AI-first: the analysis lives in progress_analyses (007), weigh-ins live on
-- daily_checklists.weight_kg (006), and the review/achievement features were
-- never wired up. Dead RLS-locked schema is worse than no schema — it reads
-- like an active feature to anyone opening the database.
--
--   body_weight_logs    -> superseded by daily_checklists.weight_kg
--   progress_snapshots  -> superseded by progress_analyses
--   achievements        -> never implemented
--   reviews             -> never implemented
--
-- Verified before writing this: zero references in server/src, client/src,
-- and shared/ (only the 002/005 DDL and the docs mentioned them).

-- body_weight_logs is the one table that could hold user-entered ground
-- truth (a weigh-in someone typed on the old Progress page). Carry any such
-- rows over to the canonical series before dropping, newest wins per day,
-- and never overwrite a weight the current app already recorded.
do $$
begin
  if to_regclass('public.body_weight_logs') is not null then
    insert into public.daily_checklists (user_id, date, weight_kg)
    select b.user_id, b.date, b.weight_kg
    from public.body_weight_logs b
    on conflict (user_id, date) do update
      set weight_kg = coalesce(daily_checklists.weight_kg, excluded.weight_kg);
  end if;
end $$;

drop table if exists public.body_weight_logs;
drop table if exists public.progress_snapshots;
drop table if exists public.achievements;
drop table if exists public.reviews;

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
