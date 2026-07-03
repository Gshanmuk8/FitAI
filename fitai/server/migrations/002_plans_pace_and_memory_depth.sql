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
