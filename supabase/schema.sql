create extension if not exists "pgcrypto";

create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  name_th text,
  name_en text,
  description_th text,
  description_en text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.doctors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  specialty text,
  name_th text,
  name_en text,
  specialty_th text,
  specialty_en text,
  image_url text,
  department_id uuid references public.departments(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.schedules (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references public.doctors(id) on delete cascade,
  date date not null,
  h00 boolean not null default false,
  h01 boolean not null default false,
  h02 boolean not null default false,
  h03 boolean not null default false,
  h04 boolean not null default false,
  h05 boolean not null default false,
  h06 boolean not null default false,
  h07 boolean not null default false,
  h08 boolean not null default false,
  h09 boolean not null default false,
  h10 boolean not null default false,
  h11 boolean not null default false,
  h12 boolean not null default false,
  h13 boolean not null default false,
  h14 boolean not null default false,
  h15 boolean not null default false,
  h16 boolean not null default false,
  h17 boolean not null default false,
  h18 boolean not null default false,
  h19 boolean not null default false,
  h20 boolean not null default false,
  h21 boolean not null default false,
  h22 boolean not null default false,
  h23 boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint schedules_doctor_date_key unique (doctor_id, date)
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  role text not null default 'viewer' check (role in ('viewer', 'staff', 'admin')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

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

create index if not exists idx_doctors_department_id on public.doctors(department_id);
create index if not exists idx_schedules_doctor_date on public.schedules(doctor_id, date);
create index if not exists idx_schedules_date on public.schedules(date);
create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_profiles_status_created_at on public.profiles(status, created_at desc);
create index if not exists idx_profile_access_audit_profile_id on public.profile_access_audit(profile_id, changed_at desc);

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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.is_staff(target_user_id uuid default auth.uid())
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
    select 1
    from public.profiles
    where id = target_user_id
      and status = 'approved'
      and role = 'admin'
  );
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

alter table public.departments enable row level security;
alter table public.doctors enable row level security;
alter table public.schedules enable row level security;
alter table public.profiles enable row level security;
alter table public.profile_access_audit enable row level security;

drop policy if exists "Public read departments" on public.departments;
drop policy if exists "Public read doctors" on public.doctors;
drop policy if exists "Public read schedules" on public.schedules;
drop policy if exists "Anon manage departments" on public.departments;
drop policy if exists "Anon manage doctors" on public.doctors;
drop policy if exists "Anon manage schedules" on public.schedules;
drop policy if exists "Staff manage departments" on public.departments;
drop policy if exists "Staff manage doctors" on public.doctors;
drop policy if exists "Staff manage schedules" on public.schedules;
drop policy if exists "Users read own profile" on public.profiles;
drop policy if exists "Admins read profiles" on public.profiles;
drop policy if exists "Admins update profiles" on public.profiles;
drop policy if exists "Admins read access audit" on public.profile_access_audit;

create policy "Public read departments" on public.departments
for select using (true);

create policy "Public read doctors" on public.doctors
for select using (true);

create policy "Public read schedules" on public.schedules
for select using (true);

create policy "Staff manage departments" on public.departments
for all using (public.is_staff()) with check (public.is_staff());

create policy "Staff manage doctors" on public.doctors
for all using (public.is_staff()) with check (public.is_staff());

create policy "Staff manage schedules" on public.schedules
for all using (public.is_staff()) with check (public.is_staff());

create policy "Users read own profile" on public.profiles
for select using (auth.uid() = id);

create policy "Admins read profiles" on public.profiles
for select using (public.is_admin());

create policy "Admins update profiles" on public.profiles
for update using (public.is_admin()) with check (public.is_admin());

create policy "Admins read access audit" on public.profile_access_audit
for select using (public.is_admin());

insert into storage.buckets (id, name, public)
values ('doctor-images', 'doctor-images', true)
on conflict (id) do nothing;

drop policy if exists "Public read doctor images" on storage.objects;
drop policy if exists "Anon upload doctor images" on storage.objects;
drop policy if exists "Staff upload doctor images" on storage.objects;
drop policy if exists "Staff update doctor images" on storage.objects;
drop policy if exists "Staff delete doctor images" on storage.objects;

create policy "Public read doctor images" on storage.objects
for select using (bucket_id = 'doctor-images');

create policy "Staff upload doctor images" on storage.objects
for insert with check (bucket_id = 'doctor-images' and public.is_staff());

create policy "Staff update doctor images" on storage.objects
for update using (bucket_id = 'doctor-images' and public.is_staff())
with check (bucket_id = 'doctor-images' and public.is_staff());

create policy "Staff delete doctor images" on storage.objects
for delete using (bucket_id = 'doctor-images' and public.is_staff());

-- After creating the first staff user in Auth, promote it manually in SQL Editor:
-- update public.profiles set role = 'admin' where id = '<USER_UUID_FROM_AUTH_USERS>';
-- update public.profiles set role = 'admin', status = 'approved' where id = '<USER_UUID_FROM_AUTH_USERS>';
