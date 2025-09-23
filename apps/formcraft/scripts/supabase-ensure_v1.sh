#!/usr/bin/env bash
set -euo pipefail

# -----------------------------------------------------------------------------
# Formlink Dev Bootstrap – Supabase Ensure (Design Notes + Rationale)
# -----------------------------------------------------------------------------
# Problem (observed):
# - Hitting /auth/v1/authorize?provider=google returned:
#     {"code":400,"error_code":"validation_failed","msg":"Unsupported provider: provider is not enabled"}
# - Supabase CLI v2 started containers fine, but the GoTrue (auth) container did
#   not receive the Google OAuth env vars even when set in:
#   - config.local.toml via --config (not supported by `supabase start`)
#   - SUPABASE_AUTH_EXTERNAL_GOOGLE_* process vars (not forwarded to GoTrue)
#   - docker-compose.override.yml (not merged reliably by CLI)
#   - config.toml hardcoding or env(...) + `start --env-file` (not supported)
#
# Why the above didn’t work (current CLI behavior):
# - `supabase start` (CLI v2.x) orchestrates a compose stack with service env
#   resolved at generation time. In practice, the external provider envs (Google)
#   don’t consistently propagate from the project workdir `.env` or process env
#   into the GoTrue container.
# - The only consistently reliable methods locally were:
#   (a) configuring via Studio UI (writes directly to GoTrue service env), or
#   (b) recreating the GoTrue container with explicit env injected.
#
# Our fix (what this script does):
# 1) Idempotently ensure Supabase is running from the canonical workdir
#    `packages/db/supabase` (we removed the legacy apps/formcraft/supabase).
# 2) Sync Google creds from apps/formcraft/.env to packages/db/supabase/.env for
#    clarity, but DO NOT rely on it (CLI may ignore). We still export them.
# 3) Health‑probe /auth/v1/authorize. If provider is disabled but we have creds,
#    we recreate ONLY the auth container (`supabase_auth_supabase`) with
#    GOTRUE_EXTERNAL_GOOGLE_* envs appended, preserving all other env and the
#    existing network. This reliably flips provider=google to enabled.
# 4) We also clean up conflicting containers by labels/names to avoid start
#    failures like "container name already in use".
#
# Why this is safe:
# - We do NOT touch volumes or database data. We only replace the auth container
#   with the same image and network + augmented env file. Other services remain.
# - Idempotent: If auth is already correct, we skip recreation.
#
# How to verify quickly:
# - `curl -s http://127.0.0.1:54321/auth/v1/settings | python3 -m json.tool | \`
#     grep -E '"google":|"email":'` → should show "google": true
# - `curl -iG http://127.0.0.1:54321/auth/v1/authorize \`
#     --data-urlencode provider=google \`
#     --data-urlencode redirect_to=http://localhost:3000` → HTTP 302 redirect
#
# Known limitations / future breakage risk:
# - If Supabase CLI changes container names/labels or the GoTrue env var schema
#   (e.g., renaming GOTRUE_EXTERNAL_GOOGLE_*), this recreation step may fail.
# - If you run multiple Supabase projects concurrently on the same host, our
#   label-based cleanup and the hardcoded auth container name may collide.
# - If your Google OAuth client does not include the redirect URI
#   http://localhost:54321/auth/v1/callback, Google will refuse the flow.
# - If you change site_url/allow list to different origins, adjust the envs.
# - Ideally Supabase CLI will eventually honor config.toml env(...) for GoTrue;
#   if/when that happens, this hack can be removed.
#
# Manual fallback (if needed):
# - Open Studio (http://localhost:54323) → Auth → Providers → Google → enable,
#   paste Client ID/Secret → Save.
#
# TODOs:
# - If CLI starts accepting `start --env-file` or fully honoring env(...) for
#   GoTrue, prefer that path and delete the container recreation block below.
# - Support additional providers similarly if added.
# -----------------------------------------------------------------------------

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$DIR/../../.." && pwd)"

PORT=54321

# Defaults for site config
SITE_URL_DEFAULT="http://localhost:3000"
ALLOW_LIST_DEFAULT="http://localhost:3000,https://localhost:3000,http://127.0.0.1:3000,https://127.0.0.1:3000"

# Read local Supabase env for provider detection
DB_ENV_FILE="$ROOT/packages/db/supabase/.env"
APP_ENV_FILE="$ROOT/apps/formcraft/.env"
ROOT_ENV_FILE="$ROOT/.env"

GOOGLE_ENV_PRESENT=false

# Load env from canonical DB workdir .env
if [[ -f "$DB_ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  source <(grep -E '^(GOOGLE_CLIENT_ID|GOOGLE_CLIENT_SECRET|GOTRUE_EXTERNAL_GOOGLE_ENABLED|GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID|GOTRUE_EXTERNAL_GOOGLE_SECRET)=' "$DB_ENV_FILE" | sed 's/\r$//') || true
fi

# Fallback: also load from app .env if DB .env didn’t define them
if [[ -f "$APP_ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  source <(grep -E '^(GOOGLE_CLIENT_ID|GOOGLE_CLIENT_SECRET|GOTRUE_EXTERNAL_GOOGLE_ENABLED|GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID|GOTRUE_EXTERNAL_GOOGLE_SECRET)=' "$APP_ENV_FILE" | sed 's/\r$//') || true
fi

# Also look at repo root .env (per Supabase docs) – load all keys
if [[ -f "$ROOT_ENV_FILE" ]]; then
  set +u
  set -a
  # shellcheck disable=SC1090
  source "$ROOT_ENV_FILE"
  set +a
  set -u
fi

# Map GOTRUE_* to GOOGLE_* if only GOTRUE_* exist
if [[ -z "${GOOGLE_CLIENT_ID:-}" && -n "${GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID:-}" ]]; then
  GOOGLE_CLIENT_ID="$GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID"
fi
if [[ -z "${GOOGLE_CLIENT_SECRET:-}" && -n "${GOTRUE_EXTERNAL_GOOGLE_SECRET:-}" ]]; then
  GOOGLE_CLIENT_SECRET="$GOTRUE_EXTERNAL_GOOGLE_SECRET"
fi

# Export for supabase CLI to pick up in config.toml (env(...)) – best effort
if [[ -n "${GOOGLE_CLIENT_ID:-}" ]]; then export GOOGLE_CLIENT_ID; fi
if [[ -n "${GOOGLE_CLIENT_SECRET:-}" ]]; then export GOOGLE_CLIENT_SECRET; fi
if [[ -z "${GOTRUE_EXTERNAL_GOOGLE_ENABLED:-}" && -n "${GOOGLE_CLIENT_ID:-}" && -n "${GOOGLE_CLIENT_SECRET:-}" ]]; then
  export GOTRUE_EXTERNAL_GOOGLE_ENABLED=true
fi

if [[ ( -n "${GOOGLE_CLIENT_ID:-}" && -n "${GOOGLE_CLIENT_SECRET:-}" ) || ( -n "${GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID:-}" && -n "${GOTRUE_EXTERNAL_GOOGLE_SECRET:-}" ) ]]; then
  GOOGLE_ENV_PRESENT=true
fi

stop_supabase() {
  echo "[dev] Stopping existing Supabase instances (best-effort)..."
  pnpm -C "$ROOT/packages/db" dlx supabase stop --project-id formcraft || true
  pnpm -C "$ROOT/packages/db" dlx supabase stop --workdir ./supabase || true
  pnpm -C "$ROOT/apps/formcraft" dlx supabase stop || true
}

cleanup_conflicting_supabase() {
  echo "[dev] Checking for conflicting Supabase containers..."
  # Prefer label-based cleanup
  local ids
  ids="$(docker ps -a -q --filter label=com.supabase.cli.project=formcraft)"
  ids+=$'\n'"$(docker ps -a -q --filter label=com.supabase.cli.project=supabase)"
  ids=$(echo "$ids" | sort -u | awk 'NF')
  if [[ -n "$ids" ]]; then
    echo "[dev] Removing containers for projects: formcraft/supabase (best-effort)"
    echo "$ids" | xargs -I{} docker rm -f {} || true
  fi

  # Fallback name-based cleanup
  local name_ids
  name_ids=$(docker ps -a --format '{{.ID}} {{.Names}}' | awk '/^/ { if ($2 ~ /^supabase_.*_(formcraft|supabase)$/) print $1 }')
  if [[ -n "$name_ids" ]]; then
    echo "[dev] Removing name-matching containers: supabase_*_(formcraft|supabase)"
    echo "$name_ids" | xargs -I{} docker rm -f {} || true
  fi
}

force_recreate_auth_with_env() {
  local WANT_CID="$1"
  local WANT_SEC="$2"
  local AUTH_NAME=supabase_auth_supabase
  local IMAGE NET ENVFILE
  IMAGE=$(docker inspect -f '{{.Config.Image}}' "$AUTH_NAME" 2>/dev/null || echo "")
  NET=$(docker inspect -f '{{range $k,$v := .NetworkSettings.Networks}}{{println $k}}{{end}}' "$AUTH_NAME" 2>/dev/null | head -n1)
  if [[ -z "$IMAGE" || -z "$NET" ]]; then
    echo "[dev][auth] Could not locate auth container metadata; skipping recreation."
    return 0
  fi
  ENVFILE=$(mktemp)
  # Take current env and remove keys we are about to override to avoid dupes
  docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "$AUTH_NAME" \
    | grep -Ev '^(GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID|GOTRUE_EXTERNAL_GOOGLE_SECRET|GOTRUE_EXTERNAL_GOOGLE_ENABLED|GOTRUE_EXTERNAL_GOOGLE_REDIRECT_URI|GOTRUE_EXTERNAL_GOOGLE_SKIP_NONCE_CHECK|GOTRUE_SITE_URL|GOTRUE_URI_ALLOW_LIST)=' \
    > "$ENVFILE"
  {
    echo "GOTRUE_EXTERNAL_GOOGLE_ENABLED=true"
    echo "GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID=${WANT_CID}"
    echo "GOTRUE_EXTERNAL_GOOGLE_SECRET=${WANT_SEC}"
    echo "GOTRUE_EXTERNAL_GOOGLE_REDIRECT_URI=http://localhost:54321/auth/v1/callback"
    echo "GOTRUE_EXTERNAL_GOOGLE_SKIP_NONCE_CHECK=true"
    # Prefer localhost, but also allow 127.0.0.1 (http+https)
    echo "GOTRUE_SITE_URL=$SITE_URL_DEFAULT"
    echo "GOTRUE_URI_ALLOW_LIST=$ALLOW_LIST_DEFAULT"
  } >> "$ENVFILE"
  docker rm -f "$AUTH_NAME" >/dev/null 2>&1 || true
  docker run -d --name "$AUTH_NAME" --network "$NET" --network-alias auth \
    --env-file "$ENVFILE" "$IMAGE" >/dev/null
  echo "[dev][auth] Auth container recreated with Google + site env."
}

read_env_kv() {
  # usage: read_env_kv <file> <key>
  local F="$1"; local K="$2"
  if [[ -f "$F" ]]; then
    sed -n "s/^${K}=\(.*\)\{0,1\}$/\1/p" "$F" | tail -n1
  fi
}

ensure_auth_env() {
  local AUTH_ID
  AUTH_ID=$(docker ps --format '{{.ID}} {{.Names}}' | awk '/auth/ {print $1; exit}')
  if [[ -z "$AUTH_ID" ]]; then
    echo "[dev][auth] Auth container not found; skipping env ensure."
    return 0
  fi
  local CUR_ENVS
  CUR_ENVS=$(docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "$AUTH_ID" 2>/dev/null || true)

  # Resolve desired values
  local WANT_CID WANT_SEC WANT_SITE WANT_ALLOW
  # Resolve from env first, then fall back to .env files
  WANT_CID="${GOOGLE_CLIENT_ID:-${GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID:-}}"
  WANT_SEC="${GOOGLE_CLIENT_SECRET:-${GOTRUE_EXTERNAL_GOOGLE_SECRET:-}}"
  if [[ -z "$WANT_CID" ]]; then
    WANT_CID=$(read_env_kv "$ROOT_ENV_FILE" GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID || true)
    [[ -z "$WANT_CID" ]] && WANT_CID=$(read_env_kv "$ROOT_ENV_FILE" GOOGLE_CLIENT_ID || true)
    [[ -z "$WANT_CID" ]] && WANT_CID=$(read_env_kv "$DB_ENV_FILE" GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID || true)
    [[ -z "$WANT_CID" ]] && WANT_CID=$(read_env_kv "$DB_ENV_FILE" GOOGLE_CLIENT_ID || true)
    [[ -z "$WANT_CID" ]] && WANT_CID=$(read_env_kv "$APP_ENV_FILE" GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID || true)
    [[ -z "$WANT_CID" ]] && WANT_CID=$(read_env_kv "$APP_ENV_FILE" GOOGLE_CLIENT_ID || true)
  fi
  if [[ -z "$WANT_SEC" ]]; then
    WANT_SEC=$(read_env_kv "$ROOT_ENV_FILE" GOTRUE_EXTERNAL_GOOGLE_SECRET || true)
    [[ -z "$WANT_SEC" ]] && WANT_SEC=$(read_env_kv "$ROOT_ENV_FILE" GOOGLE_CLIENT_SECRET || true)
    [[ -z "$WANT_SEC" ]] && WANT_SEC=$(read_env_kv "$DB_ENV_FILE" GOTRUE_EXTERNAL_GOOGLE_SECRET || true)
    [[ -z "$WANT_SEC" ]] && WANT_SEC=$(read_env_kv "$DB_ENV_FILE" GOOGLE_CLIENT_SECRET || true)
    [[ -z "$WANT_SEC" ]] && WANT_SEC=$(read_env_kv "$APP_ENV_FILE" GOTRUE_EXTERNAL_GOOGLE_SECRET || true)
    [[ -z "$WANT_SEC" ]] && WANT_SEC=$(read_env_kv "$APP_ENV_FILE" GOOGLE_CLIENT_SECRET || true)
  fi
  WANT_SITE="$SITE_URL_DEFAULT"
  WANT_ALLOW="$ALLOW_LIST_DEFAULT"

  local NEED_RECREATE=0
  # If provider envs are missing or different, mark recreate
  if [[ -n "$WANT_CID" ]] && ! echo "$CUR_ENVS" | grep -q "^GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID=${WANT_CID}$"; then NEED_RECREATE=1; fi
  if [[ -n "$WANT_SEC" ]] && ! echo "$CUR_ENVS" | grep -q "^GOTRUE_EXTERNAL_GOOGLE_SECRET=${WANT_SEC}$"; then NEED_RECREATE=1; fi
  # If site settings not aligned, mark recreate
  if ! echo "$CUR_ENVS" | grep -q "^GOTRUE_SITE_URL=${WANT_SITE}$"; then NEED_RECREATE=1; fi
  if ! echo "$CUR_ENVS" | grep -q "^GOTRUE_URI_ALLOW_LIST=.*localhost:3000"; then NEED_RECREATE=1; fi

  if [[ "$NEED_RECREATE" -eq 1 ]]; then
    echo "[dev][auth] Reconciling auth env (google + site) via container recreation..."
    force_recreate_auth_with_env "$WANT_CID" "$WANT_SEC"
  else
    echo "[dev][auth] Auth env already aligned."
  fi
}

if lsof -Pi :"$PORT" -sTCP:LISTEN -t >/dev/null 2>&1; then
  echo "[dev] Supabase detected on port $PORT — skipping start."
  ensure_auth_env
  # continue to PostgREST schema probe below
else

echo "[dev] Starting local Supabase (packages/db)..."
cleanup_conflicting_supabase

# Ensure env is synced into workdir for CLI to load
bash "$DIR/sync-supabase-env_v1.sh" || true

if ! pnpm -C "$ROOT/packages/db" dlx supabase start --workdir ./supabase; then
  echo "[dev] Start failed; attempting cleanup and retry..."
  stop_supabase
  cleanup_conflicting_supabase
  bash "$DIR/sync-supabase-env_v1.sh" || true
  pnpm -C "$ROOT/packages/db" dlx supabase start --workdir ./supabase
fi

echo "[dev] Supabase started."

# Force-enable Google provider or correct site_url/allow_list
PROBE=$(curl -s "http://127.0.0.1:54321/auth/v1/authorize?provider=google&redirect_to=http%3A%2F%2Flocalhost%3A3000") || true
AUTH_ENV_ID=$(docker ps --format '{{.ID}} {{.Names}}' | awk '/auth/ {print $1; exit}')
AUTH_ENVS=""
if [[ -n "$AUTH_ENV_ID" ]]; then
  AUTH_ENVS=$(docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "$AUTH_ENV_ID" 2>/dev/null || true)
fi

NEED_SITE_FIX=0
if ! echo "$AUTH_ENVS" | grep -q '^GOTRUE_SITE_URL=http://localhost:3000$'; then
  NEED_SITE_FIX=1
fi
if ! echo "$AUTH_ENVS" | grep -q 'GOTRUE_URI_ALLOW_LIST=.*localhost:3000'; then
  NEED_SITE_FIX=1
fi

ensure_auth_env

# Fix PostgREST schema cache if forms table missing
echo "[dev][db] Probing REST schema for public.forms..."
ANON="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"
REST_PROBE=$(curl -s -H "apikey: $ANON" "http://127.0.0.1:54321/rest/v1/forms?select=count" || true)
if echo "$REST_PROBE" | grep -qi "Could not find the table 'public.forms' in the schema cache"; then
  echo "[dev][db] REST schema cache missing forms. Applying schema.sql + restarting rest..."
  if command -v psql >/dev/null 2>&1; then
    export PGPASSWORD=postgres
    psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -v ON_ERROR_STOP=1 -f "$ROOT/packages/db/supabase/schema.sql" || true
    psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -c "NOTIFY pgrst, 'reload schema';" || true
  else
    echo "[dev][db] psql not found, skipping direct apply."
  fi
  docker restart supabase_rest_supabase >/dev/null 2>&1 || true
  echo "[dev][db] Rest restarted. Reprobe..."
  sleep 1
  curl -s -H "apikey: $ANON" "http://127.0.0.1:54321/rest/v1/forms?select=count" || true
fi

# Preflight: Auth provider hints
if [[ -z "${GOOGLE_CLIENT_ID:-${GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID:-}}" || -z "${GOOGLE_CLIENT_SECRET:-${GOTRUE_EXTERNAL_GOOGLE_SECRET:-}}" ]]; then
  echo "[dev][auth] Google OAuth not configured (no GOOGLE_* or GOTRUE_* creds)."
  echo "[dev][auth] Add to packages/db/supabase/.env or repo .env:"
  echo "             GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID=..."
  echo "             GOTRUE_EXTERNAL_GOOGLE_SECRET=..."
fi

# Close top-level start/else branch
fi

# TODO(dev): Consider adding a health check for 54321/54322 readiness.
