# @formlink/runtime — Consolidated Plan & Decisions (v1)

Last updated: 2025-10-20
Owners: Core Platform (runtime/ui/devtools)
Status: Working spec to gavel and implement

Purpose

- Organize the current runtime vision into one actionable, AI-friendly document.
- Identify open decisions and propose defaults (“gavel”) to unblock implementation.
- Link to detailed specs already present; avoid duplication where possible.

Scope (packages)

- `@formlink/runtime` (core, pure JS; edge-safe ESM): form state, validation, branching, navigation, persistence, uploads.
- `@formlink/runtime/ui/react`: React wrappers and Typeform/Classic scaffolding; provider-driven shadcn primitives.
- `@formlink/runtime/devtools`: Mock transport, event timeline, transport recorder, schema editor, and a persistent “Deploy on Formlink” bar.
- Related but separate: `@formlink/ui` (registry-first components) and `@formlink/chat` (chat adapter).

Reading map (authoritative docs)

- Runtime API, schema contract, wiring rules → docs/runtime/formlink-runtime-spec_v1.md
- Implementation details and current consumer audit → docs/runtime/runtime-impl-plan_v1.md
- Devtools component plan → docs/runtime/devtools_component_ideas_v1.md
- Error visibility policy → docs/runtime/error-visibility-policy_v1.md
- Examples for codegen → docs/runtime/examples/\*

—

## 1) Modes & Core Contracts

Overview

- Headless runtime holds the truth; UI renders it. No view-managed answer state.
- Modes: Typeform (one-by-one), Classic (list/page), Chat (backend-driven via slot tokens).

Core API (summary; see spec §3)

- `context`: status | currentId | visibleIds | progress | get.{q,value,visibleError}.
- `actions`: start | set | validate/validateAll | next/prev/goTo | submit | savePartial | upload | reset | blur (classic).
- `events`: answer:set, validate, cursor/visibility/progress change, submit/upload lifecycles, partial lifecycles.

Branching & visibility

- Runtime computes and caches `visibleIds` from per-question rules + optional `journeyScript` (XML). UI never computes show/hide.
- Progress derives from `visibleIds` and `currentId`.

Validation & error policy

- See docs/runtime/error-visibility-policy_v1.md. UI reads `context.get.visibleError(qid)` only.

—

## 2) Piping, Calculators, and Branching (Code‑first)

Goals

- Stop offloading branching to AI at runtime; make it deterministic in code.
- Support answer piping in titles/descriptions and calculated fields.

Proposal

- Piping tokens: `{{ qid }}` and optional formatters: `{{ qid | upper }}` `{{ qid | number: '0,0.00' }}` (extensible).
- Calculator expressions: small expression DSL (`+ - * / ( )`, `if(cond,a,b)`, `min/max/sum/avg`, ternary `cond ? a : b`). Variables reference `qid` answers.
- Engine: implement a tiny interpreter (no `eval`) with a hand-rolled parser or `jsep`-style AST; deterministic, side‑effect‑free.
- Runtime derives `derivedValues` per step and exposes `context.get.derived(qid)` if a question is computed; computed answers are read‑only.

Data model additions (runtime)

- Question metadata: `piping?: string` on title/description; `compute?: { expr: string }` on calculator questions.
- Derived map: internal `{ [qid]: any }` updated whenever dependencies change.

Acceptance

- Piping resolves live in both modes; missing values yield empty strings.
- Calculators recompute on dependency change; cycle detection throws a typed error.
- UI for computed questions renders read-only value; no input allowed.

Open edges to confirm

- Formatter surface (which built‑ins to ship in v1?).
- Numeric coercion rules for text answers used in math.

—

## 3) Devtools & Mock Transport

Goals

- Build confidence without a backend: mocked transport + visible events.
- Inline schema edits with guaranteed re-init and value migration.

Components (see devtools_component_ideas_v1.md)

- `TransportRecorder` wrapper with latency + fault injection.
- `Devtools` dock/overlay: Overview | Fill | Events | Transport | Edit.
- New: `DeployBar` (persistent) described in §4.

Instrumentation

- Add partial lifecycle events and optional transport taps. Non‑breaking.

Acceptance

- Event filters work; recorder tables show payloads; Edit Apply re-inits and migrates.

—

## 4) “Deploy on Formlink” Flow (always‑present bar)

Goals

- One click from any local demo/story/app to a cloud preview on Formlink.
- Strong guarantee: if it runs with mock transport locally, it runs when hosted.

User UX

- A floating `DeployBar` renders with Devtools. Buttons:
  - `Deploy on Formlink` (primary)
  - `Open Devtools` (secondary)

Minimum viable flow

1. Collect source of the current demo file (component + imports) in dev.
2. POST to Formlink `/api/imports/create-preview` with `{ source, meta }`.
3. Backend bundles in a microsandbox and serves a preview URL.
4. Bar swaps to `View on Formlink` and shows `Link to a Form` CTA.
5. When linked, runtime config switches to real transport.

Source collection strategies (pick 1; we can support all)

- A. Host‑provided collector (recommended default)
  - `DeployBar` accepts `collectSource: () => Promise<{ code: string; entry: string; files?: Record<string,string> }>`.
  - Generators (v0/bolt/agents) pass the current file’s full text and any co‑located files.
- B. Next.js API helper (zero codegen help)
  - Provide a `pages/api/formlink/collect-source.ts` snippet that reads from disk using a compile‑time injected path (webpack DefinePlugin) and returns the source. `DeployBar` fetches it.
  - Dev‑only; disabled in prod builds.
- C. Vite dev‑server path
  - Attempt to fetch `/${'@fs'}/absolute/path.tsx` or use module graph via `import.meta.hot` (works in Storybook/Vite only). Fallback to A.

Backend bundling (Formlink)

- Receive `{ code, files?, entry, meta }`.
- Use `microsandbox` to bundle for the browser; inject `@formlink/runtime` and `@formlink/ui` as externals or pinned versions.
- Host as a preview at `https://preview.formlink.dev/<previewId>`.
- Provide link API to attach `formId`, `submissionId`, `formVersionId` and emit a patched runtime config (or env‑inject transport).

Security & limits

- Dev‑only endpoints guarded by env flag; CORS locked to localhost origins.
- Max payload size documented; large assets rejected with a clear error.

Acceptance

- In ui‑docs stories, clicking Deploy creates a preview and opens it in a new tab within 5–10s.
- When “Link to a Form” is clicked in the preview, the app switches to the real backend and successful submit updates the dashboard submission.

Open questions (to gavel)

- Should we ship the Next.js API helper as a codemod or docs‑only snippet?
- What metadata is required in `meta` (framework, deps, tailwind) to make previews render identically?

—

## 5) Headless Chat Mode (testable w/o linking)

Goal

- Allow chat UX to run end‑to‑end for demos without a saved form or user id.

Contract

- New server flag: `testmode: true` in chat requests.
- Client sends entire `formSchema` and ephemeral `submissionId` with each message.
- Backend skips `form_id/user_id` checks, validates against `formSchema`, and emits the next slot token.
- When linked to Formlink, the server ignores client `formSchema` and uses the saved version.

Acceptance

- Chat demos work end‑to‑end when `testmode` is set and no IDs exist.
- Switching off `testmode` requires a valid form link; errors are explicit and typed.

—

## 6) Shadcn Registry Packaging (UI)

Goal

- Provide a registry‑first install path for the UI primitives used by runtime demos.

Plan

- Maintain `docs/registry/registry.json` as source of truth for ejectable components.
- Publish a small CLI (later) to pull components; for now, document `pnpm dlx shadcn@latest add -c <url>` usage.

Acceptance

- Registry covers: Field, InputGroup, Typeform scaffolding, Unified\* inputs (or adapters), and minimal provider mapping.

—

## 7) Publishing & Packaging

Rules

- ESM only, edge‑safe. Top‑level exports and `./schema` subpath (single‑install).
- Keep peerDeps minimal; document required providers in `ui/react`.

Prepublish checklist

- `pnpm -w typecheck` green.
- `pnpm -w lint` green (apps can be excluded from the publish gate — or we lint packages/\* only for release).
- `CHANGELOG` via Changesets for `@formlink/runtime` and friends.
- Single‑install check: `rg -n "@formlink/schema" packages/runtime/dist/**/*.d.ts` → no matches.

—

## 8) Decisions to Gavel (proposed defaults)

1. Piping formatters: ship `upper/lower/capitalize`, `number(format)`, `date(format)`; leave i18n later. → PROPOSE: Yes.
2. Calculator DSL: allow arithmetic + `if/ternary/min/max/sum/avg`; no functions that need external state. → PROPOSE: Yes.
3. Deploy source collection: support A (collector prop) and B (Next API helper) in v1; consider C opportunistically. → PROPOSE: Yes.
4. Preview hosting: use microsandbox for all; Cloudflare Worker and Vercel are deployment targets for “Make Live”, not for previews. → PROPOSE: Yes.
5. Devtools presence: `DeployBar` ships enabled by default in dev builds; hidden in prod. → PROPOSE: Yes.
6. Chat headless `testmode`: gated by env on server; enabled in docs/stories. → PROPOSE: Yes.
7. Lint gate for publish: limit to `packages/*` on release CI to avoid app warnings blocking package publish. → PROPOSE: Yes.

—

## 9) Implementation Backlog (Now → Next → Later)

Now (MVP)

- Runtime: `visibleIds` + navigation synced to branching rules; error visibility policy integrated.
- Runtime: `createMockTransport` w/ delays; expose in public API.
- Devtools: `TransportRecorder` + Events tab (filters) + minimal `DeployBar` with collector prop.
- Docs: Storybook examples covering Typeform, Classic, Chat; add Deploy flow demo.

Next

- Piping + Calculator engine; derived values + read-only computed fields.
- Devtools: Edit tab supporting text/single/multiple choice with validations; re-init + migration.
- Deploy: Next.js API helper snippet + Formlink preview endpoint.
- UI registry: round out Typeform scaffolding + Inline primitives in registry.

Later

- Advanced validators and cross‑field rules.
- Branching XML authoring helpers; preview of skipped questions.
- Payment input and sensitive flows.

Acceptance (MVP)

- Smoke: Typeform one-by-one; Classic list; Chat slot adapter; all wired to runtime and pass validation flows.
- Devtools: can see & filter events; record transport; deploy from a story to preview.

—

## 10) Pre‑Implementation Notes (surgical plan)

File: packages/runtime/src/devtools/DeployBar.tsx

- Purpose: persistent bar with `Deploy on Formlink` and `Open Devtools` actions.
- API/props: `{ collectSource?: () => Promise<{ code: string; entry: string; files?: Record<string,string> }>, importEndpoint?: string }`.
- State: local `isDeploying`, `previewUrl`.
- Edge cases: collector absent → show instructions; disable in production; large payload handling and error toasts.
- Verification: ui-docs story mounts bar; clicking deploy opens preview.

File: packages/runtime/src/devtools/TransportRecorder.ts

- Purpose: record submit/partial/upload calls and timings; fault injection.
- API: `createTransportRecorder(base, { defaultLatencyMs? })` returns `{ transport, getRecords, setLatency, forceNextError }`.
- State: in-memory records array; id counter; pending fault.
- Edge: passthrough when disabled; pretty-print large JSON.
- Verification: Devtools Transport tab shows records; latency slider affects timings.

File: packages/runtime/src/core/expression.ts

- Purpose: safe piping/calculator evaluator.
- API: `evaluate(expr, { values, formatters })`, `interpolate(template, values, formatters)`.
- State: none.
- Edge: cycles, division by zero, NaN coercion; return typed errors.
- Verification: unit tests for parser + evaluator; story renders computed field.

File: apps/ui-docs/stories/DeployBarDemo.stories.tsx

- Purpose: demo `DeployBar` with a simple form view; collector returns the story source.
- API/props: none (storybook only).
- State: none.
- Edge: ensure demo hides the bar in prod builds.
- Verification: manual run in Storybook; click deploy.

—

## 11) Hosting the AI‑preferred Doc

Goal

- Provide a single URL that LLMs can read to generate working runtime code.

Plan

- Host `docs/runtime/formlink-runtime-spec_v1.md` and this consolidated doc behind a public docs site (or GitHub raw URLs) and keep them versioned.
- Add a short `AI_README_v1.md` with only the must‑follow wiring rules and imports (link out to full docs). Keep it stable and compact.

—

## 12) TODOs (searchable)

- TODO(runtime): implement `visibleIds` computation and expose in context.
- TODO(runtime): export `createMockTransport` and wire delays.
- TODO(devtools): build `TransportRecorder` and Events/Transport tabs.
- TODO(devtools): add `DeployBar` with collector prop; story demo.
- TODO(runtime): add piping/calculator evaluator; read-only computed fields.
- TODO(docs): publish Next.js API helper snippet for source collection.
- TODO(ui-registry): expand registry.json to include Typeform scaffolding and Inline primitives.
