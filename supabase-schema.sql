-- User Profiles Table
create table user_profiles (
  uid uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null,
  custom_username text,
  profile_picture_url text,
  created_at bigint not null,
  last_active bigint not null
);

-- Enable RLS
alter table user_profiles enable row level security;

-- User profiles policies
create policy "Users can view their own profile" on user_profiles
  for select using (auth.uid() = uid);

create policy "Users can update their own profile" on user_profiles
  for update using (auth.uid() = uid);

create policy "Users can insert their own profile" on user_profiles
  for insert with check (auth.uid() = uid);

-- Rooms Table
create table rooms (
  id text primary key,
  host_uid uuid not null references auth.users(id) on delete cascade,
  players jsonb not null default '{}',
  settings jsonb not null,
  status text not null check (status in ('waiting', 'headstart', 'active', 'finished')),
  created_at bigint not null,
  headstart_started_at bigint,
  game_started_at bigint,
  game_ended_at bigint
);

-- Enable RLS
alter table rooms enable row level security;

-- Rooms policies
create policy "Authenticated users can view rooms" on rooms
  for select using (auth.role() = 'authenticated');

create policy "Authenticated users can create rooms" on rooms
  for insert with check (auth.role() = 'authenticated');

create policy "Room hosts and players can update rooms" on rooms
  for update using (
    auth.uid() = host_uid or 
    (players ? auth.uid()::text)
  );

create policy "Room hosts can delete rooms" on rooms
  for delete using (auth.uid() = host_uid);

-- Game Results Table
create table game_results (
  id uuid primary key default gen_random_uuid(),
  room_id text not null,
  winners text not null check (winners in ('killers', 'survivors')),
  elimination_order jsonb not null default '[]',
  game_started_at bigint not null,
  game_ended_at bigint not null,
  final_players jsonb not null
);

-- Enable RLS
alter table game_results enable row level security;

-- Game results policies
create policy "Authenticated users can view game results" on game_results
  for select using (auth.role() = 'authenticated');

create policy "Authenticated users can insert game results" on game_results
  for insert with check (auth.role() = 'authenticated');

-- Create storage bucket for profile pictures (do this in Supabase Dashboard → Storage)
-- Create bucket named 'profile-pictures' with public access

-- Storage policies (run after creating the bucket)
create policy "Users can upload their own profile picture" on storage.objects
  for insert with check (
    bucket_id = 'profile-pictures' and 
    auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can update their own profile picture" on storage.objects
  for update using (
    bucket_id = 'profile-pictures' and 
    auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can delete their own profile picture" on storage.objects
  for delete using (
    bucket_id = 'profile-pictures' and 
    auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Anyone can view profile pictures" on storage.objects
  for select using (bucket_id = 'profile-pictures');