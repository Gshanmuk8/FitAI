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
