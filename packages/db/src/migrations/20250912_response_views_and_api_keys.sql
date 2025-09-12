-- Enums
DO $$ BEGIN
  CREATE TYPE public_access_level AS ENUM ('read_only', 'read_write', 'full_access');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE action_status AS ENUM ('pending', 'running', 'completed', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Saved response views
CREATE TABLE IF NOT EXISTS public.response_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id UUID NOT NULL REFERENCES public.forms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  columns JSONB NOT NULL DEFAULT '[]'::jsonb,
  sort_config JSONB,
  is_default BOOLEAN DEFAULT false,

  -- Public access settings
  is_public BOOLEAN DEFAULT false,
  public_access_level public_access_level DEFAULT 'read_only',
  public_api_key_required BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_response_views_form ON public.response_views(form_id);
CREATE INDEX IF NOT EXISTS idx_response_views_user ON public.response_views(user_id);

-- API keys for public access
CREATE TABLE IF NOT EXISTS public.formlink_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_prefix VARCHAR(32) NOT NULL,
  key_hash TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id UUID,

  name VARCHAR(255) NOT NULL,
  permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
  allowed_origins TEXT[],
  allowed_ips INET[],
  rate_limit_per_minute INTEGER DEFAULT 100,
  view_access JSONB,

  last_used_at TIMESTAMPTZ,
  usage_count INTEGER DEFAULT 0,

  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(key_hash)
);

CREATE INDEX IF NOT EXISTS idx_api_keys_prefix_active ON public.formlink_api_keys(key_prefix, is_active);
CREATE INDEX IF NOT EXISTS idx_api_keys_user_active ON public.formlink_api_keys(user_id, is_active);

-- Action execution log
CREATE TABLE IF NOT EXISTS public.response_actions_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id UUID NOT NULL REFERENCES public.forms(id) ON DELETE CASCADE,
  action_name VARCHAR(255) NOT NULL,
  submission_ids UUID[] NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,

  aci_function VARCHAR(255),
  aci_payload JSONB,

  status action_status DEFAULT 'pending',
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  result JSONB
);

