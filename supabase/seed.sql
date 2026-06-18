-- Demo data for Doctor Shift Management.
-- Run this after supabase/schema.sql if you want the Public Dashboard to show sample doctors immediately.

insert into public.departments (id, name, description, name_th, name_en, description_th, description_en)
values
  ('11111111-1111-4111-8111-111111111111', 'Cardiology', 'Heart and vascular care', 'อายุรกรรมโรคหัวใจ', 'Cardiology', 'ดูแลโรคหัวใจและหลอดเลือด', 'Heart and vascular care'),
  ('22222222-2222-4222-8222-222222222222', 'Neurology', 'Brain and nervous system', 'ประสาทวิทยา', 'Neurology', 'ดูแลโรคสมองและระบบประสาท', 'Brain and nervous system'),
  ('33333333-3333-4333-8333-333333333333', 'Pediatrics', 'Children and family care', 'กุมารเวชกรรม', 'Pediatrics', 'ดูแลสุขภาพเด็กและครอบครัว', 'Children and family care')
on conflict (id) do update
set name = excluded.name,
    description = excluded.description,
    name_th = excluded.name_th,
    name_en = excluded.name_en,
    description_th = excluded.description_th,
    description_en = excluded.description_en;

insert into public.doctors (id, name, specialty, name_th, name_en, specialty_th, specialty_en, image_url, department_id)
values
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'Dr. Narin S.',
    'Interventional Cardiologist',
    'นพ.นรินทร์',
    'Dr. Narin S.',
    'อายุรแพทย์โรคหัวใจและหลอดเลือด',
    'Interventional Cardiologist',
    'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?auto=format&fit=crop&w=320&q=80',
    '11111111-1111-4111-8111-111111111111'
  ),
  (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'Dr. Sirin P.',
    'Pediatric Specialist',
    'พญ.ศิริน',
    'Dr. Sirin P.',
    'กุมารแพทย์',
    'Pediatric Specialist',
    'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=320&q=80',
    '33333333-3333-4333-8333-333333333333'
  ),
  (
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    'Dr. Kittipong R.',
    'Neurologist',
    'นพ.กิตติพงศ์',
    'Dr. Kittipong R.',
    'ประสาทวิทยา',
    'Neurologist',
    'https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=320&q=80',
    '22222222-2222-4222-8222-222222222222'
  )
on conflict (id) do update
set name = excluded.name,
    specialty = excluded.specialty,
    name_th = excluded.name_th,
    name_en = excluded.name_en,
    specialty_th = excluded.specialty_th,
    specialty_en = excluded.specialty_en,
    image_url = excluded.image_url,
    department_id = excluded.department_id;

insert into public.schedules (
  doctor_id,
  date,
  h00, h01, h02, h03, h04, h05, h06, h07,
  h08, h09, h10, h11, h12, h13, h14, h15,
  h16, h17, h18, h19, h20, h21, h22, h23
)
select
  doctor_id,
  schedule_date,
  false, false, false, false, false, false, false, false,
  true, true, true, true, true, true, true, true,
  false, false, false, false, false, false, false, false
from (
  values
    ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid),
    ('cccccccc-cccc-4ccc-8ccc-cccccccccccc'::uuid)
) as doctors(doctor_id)
cross join generate_series(current_date, current_date + interval '6 days', interval '1 day') as days(schedule_date)
on conflict (doctor_id, date) do update
set h08 = excluded.h08,
    h09 = excluded.h09,
    h10 = excluded.h10,
    h11 = excluded.h11,
    h12 = excluded.h12,
    h13 = excluded.h13,
    h14 = excluded.h14,
    h15 = excluded.h15;

insert into public.schedules (
  doctor_id,
  date,
  h00, h01, h02, h03, h04, h05, h06, h07,
  h08, h09, h10, h11, h12, h13, h14, h15,
  h16, h17, h18, h19, h20, h21, h22, h23
)
values (
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  current_date,
  false, false, false, false, false, false, false, false,
  false, false, true, true, true, false, false, false,
  false, false, false, false, false, false, false, false
)
on conflict (doctor_id, date) do update
set h10 = excluded.h10,
    h11 = excluded.h11,
    h12 = excluded.h12;
