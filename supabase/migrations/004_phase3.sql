-- Phase 3: push token storage, deep link slug

alter table public.profiles
  add column if not exists push_token text;

-- Allow users to update their own push token
-- (profiles_update policy already covers this via auth.uid() = id)
