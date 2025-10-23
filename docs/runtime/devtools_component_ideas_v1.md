# @formlink/runtime — Devtools Component Ideas (v1)

Last updated: 2025-10-19
Status: Proposal / Implementation notes

## 1) Goals

- Add a powerful Devtools for headless runtime users to:
  - Inspect and drive a form (Fill mode)
  - Capture transport calls for debugging (submit/partial/upload)
  - Edit the form schema inline (Edit mode) and re-initialize the runtime
- Keep the core runtime React‑free; ship Devtools as an optional subpath export.

## 2) Modes & UX

- Fill
  - Live event timeline: status, cursor, visibility, progress, answer:set, validate pass/fail, submit/partial/upload lifecycles, transport taps.
  - Filters: Validation | Navigation | Submit/Partial | Transport | Uploads.
  - Inspect: currentId, eligibleIds, progress, values, visibleError, errors.
  - Actions: next, prev, goTo(qid), validate(qid), validateAll(), submit(), savePartial(), reset().

- Transport
  - Table: id, kind (submit/partial/upload), timings, request, response, error.
  - Controls: simulate latency (ms), force next error (kind + status/message), toggle recording.

- Edit
  - Left: questions list (add/remove/reorder).
  - Right: editor for question (title/description/type/validations/options).
  - Validators preview (derived from question config).
  - Apply/Discard. Applying re-inits runtime with migration.

## 3) Runtime Instrumentation

- Extend RuntimeEventMap (non‑breaking additions):
  - "partial:requested" | "partial:success" | "partial:error"
  - Optional general taps: "transport:request" | "transport:response" | "transport:error" with { kind, meta }.
- Emit points in actions:
  - submit(): already emits submit:requested, submit:transport:start, submit:transport:end, submit:success/error.
  - savePartial(): emit partial:requested before call; partial:success/error after.
  - upload(): reuse upload:success/error; optionally emit transport taps.

## 4) Transport Recorder

- Create a wrapper implementing RuntimeTransport that records calls.
- API: `createTransportRecorder(base?: RuntimeTransport, options?: { defaultLatencyMs?: number })`.
- Methods: submit/savePartial/upload proxy base; record { id, kind, request, result/error, timings }.
- Fault injection: `recorder.setLatency(ms)`, `recorder.forceNextError({ kind, status, message })`.
- No React dependency.

## 5) Devtools API/Props

- `Devtools` (subpath: `@formlink/runtime/devtools`)
  - Props:
    - `runtime: RuntimeApi` (required)
    - `transportRecorder?: TransportRecorder` (optional; enables Transport tab/controls)
    - `onApplySchema?: (nextForm: Form) => void` (optional; if absent, Devtools performs internal re-init)
  - Tabs: Overview | Fill | Events | Transport | Edit

## 6) Re-initialization & Migration

- Draft form schema maintained in Devtools until Apply.
- On Apply:
  - Build new schema; compute defaults.
  - Migrate values per qid:
    - Compatible type → normalize/keep.
    - Text→email/url/number: coerce where possible; else drop.
    - Single↔multi choice: map to first/array; drop invalid labels.
    - Removed/missing questions → drop value.
  - Recreate runtime with: { form: draft, transport: same/recorder, initialValues: migrated, initialCurrentId: previous if eligible }.
  - Dispose old runtime.

## 7) Files (purpose, API/props, state, edge cases, verification)

- `packages/runtime/src/types.ts`
  - Purpose: Add event typings for partial + optional transport taps.
  - API: Extend `RuntimeEventMap` with new keys.
  - State: N/A.
  - Edge: backward compatible; do not rename existing events.
  - Verify: typecheck; Devtools compiles against new types.

- `packages/runtime/src/core/state.ts`
  - Purpose: Emit partial lifecycle events; optionally transport taps.
  - API: None (events only); actions unchanged.
  - State: None added.
  - Edge: Ensure partial does not flip status; keep fail‑first submit.
  - Verify: unitish via Storybook — events appear in Devtools.

- `packages/runtime/src/devtools/TransportRecorder.ts`
  - Purpose: Wrap transport to record calls + inject faults.
  - API: `createTransportRecorder(base, options)` returns { transport, getRecords(), setLatency(), forceNextError() }.
  - State: internal records array; simple id counter.
  - Edge: recorder off → passthrough; large payload pretty‑print.
  - Verify: story table shows rows; toggles work.

- `packages/runtime/src/devtools/Devtools.tsx`
  - Purpose: UI container with tabs for Overview, Fill, Events, Transport, Edit.
  - Props: `{ runtime, transportRecorder?, onApplySchema? }`.
  - State: tab selection; event filters; edit draft schema.
  - Edge: large forms (virtualize events list if needed); safe schema edits; id uniqueness.
  - Verify: manual through `apps/ui-docs` story.

- `packages/runtime/src/core/recreate.ts`
  - Purpose: Helper to safely dispose and re‑instantiate runtime with new form + values.
  - API: `recreateRuntime(prev, { form, transport, initialValues, initialCurrentId })`.
  - State: None.
  - Edge: detach listeners; avoid memory leaks.
  - Verify: navigating/submit still works post‑apply.

- `apps/ui-docs/stories/…`
  - Purpose: Wire recorder + Devtools; demo Fill + Edit.
  - API: none.
  - State: optional visited set for first‑visit empty auto‑open on selects.
  - Edge: none.
  - Verify: manual; typecheck green.

## 8) Acceptance Criteria (MVP)

- Fill tab shows/filters events; controls work; submit/partial lifecycles visible.
- Transport tab records submit/partial/upload with payloads + timings; latency/error injection works.
- Edit tab edits text/singleChoice/multipleChoice + basic validations; can add/remove/reorder; Apply re‑inits runtime; values migrate where possible.
- Docs updated; story demonstrates end‑to‑end.

## 9) Phase 2 Ideas

- More types (rating, linearScale, date, file upload) in Edit.
- Branching preview with mock answers driving eligibleIds.
- Virtualized events table; export trace as JSON.
- Schema diff viewer before Apply.
