-- Phase 1: GPS accuracy, rate limiting, proximity dedup

-- Store GPS accuracy with each report
alter table public.gum_reports
  add column if not exists gps_accuracy double precision;

-- Rate limiting: returns true if user is allowed to submit (< 10 reports in last hour)
create or replace function public.check_rate_limit(p_user_id uuid)
returns boolean language plpgsql security definer as $$
declare
  report_count integer;
begin
  select count(*) into report_count
  from public.gum_reports
  where user_id = p_user_id
    and created_at > now() - interval '1 hour';
  return report_count < 10;
end;
$$;

-- Proximity: returns true if a report already exists within p_meters of the given point
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
  where st_dwithin(
    location,
    st_point(p_lng, p_lat)::geography,
    p_meters
  );
  return nearby_count > 0;
end;
$$;
