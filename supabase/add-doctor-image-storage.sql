-- Run once in Supabase SQL Editor to enable doctor image uploads.
insert into storage.buckets (id, name, public)
values ('doctor-images', 'doctor-images', true)
on conflict (id) do update set public = true;

drop policy if exists "Public read doctor images" on storage.objects;
drop policy if exists "Staff upload doctor images" on storage.objects;
drop policy if exists "Staff update doctor images" on storage.objects;
drop policy if exists "Staff delete doctor images" on storage.objects;

create policy "Public read doctor images" on storage.objects
for select using (bucket_id = 'doctor-images');

create policy "Staff upload doctor images" on storage.objects
for insert to authenticated
with check (bucket_id = 'doctor-images' and public.is_staff());

create policy "Staff update doctor images" on storage.objects
for update to authenticated
using (bucket_id = 'doctor-images' and public.is_staff())
with check (bucket_id = 'doctor-images' and public.is_staff());

create policy "Staff delete doctor images" on storage.objects
for delete to authenticated
using (bucket_id = 'doctor-images' and public.is_staff());
