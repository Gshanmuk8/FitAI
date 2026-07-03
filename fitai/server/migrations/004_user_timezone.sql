-- Migration 004: user timezone. Daily rollover (checklist, meals,
-- weigh-ins, progress snapshots) previously keyed on the SERVER's
-- CURRENT_DATE — wrong for any user in a different timezone. The client
-- captures the browser's IANA timezone at onboarding/profile save; all
-- date-keyed reads/writes now resolve "today" in the user's timezone,
-- falling back to server date when unset (identical to old behavior).

alter table public.users_profile
  add column if not exists timezone text;
