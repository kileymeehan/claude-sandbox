-- Supabase setup for kiley-website CMS
-- Run this in your Supabase project's SQL editor

-- Posts table
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  date text not null,
  tag text not null default 'Essay',
  read_time text not null default '5 min read',
  excerpt text not null default '',
  storage_path text not null,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enable RLS (server uses service key which bypasses this, but good practice)
alter table public.posts enable row level security;

-- Allow public reads of published posts
create policy "Public can read published posts"
  on public.posts for select
  using (published = true);

-- Seed existing static articles (these link to their static HTML hrefs)
-- The storage_path for static files is a sentinel value; server.js falls through to static
insert into public.posts (slug, title, date, tag, read_time, excerpt, storage_path, published)
values
  (
    'earned-autonomy',
    'Earned Autonomy',
    'May 2026',
    'Essay',
    '8 min read',
    'A framework for working with AI without quietly handing it the keys — and what it means for the rest of us building software with it.',
    'static:earned-autonomy.html',
    true
  ),
  (
    'ux-career',
    'A UX Career is a Business Career',
    '2018',
    'Essay',
    '9 min read',
    'A mini-curriculum to boost your business savviness — the books, courses, and frameworks that turned business from a black box into a tool.',
    'static:ux-career.html',
    true
  ),
  (
    'late-bloomers',
    'Late Bloomers and Product Design',
    '2020',
    'Essay',
    '6 min read',
    'On wandering paths, generalists, and the quiet virtue of arriving late — why product design is a destination for the well-travelled mind.',
    'static:late-bloomers.html',
    true
  ),
  (
    'email-love-story',
    'An Email Love Story',
    'Jun 2020',
    'Essay',
    '4 min read',
    'My oddly passionate submission to HEY.com''s invite request — on long emails, lonely libraries, and the inbox as an accidental archive of the self.',
    'static:email-love-story.html',
    true
  )
on conflict (slug) do nothing;

-- Storage bucket
-- Run these steps in the Supabase dashboard → Storage:
-- 1. Create a new bucket named "posts"
-- 2. Set it to Private (not public)
-- 3. The server uses SUPABASE_SERVICE_KEY which has full storage access

-- Alternatively via SQL (Supabase storage schema):
insert into storage.buckets (id, name, public)
values ('posts', 'posts', false)
on conflict (id) do nothing;
