alter table public.forms
  add column if not exists branch_name text,
  add column if not exists preview_url text,
  add column if not exists live_url text,
  add column if not exists last_deployed_at timestamptz,
  add column if not exists published_at timestamptz;
