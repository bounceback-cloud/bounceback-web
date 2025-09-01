# BounceBack Web (React + Vite + Supabase)

## Setup
1) Install Node.js 18 or 20.
2) Unzip, then:
   ```bash
   npm install
   # Windows
   copy .env.example .env
   # macOS/Linux
   # cp .env.example .env
   ```
3) Put your Supabase values in `.env`:
   ```
   VITE_SUPABASE_URL=...
   VITE_SUPABASE_ANON_KEY=...
   ```
4) Create tables in Supabase:
   ```sql
   create table if not exists public.moods (
     id bigserial primary key,
     user_id uuid not null references auth.users(id) on delete cascade,
     mood int not null,
     energy int not null,
     created_at timestamptz not null default now()
   );
   alter table public.moods enable row level security;
   create policy "users can insert own moods"
     on public.moods for insert with check (auth.uid() = user_id);
   create policy "users can view own moods"
     on public.moods for select using (auth.uid() = user_id);
   ```
5) Run dev server:
   ```bash
   npm run dev
   ```
Open http://localhost:5173

## What’s included
- Auth (sign up/in/out) with Supabase
- Protected routes
- Mood tracker + recent list
- QR scanner (browser)
- Streak calculation

## Build for production
```bash
npm run build
npm run preview
```
Deploy the `dist/` folder to Vercel/Netlify/etc.
