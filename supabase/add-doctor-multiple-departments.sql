-- Adds multi-department membership without deleting or replacing existing data.
create table if not exists public.doctor_departments (
  doctor_id uuid not null references public.doctors(id) on delete cascade,
  department_id uuid not null references public.departments(id) on delete cascade,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (doctor_id, department_id)
);

create index if not exists idx_doctor_departments_department
on public.doctor_departments(department_id, doctor_id);

create unique index if not exists idx_doctor_departments_one_primary
on public.doctor_departments(doctor_id)
where is_primary;

insert into public.doctor_departments (doctor_id, department_id, is_primary)
select id, department_id, true
from public.doctors
where department_id is not null
on conflict (doctor_id, department_id) do update
set is_primary = true;

alter table public.doctor_departments enable row level security;

drop policy if exists "Public read doctor departments" on public.doctor_departments;
drop policy if exists "Staff manage doctor departments" on public.doctor_departments;

create policy "Public read doctor departments" on public.doctor_departments
for select using (true);

create policy "Staff manage doctor departments" on public.doctor_departments
for all using (public.is_staff()) with check (public.is_staff());

create or replace function public.set_doctor_departments(
  p_doctor_id uuid,
  p_department_ids uuid[],
  p_primary_department_id uuid
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  normalized_ids uuid[];
begin
  if not public.is_staff() then
    raise exception 'Only approved staff can manage doctor departments';
  end if;

  select coalesce(array_agg(distinct department_id), '{}'::uuid[])
  into normalized_ids
  from unnest(coalesce(p_department_ids, '{}'::uuid[])) as ids(department_id);

  if coalesce(array_length(normalized_ids, 1), 0) = 0 then
    raise exception 'At least one department is required';
  end if;

  if p_primary_department_id is null or not (p_primary_department_id = any(normalized_ids)) then
    raise exception 'Primary department must be included in department list';
  end if;

  delete from public.doctor_departments where doctor_id = p_doctor_id;

  insert into public.doctor_departments (doctor_id, department_id, is_primary)
  select p_doctor_id, department_id, department_id = p_primary_department_id
  from unnest(normalized_ids) as ids(department_id);

  update public.doctors
  set department_id = p_primary_department_id
  where id = p_doctor_id;
end;
$$;

grant execute on function public.set_doctor_departments(uuid, uuid[], uuid) to authenticated;
