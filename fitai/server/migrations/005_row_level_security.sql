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
