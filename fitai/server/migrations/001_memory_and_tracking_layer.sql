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
