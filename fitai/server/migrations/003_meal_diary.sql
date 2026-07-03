-- Migration 003: meal diary. Food analyses stop vanishing — each analyzed
-- photo (or manual entry) becomes a meal row, so daily calorie/protein
-- totals exist and the checklist's nutrition items can complete themselves.
-- Additive and idempotent, same policy as 001/002.

create table if not exists public.meals (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  date        date not null default current_date,
  name        text not null,
  grams       numeric(6,1),
  calories    integer not null check (calories >= 0 and calories <= 5000),
  protein     numeric(5,1) not null default 0 check (protein >= 0),
  carbs       numeric(5,1),
  fat         numeric(5,1),
  source      text not null default 'manual' check (source in ('photo', 'manual')),
  created_at  timestamptz default now()
);

create index if not exists idx_meals_user_date on public.meals(user_id, date desc);
