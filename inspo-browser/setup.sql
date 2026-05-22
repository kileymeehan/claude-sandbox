-- Inspo Browser — Supabase setup
-- Run this in your Supabase project's SQL editor

-- Images table
create table if not exists public.images (
  id text primary key,              -- e.g. "components/button.png" (same as storage_path)
  filename text not null,
  folder text not null default 'inbox',
  storage_path text not null,
  tags text[] not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.images enable row level security;

-- Projects table
create table if not exists public.projects (
  id text primary key,
  name text not null default 'Untitled',
  images text[] not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.projects enable row level security;

-- Storage bucket (public so images can be served directly via CDN)
insert into storage.buckets (id, name, public)
values ('inspo', 'inspo', true)
on conflict (id) do nothing;
