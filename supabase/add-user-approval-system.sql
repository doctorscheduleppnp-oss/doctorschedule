-- Add an admin-managed approval workflow for staff accounts.
-- Run this once in Supabase SQL Editor before deploying the matching UI.

alter table public.profiles
  add column if not exists email text,
  add column if not exists status text not null default 'pending',
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references public.profiles(id) on delete set null;

alter table public.profiles drop constraint if exists profiles_status_check;
alter table public.profiles
  add constraint profiles_status_check check (status in ('pending', 'approved', 'rejected'));

update public.profiles as profile
set email = auth_user.email
from auth.users as auth_user
where auth_user.id = profile.id
  and profile.email is null;

-- Preserve access for staff/admin accounts that existed before this migration.
update public.profiles
set status = 'approved'
where role in ('staff', 'admin');

create table if not exists public.profile_access_audit (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  changed_by uuid references public.profiles(id) on delete set null,
  old_role text,
  new_role text,
  old_status text,
  new_status text,
  changed_at timestamptz not null default now()
);

create index if not exists idx_profiles_status_created_at on public.profiles(status, created_at desc);
create index if not exists idx_profile_access_audit_profile_id on public.profile_access_audit(profile_id, changed_at desc);

create or replace function public.is_staff(target_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = target_user_id
      and status = 'approved'
      and role in ('staff', 'admin')
  );
$$;

create or replace function public.is_admin(target_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = target_user_id
      and status = 'approved'
      and role = 'admin'
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, role, status)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''), new.email, 'viewer', 'pending')
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace function public.protect_and_audit_profile_access()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
begin
  if old.role is not distinct from new.role and old.status is not distinct from new.status then
    return new;
  end if;

  if old.id = actor_id
     and old.role = 'admin'
     and old.status = 'approved'
     and (new.role <> 'admin' or new.status <> 'approved') then
    raise exception 'Admins cannot remove their own admin access';
  end if;

  if old.role = 'admin'
     and old.status = 'approved'
     and (new.role <> 'admin' or new.status <> 'approved')
     and not exists (
       select 1 from public.profiles
       where id <> old.id and role = 'admin' and status = 'approved'
     ) then
    raise exception 'At least one approved admin is required';
  end if;

  new.reviewed_by := actor_id;
  new.reviewed_at := now();

  insert into public.profile_access_audit (
    profile_id, changed_by, old_role, new_role, old_status, new_status
  ) values (
    old.id, actor_id, old.role, new.role, old.status, new.status
  );

  return new;
end;
$$;

drop trigger if exists profiles_protect_and_audit_access on public.profiles;
create trigger profiles_protect_and_audit_access
before update of role, status on public.profiles
for each row execute function public.protect_and_audit_profile_access();

alter table public.profile_access_audit enable row level security;
alter table public.profiles enable row level security;

drop policy if exists "Admins read profiles" on public.profiles;
create policy "Admins read profiles" on public.profiles
for select using (public.is_admin());

drop policy if exists "Admins update profiles" on public.profiles;
create policy "Admins update profiles" on public.profiles
for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admins read access audit" on public.profile_access_audit;
create policy "Admins read access audit" on public.profile_access_audit
for select using (public.is_admin());
