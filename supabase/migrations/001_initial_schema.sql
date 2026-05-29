-- Enable PostGIS for geo queries
create extension if not exists postgis;

-- Profiles table (extends auth.users)
create table public.profiles (
  id          uuid references auth.users(id) on delete cascade primary key,
  username    text not null unique,
  avatar_url  text,
  total_reports    integer not null default 0,
  verified_reports integer not null default 0,
  created_at  timestamptz not null default now()
);

-- Gum reports table
create table public.gum_reports (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.profiles(id) on delete cascade not null,
  latitude    double precision not null,
  longitude   double precision not null,
  -- Also store as PostGIS point for spatial queries
  location    geography(point, 4326) generated always as (
                st_point(longitude, latitude)::geography
              ) stored,
  photo_url   text,
  is_verified boolean not null default false,
  created_at  timestamptz not null default now()
);

-- Index on location for fast nearby queries
create index gum_reports_location_idx on public.gum_reports using gist(location);
create index gum_reports_user_id_idx on public.gum_reports(user_id);
create index gum_reports_created_at_idx on public.gum_reports(created_at desc);

-- RLS
alter table public.profiles enable row level security;
alter table public.gum_reports enable row level security;

-- Profiles: anyone can read, only the owner can update their own
create policy "profiles_select" on public.profiles for select using (true);
create policy "profiles_insert" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update" on public.profiles for update using (auth.uid() = id);

-- Gum reports: anyone can read, only authenticated users can insert their own
create policy "gum_reports_select" on public.gum_reports for select using (true);
create policy "gum_reports_insert" on public.gum_reports for insert
  with check (auth.uid() = user_id);
create policy "gum_reports_update" on public.gum_reports for update
  using (auth.uid() = user_id);

-- Function: increment total_reports on a profile
create or replace function public.increment_profile_total(p_user_id uuid)
returns void language plpgsql security definer as $$
begin
  update public.profiles
  set total_reports = total_reports + 1
  where id = p_user_id;
end;
$$;

-- Function: increment verified_reports and mark report as verified
create or replace function public.mark_report_verified(p_report_id uuid, p_user_id uuid)
returns void language plpgsql security definer as $$
begin
  update public.gum_reports
  set is_verified = true
  where id = p_report_id;

  update public.profiles
  set verified_reports = verified_reports + 1
  where id = p_user_id;
end;
$$;

-- Storage bucket for gum photos (run this in Supabase dashboard or via CLI)
-- insert into storage.buckets (id, name, public) values ('gum-photos', 'gum-photos', true);

-- Storage RLS: anyone can view photos, authenticated users can upload
-- create policy "gum_photos_select" on storage.objects for select using (bucket_id = 'gum-photos');
-- create policy "gum_photos_insert" on storage.objects for insert
--   with check (bucket_id = 'gum-photos' and auth.role() = 'authenticated');
