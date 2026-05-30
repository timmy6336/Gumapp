-- Phase 4: data product infrastructure

-- API clients table — cities and researchers get their own token
create table if not exists public.api_clients (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  token_hash  text not null unique, -- store SHA-256 hash, never plaintext
  created_at  timestamptz not null default now(),
  last_used_at timestamptz,
  is_active   boolean not null default true
);

-- Only service role can manage API clients
alter table public.api_clients enable row level security;
create policy "api_clients_no_public_access" on public.api_clients
  using (false);

-- Weekly neighbourhood digest materialized data
-- (populated by the neighbourhood-stats Edge Function on a cron schedule)
create table if not exists public.neighbourhood_stats (
  id              uuid primary key default gen_random_uuid(),
  week_start      date not null,
  -- Approximate neighbourhood center (0.01 degree grid ~= 1km)
  grid_lat        numeric(7,4) not null,
  grid_lng        numeric(7,4) not null,
  total_reports   integer not null default 0,
  verified_reports integer not null default 0,
  removed_reports integer not null default 0,
  most_common_surface text,
  created_at      timestamptz not null default now(),
  unique (week_start, grid_lat, grid_lng)
);

-- Public read for neighbourhood stats (cities can query directly)
alter table public.neighbourhood_stats enable row level security;
create policy "neighbourhood_stats_select" on public.neighbourhood_stats for select using (true);

-- Function: compute and upsert neighbourhood stats for the current week
create or replace function public.refresh_neighbourhood_stats()
returns void language plpgsql security definer as $$
declare
  week date := date_trunc('week', now())::date;
begin
  insert into public.neighbourhood_stats
    (week_start, grid_lat, grid_lng, total_reports, verified_reports, removed_reports, most_common_surface)
  select
    week as week_start,
    round(latitude::numeric, 2)  as grid_lat,
    round(longitude::numeric, 2) as grid_lng,
    count(*)                     as total_reports,
    count(*) filter (where is_verified)          as verified_reports,
    count(*) filter (where status = 'removed')   as removed_reports,
    mode() within group (order by surface_type)  as most_common_surface
  from public.gum_reports
  where created_at >= week
  group by grid_lat, grid_lng
  on conflict (week_start, grid_lat, grid_lng) do update set
    total_reports    = excluded.total_reports,
    verified_reports = excluded.verified_reports,
    removed_reports  = excluded.removed_reports,
    most_common_surface = excluded.most_common_surface;
end;
$$;

-- Index for efficient geo-range queries on the stats table
create index if not exists neighbourhood_stats_grid_idx
  on public.neighbourhood_stats(grid_lat, grid_lng);
create index if not exists neighbourhood_stats_week_idx
  on public.neighbourhood_stats(week_start desc);
