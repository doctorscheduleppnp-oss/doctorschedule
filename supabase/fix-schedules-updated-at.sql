-- Fix for: record "new" has no field "updated_at"
-- Run this once in Supabase SQL Editor.

alter table public.schedules
add column if not exists created_at timestamptz not null default now();

alter table public.schedules
add column if not exists updated_at timestamptz not null default now();

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists schedules_touch_updated_at on public.schedules;

create trigger schedules_touch_updated_at
before update on public.schedules
for each row execute function public.touch_updated_at();

-- These cleanup lines are safe. They remove accidental triggers if they were created
-- on tables that do not have updated_at.
drop trigger if exists departments_touch_updated_at on public.departments;
drop trigger if exists doctors_touch_updated_at on public.doctors;
drop trigger if exists profiles_touch_updated_at on public.profiles;
