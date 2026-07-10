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
