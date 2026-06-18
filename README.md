# Doctor Shift Management & Scheduler

Modern React + Tailwind web app for public doctor schedules and admin shift management, backed by Supabase PostgreSQL.

## Run

1. Run `supabase/schema.sql` in Supabase SQL Editor.
   Optionally run `supabase/seed.sql` after that to add demo departments, doctors, and schedules.
   Run `supabase/add-consult-system.sql` to enable public Consult viewing and admin-only Consult scheduling.
   Run `supabase/add-archive-fields.sql` to enable editing and archive/restore for departments and doctors.
   Run `supabase/add-bilingual-fields.sql` to add Thai and English directory fields to an existing database.
   Run `supabase/add-user-approval-system.sql` to add Admin approval, role assignment, and access audit logging.
2. Copy `.env.example` to `.env` and fill in your Supabase URL and anon key.
3. Install dependencies and start the app:

```bash
npm install
npm run dev
```

The UI falls back to sample data when Supabase env values are missing, so the dashboard can still be previewed locally.

## Connect Supabase

1. Create a Supabase project.
2. Open SQL Editor and run `supabase/schema.sql`.
3. Go to Project Settings > API and copy:
   - Project URL
   - anon public key
4. Create `.env` in this project:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

5. Restart the dev server:

```bash
npm.cmd run dev
```

6. In the app, open Admin Login and create a staff account.
7. Promote the first admin in Supabase SQL Editor:

```sql
update public.profiles
set role = 'admin', status = 'approved'
where id = '<USER_UUID_FROM_AUTH_USERS>';
```

After that, public users can read schedules without logging in. Staff/admin users can manage departments, doctors, images, and schedule slots.
