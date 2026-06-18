-- Add bilingual directory fields without removing legacy columns.
-- Safe to run more than once on an existing project.
alter table public.departments
  add column if not exists name_th text,
  add column if not exists name_en text,
  add column if not exists description_th text,
  add column if not exists description_en text;

alter table public.doctors
  add column if not exists name_th text,
  add column if not exists name_en text,
  add column if not exists specialty_th text,
  add column if not exists specialty_en text;

-- Existing demo/legacy values are English. Change this backfill if your live
-- legacy data is Thai before running the script.
update public.departments
set name_en = coalesce(nullif(name_en, ''), name),
    description_en = coalesce(nullif(description_en, ''), description)
where name_en is null or name_en = '' or description_en is null or description_en = '';

update public.doctors
set name_en = coalesce(nullif(name_en, ''), name),
    specialty_en = coalesce(nullif(specialty_en, ''), specialty)
where name_en is null or name_en = '' or specialty_en is null or specialty_en = '';
