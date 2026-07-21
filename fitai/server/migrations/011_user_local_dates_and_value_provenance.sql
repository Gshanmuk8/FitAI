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
