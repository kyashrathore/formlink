-- Formlink core schema. Forms carry no field schema: the shape of `data` is whatever the user's app sends.

CREATE TABLE workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- Secret API keys. Only the SHA-256 hash is stored.
CREATE TABLE api_keys (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'read')),
  hash TEXT NOT NULL UNIQUE,
  prefix TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_used_at INTEGER,
  revoked_at INTEGER
);
CREATE INDEX api_keys_workspace ON api_keys(workspace_id);

CREATE TABLE forms (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  settings TEXT NOT NULL DEFAULT '{}',
  hook_version INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX forms_workspace ON forms(workspace_id);

-- Versioned hook scripts (ES module source) run in Dynamic Workers.
CREATE TABLE form_hooks (
  form_id TEXT NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  code TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (form_id, version)
);

CREATE TABLE hook_runs (
  id TEXT PRIMARY KEY,
  form_id TEXT NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  submission_id TEXT,
  event TEXT NOT NULL,
  version INTEGER NOT NULL,
  ok INTEGER NOT NULL,
  error TEXT,
  logs TEXT,
  duration_ms INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX hook_runs_form ON hook_runs(form_id, created_at DESC);

-- Workspace secrets, AES-GCM encrypted with SECRETS_KEY. Exposed to hooks, never returned by the API.
CREATE TABLE secrets (
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  ciphertext TEXT NOT NULL,
  iv TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (workspace_id, name)
);

CREATE TABLE submissions (
  id TEXT PRIMARY KEY,
  form_id TEXT NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL,
  session_id TEXT,
  status TEXT NOT NULL,
  data TEXT NOT NULL DEFAULT '{}',
  computed TEXT NOT NULL DEFAULT '{}',
  meta TEXT NOT NULL DEFAULT '{}',
  verified TEXT,
  payment TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  completed_at INTEGER
);
CREATE INDEX submissions_form_created ON submissions(form_id, created_at DESC);
CREATE UNIQUE INDEX submissions_form_session ON submissions(form_id, session_id) WHERE session_id IS NOT NULL;

CREATE TABLE files (
  id TEXT PRIMARY KEY,
  form_id TEXT NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  session_id TEXT,
  submission_id TEXT,
  r2_key TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  size INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX files_form_session ON files(form_id, session_id);
CREATE INDEX files_submission ON files(submission_id);

-- Funnel events from the user's app: view, start, step, complete.
CREATE TABLE events (
  form_id TEXT NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  type TEXT NOT NULL,
  step TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX events_form_created ON events(form_id, created_at);

CREATE TABLE verifications (
  id TEXT PRIMARY KEY,
  form_id TEXT NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  target TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  expires_at INTEGER NOT NULL,
  verified_at INTEGER
);

-- Hosted apps (forms, views, dashboards) built by the user's AI.
CREATE TABLE sites (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'private')),
  share_token TEXT NOT NULL,
  -- Forms whose submissions a private site may read (JSON array of form ids).
  data_forms TEXT NOT NULL DEFAULT '[]',
  active_deployment TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX sites_workspace ON sites(workspace_id);

CREATE TABLE deployments (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  manifest TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX deployments_site ON deployments(site_id, created_at DESC);

CREATE TABLE domains (
  hostname TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL,
  cf_id TEXT,
  status TEXT NOT NULL,
  verification TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX domains_site ON domains(site_id);
