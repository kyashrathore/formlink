Braintrust Tracing

- Initialization: `instrumentation.ts` calls `initLogger` with `BRAINTRUST_API_KEY` and optional `BRAINTRUST_PROJECT_NAME`. Next.js loads this at server startup.
- Wrapper: `app/lib/ai/tracing.ts` wraps Vercel AI SDK top-level functions using `wrapAISDK(ai)` and re-exports `generateObject`, `generateText`, `streamText`, and `streamObject`.
- Usage: Import wrapped functions from `@/app/lib/ai/tracing` instead of `ai`.
  - Example: `import { generateObject } from '@/app/lib/ai/tracing'`.
- Scope: All server calls in this app that used `generateObject`/`generateText` now use the wrapped versions. `streamText` in chat handler is also wrapped.
- Environment: Set `BRAINTRUST_API_KEY` (required) and optionally `BRAINTRUST_PROJECT_NAME`.

Notes

- Existing experimental telemetry blocks (Vercel AI `experimental_telemetry`) were left intact where present. Braintrust spans are produced via the wrapper regardless.
- No provider/model behavior changed; `getModel` remains the single source of model resolution.

Prompt Guards

- Background: The shared prompts library may include `md/_guards.md` in local development. Including it in every prompt (especially for internal tool calls) is noisy.
- Change: We now explicitly request guardrails only for user-facing chat endpoints by passing `include_guards: true` into `loadPrompt(...)`:
  - formcraft: `app/api/chat/handlers/form-creation.ts: loadPrompt('chat/form-creation-system.md', { include_guards: true, ... })`
  - formfiller: `formfiller/app/api/ai/chat-assist/route.ts: loadPrompt('filler/form-assistant-system.md', { include_guards: true, ... })`
- Internal calls (all other `loadPrompt` usages) do not pass this flag and should render without guardrails if the template honors the `include_guards` variable.
- Follow-up: Ensure the prompts templates conditionally include guards via `{{#include_guards}}…{{/include_guards}}` (or equivalent) and do not auto-inject guards globally.

- Single-Pass Generation (default)

- The single-pass form creation mode is enabled by default.
- Disable via either:
  - Request body: `options.singlePass: false`
  - Query string: `/api/chat?singlePass=false`
- Behavior:
  - Uses `packages/prompts/md/form/create-form.md` with `FormSchema` to generate the full form in one AI call.
  - Synthesizes standard `data-agent_event` stream events so the UI remains compatible:
    - `agent_initialized`, `state_snapshot` (metadata), `agent_warning` (question count), `question_schema_generated` per question, `state_snapshot` (final), `agent_finalized`.
  - Finalizes to DB via `finalizeForm` (version insert + form update) and writes a brief assistant summary message.
  - The legacy workflow/tool-based streaming path is used only when single-pass is disabled.

## Decision Log — 2025-02-15

- Adopt @tanstack/react-form `0.42.x` + zod adapter for the new `@formlink/runtime` package to keep the runtime edge-safe and hook-free at instantiation.
- Build runtime context/actions/events as a singleton store (FormApi + derived selectors) so Storybook examples can `createRuntime` once and reuse across renders.
- Populate `apps/ui-docs` with a Stripe SDE2 job-app story that consumes the runtime API instead of ad-hoc state to validate end-to-end flow.

- Added a Runtime Devtools panel in `apps/ui-docs/stories/StripeSDE2Application.stories.tsx` to visualize:
  - answered/unanswered questions, eligibleIds, cursor and progress
  - live event feed (status, answer:set, visibility, progress, validate pass/fail, submit, upload, partial save)
  - quick actions (save partial, goTo question)
    This serves as a prototype for an exportable Devtools package to improve UX when testing forms.

## Decision Log — 2025-10-18

- Bug: Submit hung on "submitting" for some flows due to attempting submission while hidden validation errors existed (optional fields with invalid values). The UI showed the submitting spinner briefly without clear feedback.
- Change: Implemented fail-first submit in runtime to validate all fields before entering `submitting` state, reveal invalid fields, and bail early when invalid.
  - File: `packages/runtime/src/core/state.ts`: actions.submit()
  - Behavior: `validate('submit')` + Zod `safeParse` → if invalid, mark all invalid qids as revealed, set status back to `filling`, sync; do not call transport. If valid, set `submitting`, await `handleSubmit()` which flips status to `completed` on success.
- Rationale: Avoid transient stuck UX and make errors explicit, keeping validation logic centralized in the runtime (not stories). Aligns with docs plan for submit flow and "fail loudly" rule.
- Verification: `pnpm -w typecheck` passes. Lint has pre-existing warnings in unrelated packages; not changed. Story uses the mock transport; submit now transitions to `completed` reliably when valid, and to `filling` with surfaced errors when invalid.

- Bug: Pressing Enter in TypeForm text inputs (e.g., email) advanced two steps (qN → qN+2). Root cause was double invocation of `onSubmit` from both the base primitive and the TypeForm wrapper.
- Change: Disable primitive-level auto-submit-on-Enter for TypeFormTextInput and handle Enter once in the wrapper.
  - File: `packages/ui/src/form/modes/typeform/TypeFormTextInput.tsx`
  - Before: `useBaseTextInput({ autoSubmitOnChange: true, ... })` and wrapper’s own `onKeyDown` also calling `onSubmit()`.
  - After: `autoSubmitOnChange: false`; wrapper processes Enter and calls `onSubmit()` once (respects `isInvalid`).
- Guard: Also fixed an early-return path in runtime `actions.next()` that could leave `isNavigating` stuck at `true` when `currentId` was null.
  - File: `packages/runtime/src/core/state.ts` (set `isNavigating = false` on the `!currentId` early return).
- Verification: Typecheck green. In Storybook, hitting Enter advances exactly one step. Clicking Continue works unchanged.

- Instrumentation: Added detailed submit lifecycle events to the runtime for debugging stuck “submitting” reports.
  - Types: `packages/runtime/src/types.ts` added events `submit:requested`, `submit:transport:start`, `submit:transport:end`.
  - Emission points: `actions.submit()` emits requested/start/end; `onSubmit` still emits `submit:success` and flips status.
  - Story wiring: `apps/ui-docs/stories/StripeSDE2Application.stories.tsx` subscribes to these and logs them in the local devlog.
  - Fallback: After `formApi.handleSubmit()` resolves, if runtime status did not flip to `completed`, runtime sets it to `completed` to avoid a stuck state.

- UX fix: Dropdown state bleed between consecutive questions (search text/popover open carried from qN → qN+1).
  - Cause: React preserved internal state of the dropdown component because it reused the same component position without a key. The Combobox stores `open` and `inputValue` in component state.
  - Change: Key the rendered control by `activeQuestionId` so each question remounts its input component and resets transient UI state (popover open, search query), while values remain controlled by the runtime.
  - File: `apps/ui-docs/stories/StripeSDE2Application.stories.tsx` — added `key={activeQuestionId}` on `Textarea`, `TypeFormTextInput`, and `UnifiedDropdownSelect`.

- Accessibility: Auto-focus the select trigger in Typeform mode so a newly shown select question immediately receives focus (parity with text inputs).
  - File: `packages/ui/src/form/modes/unified/UnifiedDropdownSelect.tsx` — pass `autoFocus` to `ComboboxTrigger` when `mode === 'typeform'`.

## Pre-Implementation Notes — 2025-02-15

- `packages/runtime/package.json`: Purpose — workspace manifest for new runtime package. API — declares module entry (`src/index.ts`) and dependency versions (`@tanstack/react-form`, `@tanstack/zod-form-adapter`, `zod`). State — none (config). Edge cases — ensure ESM-only + private to avoid accidental publish. Verification — typecheck & lint via workspace after install.
- `packages/runtime/tsconfig.json`: Purpose — TS config for runtime source. API — extends shared base, enforces module resolution `NodeNext`. State — none. Edge cases — include `src` only to keep declarations tight. Verification — `pnpm -w typecheck`.
- `packages/runtime/src/types.ts`: Purpose — shared runtime typings (config, context, actions, events). API — exported interfaces consumed by Storybook + future packages. State — derived from `Form` schema & runtime store. Edge cases — align with docs spec (`status`, `eligibleIds`, etc.). Verification — compile + unit usage in story.
- `packages/runtime/src/core/schema.ts`: Purpose — translate `Form` questions into Zod validators + default values. API — `buildRuntimeSchema`, `createDefaultValues`. State — pure functions. Edge cases — handle optional questions, choice arrays, number coercion, TODO for unsupported question types. Verification — manual via story interactions + follow-up TODO for unit tests.
- `packages/runtime/src/core/navigation.ts`: Purpose — compute eligible question IDs + cursor movement. API — helper functions `getEligibleIds`, `getNextId`, `getPrevId`. State — pure. Edge cases — no eligible questions, branching placeholders. Verification — exercised via story `next`/`prev`.
- `packages/runtime/src/core/selectors.ts`: Purpose — derive progress, unanswered ids, getters wrappers. API — `createSelectors`. State — uses FormApi state snapshots. Edge cases — safe access when question missing. Verification — smoke via story.
- `packages/runtime/src/core/events.ts`: Purpose — minimal typed event emitter. API — `createEventBus` returning `emit/on/off`. State — internal map of listeners. Edge cases — removing listeners during emit. Verification — actions emit expected events (checked in dev console later).
- `packages/runtime/src/core/state.ts`: Purpose — instantiate FormApi, wire schema, manage runtime status/currentId, expose context/actions/events. API — `createRuntime(config)`. State — `FormApi`, derived store, custom status machine. Edge cases — guard `actions.next()` on invalid, `submit` error handling, async transport. Verification — story run-through + TODO for tests.
- `packages/runtime/src/transport/fetchTransport.ts`: Purpose — default transport using global fetch. API — `fetchTransport({ baseUrl })` returning `submit/savePartial`. State — none. Edge cases — non-2xx responses -> throw `RuntimeTransportError`. Verification — not executed in story; TODO to add integration once backend ready.
- `packages/runtime/src/index.ts`: Purpose — surface exports (`createRuntime`, `fetchTransport`, types). API — re-exports modules. State — none. Edge cases — maintain ESM-only. Verification — import in story.
  - `apps/ui-docs/stories/StripeSDE2Application.stories.tsx`: Purpose — Storybook entry rendering Stripe SDE2 application form using runtime. API/props — Storybook story, no external props; internal `StripeSDE2Application` component consumes runtime context/actions. State — runtime-managed only. Edge cases — required fields, resume upload stub, submission success path. Verification — run story (manual) + typecheck.

## Pre-Implementation Notes — 2025-10-19

- `apps/ui-docs/stories/AirbnbAppSecApplication.stories.tsx`
  - Purpose: Storybook entry for Airbnb Application Security Engineer application with two tabs (Overview/Application). Classic all-fields form on Application tab using runtime for values/validation/submit.
  - API/props: Storybook story only; internal components `OverviewTab`, `ApplicationTab` are local.
  - State: Values managed by `@formlink/runtime`; UI controlled via React state only for rendering; no external state.
  - Edge cases: Email/number formatting normalized by runtime; multi-select shows badges with overflow handling; errors reveal on failed submit and clear on change.
  - Verification: `pnpm -w typecheck`; manual smoke in Storybook; transport mocked locally.

## Decision Log — 2025-10-19

- Added a new Storybook story `apps/ui-docs/stories/AirbnbAppSecApplication.stories.tsx` implementing an Airbnb “Application Security Engineer” flow with two tabs: “Role overview” and “Application”.
  - Overview tab: static qualitative description only (no invented metrics).
  - Application tab: classic all-fields layout built with `@formlink/ui` inputs and unified dropdowns. All questions are visible at once, values flow through `@formlink/runtime` via `runtime.actions.set`, and submit uses runtime’s fail-first validation and submit lifecycle.
  - Selections use `UnifiedDropdownSelect` and `UnifiedDropdownMultiSelect` in `mode="typeform"` for visual parity with our components, while maintaining a classic grid presentation.
- Transport: kept story-local mock `RuntimeTransport` (no network). Submit transitions to `completed` when valid; invalid fields are revealed via `visibleError(qid)` per runtime policy and clear on change.
- Validation: kept centralized in runtime; story avoids bespoke gating. Numeric text input normalizes via runtime’s number handling.
- Lint/Typecheck: `pnpm -w typecheck` passes. `pnpm -w lint` still fails due to pre‑existing warnings in `apps/formfiller` (unchanged). Not addressed here to keep the change surgical.

- Updated the Airbnb story to include Runtime Devtools on the left (sticky) to validate event flows and visible errors while interacting with the Application tab.
- Added a resume upload field (fileUpload) in the Application tab with `UnifiedFileUpload` wired to runtime `actions.upload` → store descriptor via `actions.set`. Transport mocked to return an object URL and metadata. Also adjusted layout so the tabs span full width; the content (including Devtools + form) renders below the tabs.
- Implemented a Thank You state: when runtime status becomes `completed`, the Application tab now renders a confirmation card instead of the form, with a button to start a new application (reset + start). Error state shows a retry button.

## UI Toast Usage — 2025-11-04

- Import `Toaster` from `@formlink/ui` and `toast` from `sonner` in app code. Do not import `toast` from `@formlink/ui` (UI only re-exports `Toaster`).
- Prefer `toast.success|error|warning("Message", { description })` or `toast("Message", { description })` instead of object-first calls.
- AI Elements: use `PromptInputFooter` (not `PromptInputToolbar`) and `Suggestion`/`Suggestions` (not `PromptSuggestion`).
