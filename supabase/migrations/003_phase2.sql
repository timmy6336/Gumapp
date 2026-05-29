-- Phase 2: surface tagging, report status, data export helpers

alter table public.gum_reports
  add column if not exists surface_type text
    check (surface_type in ('sidewalk', 'road', 'bench', 'wall', 'other')),
  add column if not exists status text not null default 'active'
    check (status in ('active', 'removed'));

-- Index for filtering active reports
create index if not exists gum_reports_status_idx on public.gum_reports(status);

-- Re-create proximity check to only count active reports
create or replace function public.check_nearby_report(
  p_lat double precision,
  p_lng double precision,
  p_meters double precision default 10
)
returns boolean language plpgsql security definer as $$
declare
  nearby_count integer;
begin
  select count(*) into nearby_count
  from public.gum_reports
  where status = 'active'
    and st_dwithin(
      location,
      st_point(p_lng, p_lat)::geography,
      p_meters
    );
  return nearby_count > 0;
end;
$$;

-- Any authenticated user can mark a report as removed (community moderation)
create or replace function public.mark_report_removed(p_report_id uuid)
returns void language plpgsql security definer as $$
begin
  update public.gum_reports
  set status = 'removed'
  where id = p_report_id;
end;
$$;

-- Aggregate stats per surface type for a bounding box — used by admin dashboard
create or replace function public.stats_by_surface(
  min_lat double precision,
  min_lng double precision,
  max_lat double precision,
  max_lng double precision
)
returns table(surface_type text, total bigint, verified bigint) language sql security definer as $$
  select
    coalesce(surface_type, 'unknown') as surface_type,
    count(*) as total,
    count(*) filter (where is_verified) as verified
  from public.gum_reports
  where status = 'active'
    and latitude between min_lat and max_lat
    and longitude between min_lng and max_lng
  group by surface_type;
$$;
