This document outlines two viable architectures to integrate a coding agent (Vercel Sandbox + CLI agents) into test/formlink/apps/formcraft:

- Option A: Task-based (durable jobs with resumability/history)
- Option B: One-off streaming (single-call, no durable job)

Pick based on whether you need resumability/audit vs minimum moving parts.

Shared Goals

- Trigger code generation from chat (AI SDK v5) using your form schema.
- Run CLI agents inside a sandbox against a real Git working tree.
- Stream progress/logs back into chat as the run proceeds.
- Persist code changes to Git (repo or branch per project).
- Preview/deploy out of scope here; you’ll deploy from Git to Cloudflare Pages separately.

Option A — Task-Based Model

- Summary
  - You create a “task” and store it in a DB (e.g., Neon Postgres).
  - Task executes async and can be resumed/reconnected; you can list history and view logs later.
  - Useful for resumability, audit, and admin UX.
- API
  - POST /codegen/tasks → { taskId, branchName, sandboxDomain? }
  - GET /codegen/tasks/:taskId/stream (SSE) → status/log/command/agent/preview/commit/push/complete
  - GET /codegen/tasks/:taskId/state → last known status, health, summary
  - Optional webhooks: POST /codegen/webhooks/completed to notify downstream systems
- Flow
  - Chat (tool) calls POST /codegen/tasks with repo info + agent + instruction.
  - Service:
    - Creates a Vercel Sandbox from Git
    - Installs deps; checks out/creates branch
    - Runs agent; streams logs to SSE
    - Commits & pushes changes
  - Chat connects to SSE and renders line-by-line logs until complete.
  - Tasks persist in DB for history/resume.
- Pros
  - Resumable/reconnectable
  - Task history and audit trails
  - Easy to plug webhooks/fanout
  - Fits admin screens (list/filter tasks)
- Cons
  - More moving parts (DB + status management)
  - Slightly more complexity to operate
  - Slightly more latency to spin up the task infrastructure
- When to choose
  - You want resumability, history, admin UX, or multi-consumer notifications.
  - Longer-running jobs with retries or SLA tracking.

Option B — One-Off Streaming Model

- Summary
  - No persistent “task” objects; one streaming request per run.
  - The chat tool opens a single request and receives streaming logs until done.
  - Simpler and ideal for chat-driven workflows without history/resume requirements.
- API
  - POST /codegen/run (SSE response)
    - Body: { projectId, repoUrl, baseBranch, branchName?, agent, instruction, keepAlive, timeoutMinutes }
    - Response: text/event-stream streaming events until complete
  - No task DB row; minimal locking per projectId.
- Flow
  - Chat (tool) calls POST /codegen/run, opens SSE directly.
  - Service:
    - Ensures sandbox → installs deps → branch checkout
    - Runs agent, streams logs
    - Commit & push, stream completion event
    - Keep Alive optional for manual checks
  - Follow-up edits: just call /codegen/run again with same projectId/branchName.
- Pros
  - Minimal complexity
  - Perfect fit for chat tool streaming
  - No task lifecycle to manage
- Cons
  - No resumability if the connection drops
  - No built-in history/audit (unless derived from chat logs or Git)
  - Harder to multi-fanout events
- When to choose
  - You want simple “fire-and-stream” behavior with chat as the sole consumer.
  - You don’t need a “jobs” list or later reconnection.

Common Elements (Applicable to Both Options)

- Git strategy
  - Canonical source: Git (no DO/R2 needed for code).
  - Base branch: your template (e.g., main).
  - Each run works on a branch per project or per session (e.g., feature/formcraft-<projectId>-<shortId>).
  - Commit/push on success; optional PR creation.
- Instruction builder (schema → instruction)
  - Convert form schema to instruction text:
    - Tech + conventions (Next.js 15, Tailwind, TypeScript)
    - File targets (routes/components), structure expectations
    - Validation + acceptance checks (no TS errors; lint passes)
    - Preview hints if needed
- Vercel Sandbox lifecycle
  - Create sandbox from Git source (private repos supported with token/app).
  - Install deps (pnpm/yarn/npm detection; pip for Python).
  - Branch checkout/creation and domain allocation for dev server (Keep Alive ON).
  - TTL enforced per run (e.g., 60 min).
- Streaming events (SSE)
  - status: high-level steps (Sandbox created, Installing deps)
  - command: executed commands, exit codes
  - log: tool logs (info/warn/error)
  - agent: agent steps (e.g., “Claude Code analyzing files”)
  - preview: sandbox domain (if Keep Alive ON and dev server present)
  - commit: summary of files changed
  - push: branch push result
  - complete: final status + { branchName, sandboxDomain? }
  - error: clear error messages with hints
- Security
  - All endpoints require service admin token (JWT/HMAC) in Authorization.
  - Git auth via GitHub App or repo-scoped tokens.
  - BYOK vs service-level provider keys; prefer backend-held keys for security.
- Integration in apps/formcraft
  - Add AI SDK v5 tool “generate_code” in chat/route.ts:
    - Build instruction from schema
    - Call the selected API (Option A: POST tasks + GET stream; Option B: POST run)
    - Pipe SSE events into the chat response stream
    - End with a final tool result containing branchName and previewUrl (if available)
  - Show links to branch + preview in the chat UI.

Decision Guide

- Choose Option A (Task-based) if:
  - You want a job list/history, retries, resuming broken streams, multi-subscriber notifications, or richer admin UX.
- Choose Option B (One-off) if:
  - You want the simplest path to “schema → code branch” with streaming logs in chat and no extra job state.

Migration Path

- Start with One-off (Option B) to ship fast.
- If/when you need resume/history/webhooks, wrap the same internals in a Task layer (Option A) without changing the core sandbox/agent logic.

Minimal Backlog (Both Options)

- Codegen service (based on coding-agent-template)
  - Implement endpoints (Option A or B)
  - Per-project locking (in-memory or Redis)
  - Stream logs via SSE from sandbox creation, agent execution, and git ops
- Formcraft
  - Add “generate_code” tool
  - Instruction builder
  - SSE consumer wiring
- Git/Secrets
  - Template repo URL + auth
  - Push permissions verified on private repos

Out-of-Scope Deploy

- A separate pipeline will build from the branch and push to Cloudflare Pages (either CI on branch/tag or a service endpoint that fetches, builds, and uses Pages Direct Upload).
