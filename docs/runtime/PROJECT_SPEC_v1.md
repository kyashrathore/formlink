# Formlink — Headless Runtime + UI Contracts (v1)

Last updated: 2025-10-17

Status: API draft (v1 surfaces frozen for packaging)

Owners: Core Platform

## 1) Purpose

Turn Formlink into a “Lovable/v0/bolt for forms” runtime: users can ask for any form and get working code immediately. We keep the “brain” tiny and stable, dictate correctness (validation, branching, navigation, persistence, uploads), and let UIs be generated for any layout or framework.

Key principles:

- Single source of truth for rules and persistence.
- UI/layout is unconstrained; LLMs get small, deterministic glue.
- Chat uses ai‑sdk; we provide one wrapper component to mount inputs on slot tokens.

## 2) Distribution Strategy (v1)

UI: Registry‑First

- Prefer a shadcn‑style registry for `@formlink/ui` components so teams/LLMs can inline source into their apps and fully customize markup/ARIA/motion. We also keep the option to publish a thin package later for convenience.

Packages (kept small and stable)

- `@formlink/runtime` — headless core for non‑chat flows (ESM, edge‑safe)
  - Query: read context (answers/visibility/progress/cursor)
  - Command: `actions` (setAnswer/validate/next/prev/goTo/submit/uploadFile)
  - Subscribe: `events` (answer:set, validate, cursor:change, visibility:change, progress:change, submit:success/error, upload:success/error)

- `@formlink/ui` — provided via a shadcn‑style registry. See the consolidated runtime doc at `docs/runtime/formlink-runtime-spec_v1.md` (§7) for component list and rules.

- `@formlink/chat` — chat glue (React)
  - `ResponseWrapper`: drop‑in replacement for ai‑sdk `<Response>` that renders assistant text and mounts the correct input for a backend slot token `::PresentQuestionInputComponent qId="…"::`.
  - Calls back to host with `(qId, value, displayText)` to send via ai‑sdk.

## 3) Runtime Core (non‑chat)

### 3.1 Read (Query)

`import { context } from "@formlink/runtime"`

- `status`: The lifecycle state: `'idle' | 'filling' | 'submitting' | 'completed' | 'error'`.
- `currentId`: The ID of the current question.
- `visibleIds`: An array of all currently visible question IDs.
- `progress`: An object `{ index, total, percent }`.
- `get.q(qId)`: Returns the question object.
- `get.value(qId)`: Returns the question's current answer.
- `get.error(qId)`: Returns the first validation error for a question.

### 3.2 Command (Mutate)

`import { actions } from "@formlink/runtime"`

- `start()`: Begins the form, moving status from `'idle'` to `'filling'`.
- `set(qId, value)`: Sets an answer for a question.
- `validate(qId)`, `validateAll()`: Trigger validation.
- `next()`, `prev()`, `goTo(qId)`: Handle navigation.
- `submit()`: Submits the form, managing `submitting` and `completed` states.
- `upload(qId, file)`: Uploads a file.
- `reset()`: Resets the form and returns status to `'idle'`.

### 3.3 Subscribe

`import { events } from "@formlink/runtime"`

- `on/off/once` for: `status:change`, `answer:set`, `validate`, `cursor:change`, `visibility:change`, `progress:change`, `submit:success`, `submit:error`, `upload:success`, `upload:error`.

### 3.4 Invariants

- Validation: runtime is authoritative (per‑type, pattern, min/max, required, cross‑field).
- Branching: visibility from rules/journeyScript; UI never computes.
- Navigation: blocked on invalid states.
- Persistence: partial save policy + idempotent submit.
- Uploads: canonical `{ url, name, size }` objects stored as answers.
- Errors: typed codes; no PII.

### 3.5 Form Ownership & Linking — See Consolidated Doc

- The runtime supports multiple models for establishing ownership, including a secure, cookie-based flow for anonymous users and automatic linking for authenticated users via injected secrets (environment variables or MCP).

See `docs/runtime/formlink-runtime-spec_v1.md` (§4). Summary: stable `previewId` → backend draft; heartbeat via PUT; link bubble optional; GET polls `linked`.

### 3.6 Preview Retention & Cleanup — See Consolidated Doc

See `docs/runtime/formlink-runtime-spec_v1.md` (§4). Summary: retain if linked or active; archive/purge per env‑driven TTLs; storage GC aligned.

## 4) Chat Mode (ai‑sdk + ResponseWrapper)

### 4.1 Backend contract (reference)

- Assistant emits exactly one slot per turn to mount the next input:
  `::PresentQuestionInputComponent qId="<question-id>"::`
- No text after the slot line; text before is allowed.

### 4.2 UI Agent contract (what codegen uses)

- Use ai‑sdk for transport/shell.
- Render assistant messages with `@formlink/chat` `ResponseWrapper` (not ai‑sdk `<Response>`).
- Do not parse slot tokens or render per‑type inputs; `ResponseWrapper` handles both.
- Provide callbacks:
  - `onSubmitSelection(qId, value, displayText)` → call `sendMessage(..., { body: { submissionBehavior: "auto", currentQuestionId: qId, justSavedAnswer: { questionId: qId, value }, formSchema, responses, submissionId, isTestSubmission }})`.
  - `onUploadFile(qId, file)` → return `{ url, name, size }` (or upload server‑side).

### 4.3 What the runtime holds for chat

- Nothing on the client. The server route owns validation, pre‑save, next question id, and slot emission. UI just renders `ResponseWrapper` and sends selections.

## 5) Question Types → Components (@formlink/ui)

- text (text/email/url/tel/number/textarea) → `BaseTextInput`
- singleChoice → `UnifiedDropdownSelect` (or `UnifiedMultiSelect` with `maxSelections=1`)
- multipleChoice → `UnifiedMultiSelect` or `UnifiedDropdownMultiSelect`
- date → `UnifiedDatePicker`
- fileUpload → `UnifiedFileUpload`
- signature → `UnifiedSignature` (dataURL string; optionally upload to file)
- phone → `UnifiedPhoneInput` (E.164 preferred)
- country → `UnifiedCountrySelect` (ISO‑2)
- rating → `UnifiedRating`
- linearScale → `UnifiedLinearScale`
- likertScale → `UnifiedLikert`
- address → `UnifiedAddressInput`
- ranking → `UnifiedRanking`

## 6) LLM Recipes

- Typeform one‑by‑one: for each qId → `value = context.getAnswer(qId)`, `onChange = v => actions.setAnswer(qId, v)`, `onSubmit = () => { if (actions.validate(qId).isValid) actions.next() }`.
- Classic page: render all `visibleIds`, TanStack optional; delegate validation to runtime.
- Branching “jump” interstitial: UI checks `context.getAnswer('qX')`; render a picker from `context.visibleIds`; `actions.goTo(targetQId)`.
- Chat centered: ai‑sdk shell + `ResponseWrapper` for assistant turns; never parse slots manually.

## 7) Packaging & Publishing

- ESM only; edge‑safe (Workers).
- `@formlink/runtime` and `@formlink/chat` contain backend‑coupled logic and must remain packaged (no registry).
- `@formlink/ui` is distributed as a shadcn‑style registry (registry‑first). A package may be offered later for convenience; source of truth is the registry.
- Exports: top‑level only, no deep paths; peer deps kept minimal.

## 8) Acceptance Gates

- `pnpm -w typecheck`, `pnpm -w lint` green.
- Example app smokes:
  - Chat: ai‑sdk + `ResponseWrapper` mounts inputs from slot; selection streams next slot.
  - Typeform: one‑by‑one with Unified\*; validation blocks incorrectly answered steps; submit succeeds.
  - Classic: TanStack + runtime validators; submit persists.

## 9) Security & Privacy

- No PII in logs/events by default.
- Uploads via pre‑signed URLs/secure endpoints.
- Payment (future) tokenized only; runtime/UI never handle raw PAN.

## 10) Roadmap (post‑v1)

- Optional React adapter subpath for runtime selectors.
- Payment input (flagged).
- i18n labels; a11y checklists per input.
- Cloudflare Worker demo (ai‑sdk shell + our backend).
