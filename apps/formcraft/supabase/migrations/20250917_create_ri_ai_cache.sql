-- Cache table for AI summaries (RI)
create table if not exists public.ri_ai_cache (
  id text primary key,
  value jsonb not null default '{}'::jsonb,
  meta jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.ri_ai_cache enable row level security;

-- Simple RLS: allow service role full access; deny others by default
create policy "Service role can manage ri_ai_cache"
on public.ri_ai_cache
as permissive
for all
to service_role
using (true)
with check (true);

comment on table public.ri_ai_cache is 'Keyed cache for AI-generated response intelligence summaries.';
