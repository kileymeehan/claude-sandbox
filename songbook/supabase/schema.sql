-- ============================================================
-- Songbook schema — paste this into Supabase SQL Editor and run
-- ============================================================

-- Songs
create table if not exists public.songs (
  id           uuid primary key,
  user_id      uuid references auth.users(id) on delete cascade not null default auth.uid(),
  title        text not null default 'Untitled',
  artist       text not null default '',
  type         text not null default 'original' check (type in ('original', 'cover')),
  album_id     uuid,
  tags         text[] not null default '{}',
  notes        text not null default '',
  mood_images  jsonb not null default '[]',
  sections     jsonb not null default '[]',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Albums
create table if not exists public.albums (
  id         uuid primary key,
  user_id    uuid references auth.users(id) on delete cascade not null default auth.uid(),
  title      text not null default 'Untitled Album',
  artist     text not null default '',
  year       int not null default extract(year from now())::int,
  cover_art  text,
  song_ids   text[] not null default '{}',
  created_at timestamptz not null default now()
);

-- Row-level security (each user only sees their own data)
alter table public.songs  enable row level security;
alter table public.albums enable row level security;

drop policy if exists "users_songs"  on public.songs;
drop policy if exists "users_albums" on public.albums;

create policy "users_songs" on public.songs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "users_albums" on public.albums
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Audio storage bucket (private, one folder per user)
insert into storage.buckets (id, name, public)
values ('audio', 'audio', false)
on conflict (id) do nothing;

drop policy if exists "users_audio" on storage.objects;

create policy "users_audio" on storage.objects
  for all
  using  (bucket_id = 'audio' and auth.uid()::text = (storage.foldername(name))[1])
  with check (bucket_id = 'audio' and auth.uid()::text = (storage.foldername(name))[1]);
