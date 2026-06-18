-- Consult scheduling system.
-- Run this once in Supabase SQL Editor after the main schema.

create table if not exists public.consult_assignments (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id) on delete cascade,
  doctor_id uuid references public.doctors(id) on delete set null,
  date date not null,
  shift_key text not null check (shift_key in ('day', 'evening', 'night')),
  note text,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint consult_assignments_department_date_shift_key unique (department_id, date, shift_key)
);

create index if not exists idx_consult_assignments_date
on public.consult_assignments(date);

create index if not exists idx_consult_assignments_department_date
on public.consult_assignments(department_id, date);

create or replace function public.is_admin(target_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = target_user_id
      and role = 'admin'
  );
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists consult_assignments_touch_updated_at on public.consult_assignments;
create trigger consult_assignments_touch_updated_at
before update on public.consult_assignments
for each row execute function public.touch_updated_at();

alter table public.consult_assignments enable row level security;

drop policy if exists "Public read consult assignments" on public.consult_assignments;
drop policy if exists "Admins manage consult assignments" on public.consult_assignments;

create policy "Public read consult assignments"
on public.consult_assignments
for select
using (true);

create policy "Admins manage consult assignments"
on public.consult_assignments
for all
using (public.is_admin())
with check (public.is_admin());

-- Optional sample rows for today. Uncomment only if needed.
-- insert into public.consult_assignments (department_id, doctor_id, date, shift_key)
-- select d.department_id, d.id, current_date, 'day'
-- from public.doctors d
-- where d.department_id is not null
-- on conflict (department_id, date, shift_key) do nothing;
