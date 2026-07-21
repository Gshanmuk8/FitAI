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
