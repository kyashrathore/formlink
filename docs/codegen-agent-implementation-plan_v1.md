# Formcraft Codegen Agent — Implementation Plan (Vercel Sandbox + Cloudflare Pages)

Status: Implementation Plan v1 • Last updated: 2025-10-23
See also: `docs/codegen-agent-integration_v1.md` for architecture and contracts.

## Objectives

- Replace legacy createForm flow with a codegen tool that generates working code per `packages/runtime/docs/formlink-runtime-spec_v1_normative_only.md`.
- Execute inside Vercel Sandbox; use Claude/Codex CLIs; push to a GitHub template repo branch `form-<formId>`.
- Build with Bun + Vite and deploy via Cloudflare Pages Direct Upload; stream progress to chat.
- In the dashboard, the Form tab becomes the embedded preview; `/f/<shortId>` redirects to live/preview URL.

## Environment & Config (server-only)

- Vercel Sandbox
  - `SANDBOX_VERCEL_TOKEN`
  - `SANDBOX_VERCEL_TEAM_ID`
  - `SANDBOX_VERCEL_PROJECT_ID`
- GitHub
  - `CODEGEN_GITHUB_TOKEN` (PAT or App token with repo R/W)
  - `CODEGEN_GITHUB_REPO` (e.g., `org/repo` or full HTTPS URL)
  - Optional: `CODEGEN_GIT_AUTHOR_NAME` (default `Formlink Codegen Bot`)
  - Optional: `CODEGEN_GIT_AUTHOR_EMAIL` (default `bot@formlink.ai`)
- Agents
  - `ANTHROPIC_API_KEY` (Claude CLI)
  - `AI_GATEWAY_API_KEY` or `OPENAI_API_KEY` (Codex CLI)
- Deploy (Cloudflare Pages)
  - `CF_API_TOKEN`
  - `CF_ACCOUNT_ID`
  - `CF_PAGES_PROJECT`
- Feature flag
  - `CODEGEN_PREVIEW_UI=true` (swap Form tab to preview and hide old Preview tab)

## Data Model Changes

- Table `forms` add columns:
  - `branch_name text`
  - `preview_url text`
  - `live_url text`
  - `last_deployed_at timestamptz`
  - `published_at timestamptz`
- Migration: safe up/down SQL; update server types if applicable.

## High-Level Phases

- Phase 1: Copy core sandbox helpers and logging (from template)
- Phase 2: Copy agents (Claude/Codex) and add StreamLogger
- Phase 3: Orchestration API `/api/codegen/run` (SSE)
- Phase 4: Chat tool `generateCode` + system prompt
- Phase 5: Cloudflare deploy util + DB persistence
- Phase 6: UI integration (Form tab preview, redirect route)
- Phase 7: Tests, redaction audit, rollout flag

## Copy/Extract From coding-agent-template (minimize new code)

- Sandbox command wrapper
  - From: `coding-agent-template/lib/sandbox/commands.ts`
  - To: `apps/formcraft/app/lib/codegen/sandbox/commands.ts`
- Sandbox registry (keepAlive)
  - From: `coding-agent-template/lib/sandbox/sandbox-registry.ts`
  - To: `apps/formcraft/app/lib/codegen/sandbox/registry.ts`
- Redaction helpers
  - From: `coding-agent-template/lib/utils/logging.ts` (only `redactSensitiveInfo`, `create*Log` if needed)
  - To: `apps/formcraft/app/lib/codegen/logging.ts`
- Package manager detection
  - From: `coding-agent-template/lib/sandbox/package-manager.ts`
  - To: `apps/formcraft/app/lib/codegen/sandbox/package-manager.ts`
  - Edit: add Bun detection (`bun.lockb` or `which bun`), prefer `bun install` for Vite template
- Sandbox creation + Git bootstrap
  - From: `coding-agent-template/lib/sandbox/creation.ts`
  - To: `apps/formcraft/app/lib/codegen/sandbox/creation.ts`
  - Edits:
    - Install Bun if missing in sandbox; then `bun install` else fallback to npm
    - Predetermined branch `form-<formId>`; if exists on remote fetch/checkout; else create
    - Keep `.gitignore` augmentation and progress logs
- Git helpers
  - From: `coding-agent-template/lib/sandbox/git.ts`
  - To: `apps/formcraft/app/lib/codegen/sandbox/git.ts`
  - Keep permissive push handling (`pushFailed` boolean)
- Env validation + repo URL auth
  - From: `coding-agent-template/lib/sandbox/config.ts`
  - To: `apps/formcraft/app/lib/codegen/sandbox/config.ts`
  - Edits: require SANDBOX*VERCEL*\* + GitHub token; prefer `git -c http.extraHeader="Authorization: Bearer $TOKEN"` over URL credentials
- Agents (CLIs)
  - From: `coding-agent-template/lib/sandbox/agents/claude.ts`, `lib/sandbox/agents/codex.ts`
  - To: `apps/formcraft/app/lib/codegen/agents/claude.ts`, `apps/formcraft/app/lib/codegen/agents/codex.ts`
  - Replace `TaskLogger` import with `StreamLogger`
- Optional generators (AI optional)
  - From: `coding-agent-template/lib/utils/{branch-name,commit-message,title}-*.ts`
  - To: `apps/formcraft/app/lib/codegen/generation/{branch,commit,title}.ts`

## New Modules To Create

- `apps/formcraft/app/lib/codegen/stream-logger.ts`
  - Methods: `info`, `command`, `error`, `success`, `updateProgress`, `updateStatus`
  - Each writes an SSE-safe, redacted event via the AI SDK writer
- `apps/formcraft/app/lib/deploy/cloudflare.ts`
  - `deployDistToCloudflare({ accountId, project, token, branch, distPath }): Promise<{ url: string }>`
- `apps/formcraft/app/lib/codegen/sandbox/config.ts` (ported + tightened)

## API: POST `/api/codegen/run` (SSE)

- Path: `apps/formcraft/app/api/codegen/run/route.ts`
- Request (JSON)
  - `{ formId, repoUrl, baseBranch?: "main", branchName?: "form-<formId>", agent?: "claude"|"codex", model?: string, keepAlive?: boolean, maxDuration?: number, instruction: string }`
- Streamed events
  - `status`: "sandbox_created" | "installing_deps" | "executing_agent" | "committing" | "pushing" | "building" | "deploying" | "complete"
  - `command`: `{ cmd, args?, exitCode? }`
  - `log`: `{ message }` (redacted)
  - `push`: `{ branchName, success, pushFailed? }`
  - `preview`: `{ url }`
  - `error`: `{ code, message, details? }`
  - `complete`: `{ success, branchName?, previewUrl?, liveUrl? }`
- Orchestration (step-by-step)
  - Validate payload + env via `sandbox/config.ts`
  - Open SSE stream; create `StreamLogger(writer)`
  - `createSandbox({ repoUrl, timeout, ports:[5173], runtime:"node22", preDeterminedBranchName:"form-<formId>", githubToken: CODEGEN_GITHUB_TOKEN, keepAlive })`
  - Install CLIs as needed; run agent:
    - Claude default: `executeClaude(instruction, { sandbox, model, logger })`
    - Optional Codex: `executeCodex(…)` when agent="codex"
  - If success or changes:
    - Generate/fallback commit message → `pushChangesToBranch(sandbox, branchName)`
    - Build: `bun run build` → `dist/`
    - Deploy: `deployDistToCloudflare({ accountId, project, token, branch, distPath })` → save `preview_url` in DB
  - Emit `complete` and close stream
- Error handling
  - Emit `error` event with actionable hints (PAT scope, 403 push, missing keys)
  - Always redact secrets from stdout/stderr

## StreamLogger (drop-in for TaskLogger)

- API parity with template’s logger so agents compile with minimal changes
- Emits SSE events instead of DB writes; always call `redactSensitiveInfo` on messages

## Cloudflare Pages: Direct Upload

- Build: `bun run build` → `dist/`
- Upload: POST Direct Upload API with headers `CF_API_TOKEN`, path params `{accountId, project}` and query/body including `branch=form-<formId>`
- Response: parse `url` (e.g., `https://<preview>.pages.dev`), set as `preview_url`
- Production: on Publish, repeat upload to production environment per Pages API; set `live_url` + `published_at`

## Agents (CLIs) — Practical Notes

- Claude CLI
  - Global install inside sandbox: `npm i -g @anthropic-ai/claude-code`
  - Auth: create `$HOME/.config/claude/config.json` with `api_key` and `default_model`
- Codex CLI
  - Global install inside sandbox: `npm i -g @openai/codex`
  - Auth: prefer `AI_GATEWAY_API_KEY`; write `~/.codex/config.toml` (vercel-ai-gateway or openai provider)

## Instruction Input (no legacy builder)

- Build a concise, deterministic `instruction` per runtime spec using the current form’s intent and (optionally) its saved schema; never call the legacy form builder path. The instruction should:
  - Include the condensed Runtime Contract, target files for Vite, and acceptance checks (typecheck/build)
  - Specify Bun + Vite tasks and Tailwind/Provider wiring

## UI Integration

- Replace Form tab content with an embedded preview (behind `CODEGEN_PREVIEW_UI`)
  - If `live_url` exists → load it; else if `preview_url` exists → load it; else show building state
  - Keep device controls and Publish button
- Hide the old Preview tab when the flag is enabled
- Add redirect route `apps/formcraft/app/f/[shortId]/route.ts`
  - 302 → `live_url` if present, else `preview_url`; 404 if neither; add `noindex` on preview

## Testing & Validation

- Dry run on a small form prompt:
  - Expect: sandbox created, bun install, agent executed, branch pushed, build + deploy to Pages, `preview_url` visible in dashboard
- Failure modes:
  - 403 push: show guidance on repo permissions; still return `pushFailed`
  - Build error: show first stderr lines via SSE; keep branch for debugging
  - Missing keys: fail fast with `error` event

## Rollout Plan

- Stage 1 (internal): enable `CODEGEN_PREVIEW_UI` and `generateCode` for selected users; Claude default
- Stage 2: optional Codex agent selection; polish logs and error hints
- Stage 3: default on; remove legacy createForm path and UI remnants

## Work Items (by file)

- New
  - `apps/formcraft/app/api/codegen/run/route.ts`
  - `apps/formcraft/app/lib/codegen/sandbox/commands.ts`
  - `apps/formcraft/app/lib/codegen/sandbox/registry.ts`
  - `apps/formcraft/app/lib/codegen/sandbox/config.ts`
  - `apps/formcraft/app/lib/codegen/sandbox/creation.ts`
  - `apps/formcraft/app/lib/codegen/sandbox/package-manager.ts`
  - `apps/formcraft/app/lib/codegen/sandbox/git.ts`
  - `apps/formcraft/app/lib/codegen/logging.ts`
  - `apps/formcraft/app/lib/codegen/stream-logger.ts`
  - `apps/formcraft/app/lib/codegen/agents/claude.ts`
  - `apps/formcraft/app/lib/codegen/agents/codex.ts`
  - `apps/formcraft/app/lib/codegen/generation/branch.ts`
  - `apps/formcraft/app/lib/codegen/generation/commit.ts`
  - `apps/formcraft/app/lib/codegen/generation/title.ts`
  - `apps/formcraft/app/lib/deploy/cloudflare.ts`
  - `apps/formcraft/app/lib/chat/tools/generate-code.ts`
  - `apps/formcraft/app/f/[shortId]/route.ts`
  - `packages/prompts/md/chat/codegen-system.md`
- Modified
  - `apps/formcraft/app/lib/chat/tools/index.ts` (register `generateCode`; gate `createForm`)
  - `apps/formcraft/app/lib/chat/prompts/tool-descriptions.ts` (add `generateCode`)
  - `apps/formcraft/app/dashboard/forms/[formId]/components/TabContentManager.tsx` (Form→preview)
  - `apps/formcraft/app/dashboard/forms/[formId]/components/NavigationBar.tsx` (hide Preview tab behind flag)
  - `apps/formcraft/app/dashboard/forms/[formId]/components/PreviewTabContent.tsx` (embed external URL)
  - Supabase migration for `forms` columns

## Risks & Mitigations

- Sandbox startup latency → shallow clone + install once per keepAlive; stream clear progress
- Token leakage → strict redaction; never embed creds in URLs; prefer http.extraHeader
- Build failures → keep branch, stream errors, allow retry
- Push denied → emit `pushFailed`; provide PAT scope instructions
