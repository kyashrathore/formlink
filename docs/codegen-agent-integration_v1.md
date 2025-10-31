# Formcraft In‑App Codegen Agent (Claude + Codex)

Status: Draft v1 • Last updated: 2025-10-23

This document defines how we replace the legacy form‑creation agent with an in‑app code generation agent that produces working Next.js code conforming to our Runtime spec (see `packages/runtime/docs/formlink-runtime-spec_v1_normative_only.md`). We do NOT host `coding-agent-template` separately; instead we extract only the minimal logic needed and embed it inside Formcraft.

---

## 1) Goals

- Turn a user prompt + (optional) schema into a working code branch that implements the Runtime spec.
- Run CLI coding agents (start with Claude CLI and Codex CLI) inside a Vercel Sandbox ephemeral workspace cloned from our template repo/branch.
- Stream progress to chat (status/commands/logs/commit/push/complete/errors).
- Commit + push to a feature branch and return branchName and optional preview link.
- Keep v1 simple: one‑off streaming (no persistent task DB). Add history later if needed.

---

## 2) Architecture (Option B — One‑Off Streaming)

- Chat (AI SDK) → `generateCode` tool → POST `/api/codegen/run`.
- API handler:
  - Create/attach a Vercel Sandbox workspace from `repoUrl` + `baseBranch`.
  - Optionally install deps (`bun install` for Bun template); detect package manager.
  - Execute selected agent (Claude or Codex) with a single, deterministic instruction built from the Runtime spec + current schema.
  - Git add/commit/push to `feature/formcraft-<formId>-<shortId>`.
  - Optionally start a preview server inside the sandbox when `keepAlive` is true; emit preview URL if available.
  - Stream events back to the chat tool until complete.

No task rows or SSE multiplexer in v1; the chat connection is the stream.

Note: Execution always uses Vercel Sandbox. Local workspace mode is out of scope.

---

## 3) New/Changed Modules (Paths)

API

- `apps/formcraft/app/api/codegen/run/route.ts`
  - POST only; responds with `text/event-stream`.
  - Validates body: `{ repoUrl: string, baseBranch?: string, branchName?: string, agent: 'claude'|'codex', model?: string, instruction: string, keepAlive?: boolean, maxDuration?: number }`.
  - Emits events (see §7). Gracefully closes on completion or error.

- Codegen core

- `apps/formcraft/app/lib/codegen/sandbox.ts`
  - `createSandboxFromRepo(repoUrl, baseBranch, { token, teamId, projectId })` using `@vercel/sandbox`.
  - `runInSandbox(cmd, args, opts)`; `detectPackageManager()`.
- `apps/formcraft/app/lib/codegen/git.ts`
  - `ensureBranch(workspace, baseBranch, branchName)`.
  - `commitAndPush(workspace, branchName, message)`.
- `apps/formcraft/app/lib/codegen/logging.ts`
  - `redactSensitiveInfo(str)`; stream helpers `emit(writer, type, payload)`.
- `apps/formcraft/app/lib/codegen/instruction.ts`
  - Instruction builder: schema + user intent + Runtime contract → single instruction string.

Agents

- `apps/formcraft/app/lib/codegen/agents/types.ts` — common interface.
- `apps/formcraft/app/lib/codegen/agents/claude.ts` — install + execute Claude CLI.
- `apps/formcraft/app/lib/codegen/agents/codex.ts` — install + execute Codex CLI.

Prompts

- `packages/prompts/md/chat/codegen-system.md` — chat system prompt that favors `generateCode`.
- `packages/prompts/md/codegen/instruction.md` — partial used by the instruction builder.

Chat tools

- `apps/formcraft/app/lib/chat/tools/generate-code.ts` — new tool that builds instruction and streams from `/api/codegen/run`.
- `apps/formcraft/app/lib/chat/tools/index.ts` — replace `createForm` with `generateCode`.
- `apps/formcraft/app/lib/chat/prompts/tool-descriptions.ts` — add description for `generateCode`.

Chat handler

- `apps/formcraft/app/api/chat/handlers/form-creation.ts`
  - Switch to `codegen-system.md` and stop when `generateCode` returns a result.

---

## 4) Runtime Contract (embed in instruction)

Source of truth: `packages/runtime/docs/formlink-runtime-spec_v1_normative_only.md`. The instruction builder must embed a condensed, operational version:

- State management: Use `@formlink/runtime` only; do not add `react-hook-form` or unmanaged `useState` for answers.
- Packages: `@formlink/runtime @formlink/ui motion react react-dom`. Add `@dnd-kit/*` when ranking is used.
- Client components: any file calling `createRuntime` or rendering runtime/ui must start with `'use client'`.
- CSS/Tailwind: import `@formlink/ui/globals.css` in `app/layout.tsx`; ensure Tailwind globs include runtime/ui content or safelist utilities.
- Shadcn provider: map primitives via `ShadCnProvider` using `@formlink/ui` exports.
- Patterns:
  - Typeform: `TypeFormLayout`, `TypeFormQuestionHeader`, `TypeFormContinueFooter`, `TypeFormNavigation`; use `runtime.actions.next()` and `actions.validate(qid)`.
  - Classic: loop `context.visibleIds`; wrap controls with `Field/Label/FieldControl/FieldMessage`; form submit calls `actions.validateAll()` then `actions.submit()`.
- Transport: prefer Formfiller‑compatible transport (`createFormfillerTransport`) with `{ formId, submissionId, formVersionId }`; use `createMockTransport` for dev.
- Files to generate/update:
  - `app/forms/[formId]/runtime.ts` — `createRuntime` with transport.
  - `app/forms/[formId]/page.tsx` — UI entry (Typeform or Classic) rendering runtime state.
  - `app/providers.tsx` — `ShadCnProvider` that maps to `@formlink/ui` primitives.
  - Tailwind config updates (content globs or safelist) + CSS import.
- Acceptance: repo typechecks; no TS errors; commit summarizes added/changed files.

---

## 5) Agents (CLI) — details

### Claude CLI (first‑class)

- Install: `npm i -g @anthropic-ai/claude-code`.
- Auth: write `$HOME/.config/claude/config.json` with `{ api_key: ANTHROPIC_API_KEY, default_model: <model> }`.
- Diagnostics: `claude --version`, `claude --help` (log outputs, redacted).
- Execute: run via `sh -c` with proper env; pass the single instruction (non‑interactive) and capture output.
- Detect changes: `git status --porcelain`.

### Codex CLI (second‑line)

- Install: `npm i -g @openai/codex`.
- Auth: prefer `AI_GATEWAY_API_KEY` (supports `vck_…` or `sk-…`).
- Config file: `~/.codex/config.toml` with provider section, e.g.:

  ```toml
  model = "openai/gpt-4o"
  model_provider = "vercel-ai-gateway" # or "openai"
  [model_providers.vercel-ai-gateway]
  name = "Vercel AI Gateway"
  base_url = "https://ai-gateway.vercel.sh/v1"
  env_key = "AI_GATEWAY_API_KEY"
  wire_api = "chat"
  [debug]
  log_requests = true
  ```

- Execute: `codex exec --dangerously-bypass-approvals-and-sandbox "<instruction>"`.
- Resume (later): `codex resume --last`.
- Detect changes: `git status --porcelain`.

---

## 6) Sandbox & Git

Sandbox

- Use `@vercel/sandbox` with `SANDBOX_VERCEL_TOKEN`, `SANDBOX_VERCEL_TEAM_ID`, `SANDBOX_VERCEL_PROJECT_ID`.
- TTL: `maxDuration` minutes; warn T‑60s (`status: approaching_timeout`).
- Commands (typical):
  - `git fetch --all --prune`
  - `git checkout -B <branch> origin/<baseBranch>` (create/reset local branch)
  - `git pull --ff-only` (optional)
  - `pnpm|yarn|npm install` if needed
  - `pnpm|yarn|npm run typecheck` (optional build)

Git

- Branch: `feature/formcraft-<formId>-<shortId>`; fallback timestamp.
- Commit message (v1 deterministic): `feat(formlink): generate <form-title> runtime UI` plus file summary.
- Push: `git add -A && git commit -m "…" && git push -u origin <branch>`; if push fails, emit error with guidance.

Dev server (keepAlive=true)

- Detect package manager; run `dev` script in detached mode; emit `preview` event with sandbox URL if available.

---

## 7) Streaming Event Protocol (SSE)

- `status`: string — "sandbox_created", "installing_deps", "executing_agent", "committing", "pushing", "complete", "approaching_timeout".
- `command`: { cmd: string, args?: string[], exitCode?: number }.
- `log`: { message: string } — stdout/stderr lines (apply redaction).
- `commit`: { filesChanged: number, summary: string[] }.
- `push`: { branchName: string, success: boolean }.
- `preview`: { url: string } (preview or production URL).
- `error`: { code: string, message: string, details?: unknown }.
- `complete`: { success: boolean, branchName?: string, previewUrl?: string, prUrl?: string }.

The chat tool should forward these into AI SDK UI events and end with a final tool result.

---

## 8) Chat Tool: `generateCode`

Inputs

- `{ formId, userPrompt, options?: { agent: 'claude'|'codex', model?: string, repoUrl: string, baseBranch?: string, branchName?: string, keepAlive?: boolean, maxDuration?: number } }`

Behavior

- Fetch current schema if available (via existing services) to incorporate into instruction.
- Build instruction with `instruction.ts` (embed Runtime contract and explicit file tasks).
- POST `/api/codegen/run` with payload; pipe SSE to the chat stream.
- On `complete`, return tool result `{ success, branchName, previewUrl? }`.

Tool description (short)

- "Generate or update code implementing the Formlink Runtime. Produce a working branch with pages/components wired to `@formlink/runtime` and `@formlink/ui`."

---

## 9) API Contract: `POST /api/codegen/run`

Request

```json
{
  "repoUrl": "https://github.com/org/repo.git",
  "baseBranch": "main",
  "branchName": "feature/formcraft-abc123",
  "agent": "claude",
  "model": "claude-sonnet-4.1",
  "instruction": "…instruction text…",
  "keepAlive": false,
  "maxDuration": 60
}
```

Response

- `text/event-stream` using the protocol in §7.

Error handling

- 400: validation; 401/403: auth; 500: sandbox/agent failure. Emit an `error` event before closing.

---

## 10) Security & Config

- Server env (never exposed to client)
  - GitHub: `CODEGEN_GITHUB_TOKEN`, `CODEGEN_GITHUB_REPO`, optional `CODEGEN_GIT_AUTHOR_NAME`, `CODEGEN_GIT_AUTHOR_EMAIL`.
  - Agents: `ANTHROPIC_API_KEY` (Claude), `AI_GATEWAY_API_KEY` or `OPENAI_API_KEY` (Codex).
  - Cloudflare Pages: `CF_API_TOKEN`, `CF_ACCOUNT_ID`, `CF_PAGES_PROJECT`.
  - Vercel Sandbox: `SANDBOX_VERCEL_TOKEN`, `SANDBOX_VERCEL_TEAM_ID`, `SANDBOX_VERCEL_PROJECT_ID`.

- Infra requirements
  - API host needs network access to Vercel Sandbox API; all build/CLI commands run inside the sandbox.

- Redaction rules: redact tokens (`sk-*`, `vck_*`), `Authorization: Bearer …`, secrets in URLs, emails when present.
- Command allowlist: `git`, `bun`, `node/npm/pnpm/yarn`, `claude`, `codex`, and preview/build scripts only.

---

## 11) Instruction Builder (outline)

Inputs: `{ formId, shortId, userPrompt, schema?, uiMode, transport, repoHints }`.

Structure:

1. Header with repo context, branch naming rule, package manager hint.
2. Runtime Contract bullets (§4).
3. Explicit file tasks (paths + responsibilities).
4. Tailwind + CSS requirements.
5. Validation steps (typecheck/build) the agent must run and fix before commit.
6. Commit message format + file summary.

Output: A single instruction string suitable for non‑interactive CLI execution.

---

## 12) Prompting Changes

- New system prompt `packages/prompts/md/chat/codegen-system.md`:
  - If the user asks to create/build a form, call `generateCode` exactly once.
  - Use `getFormContext` only to fetch schema when needed for instruction.
  - Do not call legacy `createForm`.

De-scope legacy builder

- We do not support the old metadata/questions instruction path in this experience. All creation and edits flow through `generateCode` and operate on code. Any legacy builder UI is hidden when the `CODEGEN_PREVIEW_UI` feature flag is enabled.

---

## 13) Migration Plan

Phase 0 — Config

- Add env vars for sandbox and CLIs; verify access to target repo.

Phase 1 — Core plumbing

- Implement `sandbox.ts`, `git.ts`, `logging.ts` (slim).
- Implement `agents/claude.ts` and `agents/codex.ts` based on extracted patterns.
- Add `/api/codegen/run` endpoint with streaming.

Phase 2 — Instruction + Tooling

- Add `instruction.ts` and `generate-code.ts` tool.
- Update tool descriptions and switch chat system to `codegen-system.md`.
- Stop the chat when the first successful `generateCode` completes.

Phase 3 — Polishing

- `keepAlive` dev server preview; better redaction; improved branch naming.

Phase 4 (optional) — History

- Persist runs to Supabase (history/resume); add webhooks.

---

## 14) Acceptance Criteria

- A single user message “Create a job application form” triggers exactly one `generateCode` call.
- Events stream within 10 seconds and show clear step transitions.
- A branch is pushed with compilable code that adheres to the Runtime spec.
- Final tool result returns `{ success: true, branchName, previewUrl? }` and the UI renders links.

---

## 15) Extraction Map (from `coding-agent-template/` → Formcraft)

Use for reference; re‑implement minimally inside Formcraft.

- Agents
  - `lib/sandbox/agents/claude.ts` → `app/lib/codegen/agents/claude.ts`
  - `lib/sandbox/agents/codex.ts` → `app/lib/codegen/agents/codex.ts`
- Sandbox/Git helpers
  - `lib/sandbox/creation.ts`, `lib/sandbox/commands.ts` → `app/lib/codegen/sandbox.ts`
  - `lib/sandbox/git.ts` → `app/lib/codegen/git.ts`
  - `lib/sandbox/package-manager.ts` → `detectPackageManager()` in `sandbox.ts`
- Logging
  - `lib/utils/logging.ts` → `app/lib/codegen/logging.ts` (redaction only)

Notes

- We skip Drizzle task tables and the tasks API in v1; the chat stream is the only consumer.
- We will not expose secrets in any event payload; all redactions must happen before streaming.

---

## 16) Open Questions

- Default UI mode (Typeform vs Classic) when the user doesn’t specify.
- Where to store per‑form repo config (repoUrl/baseBranch) — workspace settings table vs per‑form metadata.
- KeepAlive default policy and when to auto‑start the dev server.

---

## 23) Implementation Extraction From coding-agent-template (what to copy and modify)

Goal: copy proven components from `coding-agent-template/` to minimize net new code. This lists exact files to lift, how to adapt them, and where they land under Formcraft.

Copy (as close to as‑is as possible)

- Sandbox command wrapper
  - From: `lib/sandbox/commands.ts`
  - To: `apps/formcraft/app/lib/codegen/sandbox/commands.ts`
  - Why: stable helper around `Sandbox.runCommand` that normalizes stdout/stderr and returns `{ success, exitCode, output, error }`.

- Sandbox registry (keepAlive)
  - From: `lib/sandbox/sandbox-registry.ts`
  - To: `apps/formcraft/app/lib/codegen/sandbox/registry.ts`
  - Why: in‑memory map that tracks the Sandbox instance by taskId for kill/reuse.

- Redaction helpers
  - From: `lib/utils/logging.ts` (use `redactSensitiveInfo`, `create*Log` if needed)
  - To: `apps/formcraft/app/lib/codegen/logging.ts`
  - Change: drop DB `LogEntry` types; emit redacted strings to stream.

- Agents (Claude, Codex)
  - From: `lib/sandbox/agents/claude.ts`, `lib/sandbox/agents/codex.ts`
  - To: `apps/formcraft/app/lib/codegen/agents/{claude,codex}.ts`
  - Change: replace `TaskLogger` with `StreamLogger` that writes SSE events (`status`, `command`, `log`).

Copy (with focused edits)

- Sandbox creation + git bootstrap
  - From: `lib/sandbox/creation.ts`
  - To: `apps/formcraft/app/lib/codegen/sandbox/creation.ts`
  - Edits:
    - Ensure Bun inside sandbox if missing; then prefer `bun install` for Bun + Vite template, fallback to npm.
    - Use predetermined branch `form-<formId>`: if exists on remote, fetch/checkout; else create.
    - Keep `.gitignore` augmentation; retain `sandbox.domain()` only if we later enable dynamic preview.

- Package manager detection
  - From: `lib/sandbox/package-manager.ts`
  - To: `apps/formcraft/app/lib/codegen/sandbox/package-manager.ts`
  - Edits: add Bun detection (`bun.lockb` or `which bun`) and install path; else pnpm → yarn → npm.

- Git push + shutdown helpers
  - From: `lib/sandbox/git.ts`
  - To: `apps/formcraft/app/lib/codegen/sandbox/git.ts`
  - Edits: none functionally; keep permissive push handling (`pushFailed` boolean).

- Env validation + repo URL auth
  - From: `lib/sandbox/config.ts`
  - To: `apps/formcraft/app/lib/codegen/sandbox/config.ts`
  - Edits: require GitHub token; enforce Vercel sandbox env; prefer `http.extraHeader` over credentials in URL.

Reuse patterns (not full files)

- Branch/commit generators
  - From: `lib/utils/{branch-name,commit-message,title}-*.ts`
  - To: `apps/formcraft/app/lib/codegen/generation/*`
  - Edits: AI optional (fallbacks if AI Gateway key absent).

- Task logger → Stream logger
  - From: `lib/utils/task-logger.ts`
  - Create: `apps/formcraft/app/lib/codegen/stream-logger.ts`
  - Change: same API (`info`, `command`, `error`, `success`, `updateProgress`, `updateStatus`) but write to SSE instead of DB.

API orchestration (inspired by tasks route)

- Reference: `app/api/tasks/route.ts` → morph into `apps/formcraft/app/api/codegen/run/route.ts`:
  - Validate, create `taskId` (nanoid), open stream.
  - Init `StreamLogger(taskId, writer)`.
  - `createSandbox({... preDeterminedBranchName: 'form-<formId>' ...})`.
  - Run agent (Claude default) with `instruction`.
  - Generate or fallback commit message; `pushChangesToBranch`.
  - `bun run build` + Cloudflare Pages Direct Upload; save and emit `preview_url`.
  - Emit `complete` and close stream.

Do NOT copy

- Drizzle schemas/DB, NextAuth integration, or template UI pages.

Path Summary

- `lib/sandbox/commands.ts` → `app/lib/codegen/sandbox/commands.ts`
- `lib/sandbox/sandbox-registry.ts` → `app/lib/codegen/sandbox/registry.ts`
- `lib/sandbox/creation.ts` → `app/lib/codegen/sandbox/creation.ts`
- `lib/sandbox/package-manager.ts` → `app/lib/codegen/sandbox/package-manager.ts`
- `lib/sandbox/git.ts` → `app/lib/codegen/sandbox/git.ts`
- `lib/sandbox/config.ts` → `app/lib/codegen/sandbox/config.ts`
- `lib/sandbox/agents/{claude,codex}.ts` → `app/lib/codegen/agents/{claude,codex}.ts`
- `lib/utils/logging.ts` → `app/lib/codegen/logging.ts`
- `lib/utils/{branch-name,commit-message,title}-*.ts` → `app/lib/codegen/generation/*`

Edge adaptations

- Bun bootstrap command inside sandbox prior to `bun install`.
- Use `git -c http.extraHeader="Authorization: Bearer $TOKEN"` for Github auth; never embed tokens in URLs or logs.
- If we later support dynamic preview, map the sandbox domain from `sandbox.domain(port)` into an internal proxy.

---

## 24) Minimal Interfaces for Copy/Paste Compatibility

- `StreamLogger` methods: `info`, `command`, `error`, `success`, `updateProgress`, `updateStatus`.
- `SandboxResult`: `{ success, sandbox?, domain?, branchName?, error?, cancelled? }`.
- `AgentExecutionResult`: `{ success, agentResponse?, changesDetected?, sessionId?, error? }`.

Keeping these shapes lets us bring over the agent and creation code with trivial edits.

---

## 25) Dev Checklist (copy → compile → run)

- Copy files per Path Summary into `apps/formcraft/app/lib/codegen/…`.
- Implement `StreamLogger` and wire `redactSensitiveInfo`.
- Implement `/api/codegen/run` orchestration.
- Add Cloudflare Direct Upload util: `deployDistToCloudflare({ accountId, project, token, branch, distPath })` → `{ url }`.
- Add `generateCode` tool + system prompt; hide legacy builder behind flag.
- Validate end‑to‑end: branch push, build, preview URL, `/f/<shortId>` redirect after publish.

## 20) UI Consolidation (replace tab, remove duplicate preview)

- Navigation: hide the standalone Preview tab behind a feature flag and make the Form tab render the embedded preview.
- `TabContentManager`: route `activeMainTab === 'form'` to the preview component; retain Responses/Share/Settings as-is.
- Streaming: while `generateCode` runs, surface events (status/command/log) in a side pane and refresh the embedded frame when `preview_url` is ready.

---

## 21) Deploy Strategy (Cloudflare Pages Direct Upload)

Deploy signals

- On codegen complete with a valid build, run a deploy that returns a preview URL for the dashboard.

Required env

- `CF_API_TOKEN` (Pages deployments write)
- `CF_ACCOUNT_ID`
- `CF_PAGES_PROJECT`

Direct upload outline

1. Build: `bun run build` → `dist/`.
2. Create zip or stream `dist/`.
3. POST Direct Upload with `branch=form-<formId>`.
4. Parse response `url` and save as `preview_url`.

Production publish

- When user clicks Publish:
  - Rebuild (or reuse last artifact) and perform Direct Upload targeting production per Pages API (alias or environment setting).
  - Save resulting `live_url` on the form; set `published_at`.

Fallback

- If direct upload fails, keep preview URL if available and surface a retry CTA.

---

## 22) Serving Production Forms

Canonical share URL

- `https://formlink.ai/f/<shortId>` (stable).

Redirect rule

- Next.js route `/f/[shortId]`:
  - Lookup form by `shortId`.
  - If `live_url` exists → `302 Location: live_url`.
  - Else if `preview_url` exists → `302 Location: preview_url` (with a Preview badge).
  - Else → 404 or “not published yet”.

SEO

- `noindex` for preview redirects; remove on publish.

Data model additions

- `forms` table: `branch_name`, `preview_url`, `live_url`, `last_deployed_at`, `published_at`.

Rollback

- Optional small history table of deployments to allow “revert to last good”.

---

## 17) GitHub Repo, Auth, and Branching (Single Template Repo; Bun + Vite)

Assumptions

- We do not ask users for a repo. A single private template repo (Bun + Vite) is used for all generations.
- You provide a GitHub token with repo read/write on that template repo only.
- All execution happens inside Vercel Sandbox.
- Required tokens: `AI_GATEWAY_API_KEY` (or `OPENAI_API_KEY`) for Codex CLI, `ANTHROPIC_API_KEY` for Claude CLI, and Vercel Sandbox tokens.

Env

- `CODEGEN_GITHUB_TOKEN`: GitHub PAT or App installation token with repo R/W.
- `CODEGEN_GITHUB_REPO`: `owner/repo` or full HTTPS clone URL.
- `CODEGEN_GIT_AUTHOR_NAME` (default: `Formlink Codegen Bot`).
- `CODEGEN_GIT_AUTHOR_EMAIL` (default: `bot@formlink.ai`).

Clone & Checkout Strategy

- Sandbox working directory per request (Vercel-managed path).
- Branch name: `form-<formId>` (sanitize to `[a-z0-9/_-]`).
- First time for a given `<formId>`:
  1. `git clone` main: `git -c http.extraHeader="Authorization: Bearer $CODEGEN_GITHUB_TOKEN" clone https://github.com/${CODEGEN_GITHUB_REPO}.git .`
  2. `git checkout -B form-<formId> origin/main` (create branch from main).
  3. `bun install` (one time per fresh workspace).
- Subsequent runs for the same `<formId>`:
  1. If reusing a running sandbox (`keepAlive`), skip reinstall and fetch/checkout `form-<formId>`.
  2. If a new sandbox is created, repeat first‑time steps (install may be required again).

Notes

- Install Bun inside the sandbox if not present (e.g., `curl -fsSL https://bun.sh/install | bash` and export PATH) before `bun install`.
- Always pass the token via `http.extraHeader` not via URL to avoid leaking credentials in logs.
- Configure git author in the repo: `git config user.name`, `git config user.email`.

Commit + Push

- After the agent applies changes and the build/typecheck passes:
  - `git add -A && git commit -m "feat(formlink): generate <formTitle> runtime UI"`.
  - `git push -u origin form-<formId>`.
  - Emit `push` event with `{ branchName: "form-<formId>", success: true }`.

---

## 18) Runtime Integration on Bun + Vite (non‑Next)

While the Runtime spec references Next.js App Router, the runtime and UI packages are framework‑agnostic for React. For a Bun+Vite template:

- CSS: import `@formlink/ui/globals.css` in `src/main.tsx` or the root layout file loaded once.
- Tailwind: include runtime/ui paths or safelist utilities in `tailwind.config.{js,ts}` `content` globs.
- Provider: implement `AppProviders` using `ShadCnProvider` mapping to `@formlink/ui` primitives, then wrap your app in it.
- Files to generate (Vite):
  - `src/forms/<formId>/runtime.ts` — `createRuntime` with chosen transport.
  - `src/forms/<formId>/FormView.tsx` — Typeform or Classic implementation from the spec.
  - `src/providers/AppProviders.tsx` — provider mapping.
  - Router integration: if using React Router/TanStack Router, inject a route like `/forms/:formId` that renders `FormView`.
- Build: `bunx vite build` or `bun run build`.
- Dev/Preview: `bunx vite preview --port <PORT>` (used only if `keepAlive` dynamic preview is enabled).

Agent instruction must be tailored for Vite file layout when the template repo advertises Vite (detected via `package.json` and/or `vite.config.*`).

---

## 19) Preview & Publish UX (formlink.ai subdomains + Cloudflare Pages)

Goal: show a reliable preview during iteration and a durable production URL after publish, all visible inside the Formcraft UI.

### A) Preview Flow (Static via Cloudflare Pages)

Flow

1. After pushing the branch, run a production build in the workspace: `bun run build` (Vite → `dist/`).
2. Upload `dist/` to Cloudflare Pages via Direct Upload (Preview deployment) using `CF_API_TOKEN`, `CF_ACCOUNT_ID`, `CF_PAGES_PROJECT`.
3. Cloudflare returns a `*.pages.dev` URL. Save it as `preview_url` on the form.
4. Optionally map a friendly host `https://<formId>.preview.formlink.ai/` to this URL via an internal redirect/proxy; emit a `preview` event with the chosen URL.

Pros

- No long‑running processes; easy to share. Uses the same artifact as production.

### B) Dynamic Local Preview (optional)

Flow

1. Start `bunx vite preview` as a detached process.
2. Proxy `https://<formId>.preview.formlink.ai/*` to that port.

Default is A. Keep B behind a flag for debugging only.

URL format

- Prefer `https://<formId>.preview.formlink.ai/` (proxy) or show Cloudflare `*.pages.dev` directly.

Security

- Optional signed links/Basic Auth for previews. Cache headers; invalidate on new deploys.

UI integration (Dashboard)

- Replace the current “Form” tab content with the codegen preview and remove the separate “Preview” tab behind a rollout flag (`CODEGEN_PREVIEW_UI=true`).
- Embedded preview frame behavior:
  - If `live_url` exists → show production URL.
  - Else if `preview_url` exists → show preview URL.
  - Else → show build/stream state until a URL is available.
- Keep device controls and a Publish button nearby.
- The “Share” tab exposes `https://formlink.ai/f/<shortId>` which redirects (see §22).
