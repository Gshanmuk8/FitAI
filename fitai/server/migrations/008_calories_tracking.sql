-- Migration 008: calories join the daily mission as a first-class tracked
-- value, same shape as protein (006): the user types (or the meal diary
-- syncs) the day's actual kcal, and a boolean completion is derived from
-- the plan's calorie target — directionally per goal (lose_fat: stay at or
-- under; build_muscle: reach it; otherwise: within ±10%).
alter table public.daily_checklists
  add column if not exists calories_kcal      integer,
  add column if not exists calories_completed boolean not null default false;
