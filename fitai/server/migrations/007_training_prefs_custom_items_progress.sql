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
