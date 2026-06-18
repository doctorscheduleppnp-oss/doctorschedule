-- Adds archive support without deleting departments, doctors, schedules, or history.
-- Run this once in Supabase SQL Editor.

alter table public.departments
add column if not exists is_active boolean not null default true;

alter table public.doctors
add column if not exists is_active boolean not null default true;

create index if not exists idx_departments_is_active
on public.departments(is_active);

create index if not exists idx_doctors_is_active
on public.doctors(is_active);
