Formlink Runtime Adoption & Linking Plan (v1)
Last updated: 2025-11-05

Summary

- Replace ad‑hoc Typeform UI in `apps/formfiller` with `@formlink/runtime`.
- Ship a first‑party `<LinkWithFormlink />` component in runtime to make external apps “link” a generated form to Formlink (existence + schema/version checks, clear UI).
- Move form generation to produce the new JSONata‑based branching spec and wire it through the runtime flow engine.
- Make Formcraft preview aware of external hosting so we don’t show internal authoring controls when embedding third‑party runtimes.

Crisp Questions (blocking details)

- What is the base URL for link/existence checks? Provide one of: required prop on `<LinkWithFormlink baseUrl="…" />`, or a constant env (e.g., `FORMLINK_BASE_URL`). Defaulting silently is not acceptable.
- Should the “linking” UI be completely hidden in first‑party apps (Formcraft/Formfiller)? Proposed: yes; opt‑out via an explicit `usage` prop.

Acceptance (global)

- `pnpm typecheck` and `pnpm lint` are clean across workspace.
- Typeform flows in Formfiller render via runtime with parity (keyboard, animations, progress, auto‑advance, upload) on existing example forms.
- Branching uses the compiled RouteSpec (no AI round‑trip during navigation), and Devtools can explain decisions.

Task 1 — Adopt runtime in Formfiller (All modes: typeform, classic, ai chat)

- Reference patterns (authoritative examples)
  - Classic: `apps/ui-docs/stories/StripeSDE2Application.stories.tsx` (manual composition with `createRuntime`, UI primitives, progress, submit/reset wiring).
  - AI Chat: `apps/ui-docs/stories/ChatGlueRealBackend.stories.tsx` (chat glue primitives: `useSlotBridge`, `useSubmitSelection`, `useFileUploadSubmission`, `useChatStartCard`, `useQuestionPlaceholder`, `PromptInputTypedAssist`). Also see `apps/ui-docs/stories/ChatTemplateRealBackend.stories_v1.tsx` for the `ChatTemplate` controller wiring example.

- Scope by mode
  - Typeform
    - Replace local Typeform components with `@formlink/runtime/ui/react` `TypeformTemplate` under a `RuntimeProvider`.
    - State via `createRuntime`; transport via `createFormfillerTransport`.
  - Classic
    - Option A (faster): use `ClassicTemplate` with `form.questions` for immediate parity; extend via `nodes` where needed.
    - Option B (match story): compose a thin page component that mirrors the Stripe SDE2 story (progress, header, inputs mapped to runtime actions), still powered by a single `runtime` instance.
  - AI Chat
    - Replace bespoke chat filling flow with runtime chat glue primitives.
    - Wire to existing endpoints: `/api/ai/chat-assist`, `/api/upload`.
    - Keep `journeyScript` for AI prompts; navigation should rely on glue tools and server responses.

- Targeted files (surgical)
  - `apps/formfiller/app/[formId]/FormPageClient.tsx` — instantiate runtime once per page render; branch on mode to render:
    - Typeform: `<RuntimeProvider><TypeformTemplate flowEngine?={flow}/></RuntimeProvider>`
    - Classic: `<RuntimeProvider><ClassicTemplate nodes={…?} /></RuntimeProvider>` (Option A), or a composed JSX wrapper (Option B).
    - AI: new chat component using glue hooks (see below).
  - New (AI chat): `apps/formfiller/components/chat/ChatTemplate.tsx` (props: `form: Form`, `baseUrl: string`, optional `initialMessages`).
  - Deletion (after parity): `apps/formfiller/components/typeform/*`.
  - Keep: `components/shared/IntroScreen.tsx`, `CompletionScreen.tsx` if still referenced.

- Mapping (current → runtime)
  - Navigation/progress/transitions → `TypeFormNavigation`, `TypeFormProgress`, `TypeFormTransition` (Typeform template handles most).
  - Inputs → unified wrappers: phone/date/select/multi/ranking/likert/linearScale/file.
  - Validation → runtime’s schema/validation (remove local `validateTextValue`).
  - Upload → `runtime.actions.upload` via `createFormfillerTransport`.
  - Chat glue → `useSlotBridge`, `useSubmitSelection`, `useFileUploadSubmission`, `useChatStartCard`, `useQuestionPlaceholder`, `PromptInputTypedAssist`.

- Acceptance
  - Typeform: parity on keyboard, animations, auto‑advance, visibility, save/upload/submit.
  - Classic: renders full flow with progress and submit/reset; required‑only gating behaves per runtime; story inputs map 1:1.
  - AI Chat: end‑to‑end flow with `/api/ai/chat-assist` tool invocations; file upload works; start card + placeholders behave like the story.
  - No regressions on `/api/upload` and `/api/forms/[formId]/save-answers`.

Task 2 — `<LinkWithFormlink />` component (runtime)

- Location
  - New: `packages/runtime/src/ui/react/LinkWithFormlink.tsx`; export from `packages/runtime/src/ui/react/index.ts`.

- Props (explicit)
  - `formId: string` — required.
  - `schema: import("@formlink/runtime").Form` — required.
  - `routeSpec?: import("@formlink/runtime").FormlinkFlowRouteSpec` — optional, if present validate against server state too.
  - `usage: 'first_party' | 'third_party'` — required. Hide UI entirely when `first_party`.
  - `baseUrl: string` — required host for checks (no implicit default).
  - `onLinked?: (info: { formId: string; versionId: string }) => void` — optional callback.

- Behavior
  - Dev‑time quick check: on mount (dev only) read from `localStorage['formlink:link:' + formId]` with a 24h TTL to decide if a server check is needed.
  - Server check API (read‑only): `GET {baseUrl}/api/forms/{formId}`; compare `version_id` and a schema hash of `questions` and `settings`.
  - UI states: Not Linked → show “Connect with Formlink”; Linked & In‑Sync → hide/notch; Linked & Changed → show “Schema changed” with an “Update link” action.
  - No silent fallbacks; if checks fail, show a clear error and do nothing.

- Acceptance
  - External sample app renders `<LinkWithFormlink />` and surfaces the correct state transitions without spurious network calls.
  - First‑party usage hides the button entirely.

Task 3 — Generate JSONata RouteSpec (new branching)

- Change
  - Codegen must emit `form.settings.branching.spec: RouteSpec` and stop relying on `journeyScript` for runtime navigation (keep for copy/AI prompts only).
  - RouteSpec MUST account for generated nodes. If the compiler expands/synthesizes nodes, include them deterministically so Devtools can reference and explain them.

- Wiring
  - In the formfiller Typeform path, build `const flow = FormlinkFlow.compile(form.settings.branching.spec, form)` and pass to `TypeformTemplate`.
  - Devtools: allow `flow.explain()` to render in the runtime Devtools pane.
  - Ensure the compiled program preserves an addressable list/map of generated nodes for visibility and debugging.

- Acceptance
  - Unit test: compile succeeds on at least two real forms; `visibleSet()` and `nextNode()` match expected paths for canned answers.
  - No network calls to `/api/ai/branching` during navigation when `spec` exists.
  - Devtools can display and resolve generated nodes by id; explanations include when a node was synthesized vs authored.

Task 4 — Formcraft external‑hosting awareness

- Change
  - When a form originates from an external linked project, preview inside an iframe pointing to their host; disable schema‑update/authoring agents in that view.

- Hooks
  - Add a source field to authoring state (e.g., `forms.agent_state.lifecycle_v1.source: 'first_party' | 'third_party'`).
  - Respect that flag in preview routes and authoring UI feature gates.

- Acceptance
  - Opening a third‑party‑linked form shows iframe preview and hides schema update actions. First‑party forms keep full preview/editor controls.

Implementation Notes (guardrails)

- No fallbacks: If linking checks fail, surface errors; do not guess or auto‑create.
- Use `@/*` path aliases and import UI as `"@formlink/runtime/ui/react"` and `"@formlink/ui"`.
- Remove debug logs before merging; keep clear error logs in server routes.
- Validate continuously: `pnpm typecheck`, `pnpm lint`. Do not build while dev server runs.

Surgical Change List (by file)

- `apps/formfiller/app/[formId]/FormPageClient.tsx` — instantiate runtime (typeform), render `TypeformTemplate`.
- `apps/formfiller/components/typeform/*` — delete after parity and removal of references.
- `packages/runtime/src/ui/react/LinkWithFormlink.tsx` — new file; export in `packages/runtime/src/ui/react/index.ts`.
- (Optional) `apps/formcraft/*` — add source‑aware preview gating.
- `apps/formfiller/package.json` — add dependency `@formlink/runtime: workspace:*`.
- `apps/formfiller/tsconfig.json` — add path aliases for `@formlink/runtime`, `@formlink/runtime/ui/react`, and `@formlink/runtime/*`.

Deletions After Parity (authoritative list)

- Typeform (replace with runtime template)
  - `apps/formfiller/components/typeform/TypeFormView.tsx`
  - `apps/formfiller/components/typeform/TypeFormLayout.tsx`
  - `apps/formfiller/components/typeform/TypeFormNavigation.tsx`
  - `apps/formfiller/components/typeform/TypeFormProgress.tsx`
  - `apps/formfiller/components/typeform/TypeFormQuestion.tsx`
  - `apps/formfiller/components/typeform/TypeFormQuestionInputSwitcher.tsx`
  - `apps/formfiller/components/typeform/TypeFormSingleSelect.tsx`
  - `apps/formfiller/components/typeform/TypeFormAddress.tsx`
  - `apps/formfiller/components/typeform/TypeFormAddressInput.tsx`
  - `apps/formfiller/components/typeform/TypeFormDate.tsx`
  - `apps/formfiller/components/typeform/TypeFormRanking.tsx`
  - `apps/formfiller/components/typeform/TypeFormLinearScale.tsx`
  - `apps/formfiller/components/typeform/TypeFormPhoneInput.tsx`
  - `apps/formfiller/components/typeform/TypeFormTransition.tsx`
  - `apps/formfiller/components/typeform/KeyboardShortcutModal.tsx`
  - `apps/formfiller/components/typeform/animations/questionTransitions.ts`
  - `apps/formfiller/components/typeform/hooks/useTypeFormKeyboard.ts`
  - `apps/formfiller/components/typeform/hooks/useTypeFormScroll.ts`
  - `apps/formfiller/components/typeform/hooks/useTypeFormSwipe.ts`

  - Classic (Option A replacement)
  - `apps/formfiller/components/classic/ClassicFormView.tsx` (replace with `ClassicTemplate`)

- Chat (phase 3 replacement; keep until AI glue is in)
  - Entire `apps/formfiller/components/chat/**` directory will be replaced by a new `ChatTemplate.tsx` + UI primitives
  - Keep for now: will delete only after Chat glue reaches parity.

- UI package (replace with runtime UI)
  - `packages/ui/src/form/modes/typeform/**`
  - `packages/ui/src/hooks/typeform/**`
  - `packages/ui/src/form/context/TypeFormOverlayContext.tsx`
  - `packages/ui/src/form/modes/shared/animations.ts` (Typeform‑specific helpers)
  - `packages/ui/src/index.ts` — remove exports of `./hooks/typeform/*` and `./form/modes/typeform/*` once migration completes.

Do Not Import After Migration (use runtime instead)

- Any `apps/formfiller/components/typeform/*`
- `apps/formfiller/lib/utils.ts` functions for Typeform visibility/next (runtime handles). Note: still referenced by Chat; safe to keep until Chat migration, but do not use in new code.
- Any Typeform mode code from `@formlink/ui` (e.g., `packages/ui/src/form/modes/typeform/*`, `packages/ui/src/hooks/typeform/*`). Use `@formlink/runtime/ui/react` instead.

Preferred Imports

- Typeform UI: `@formlink/runtime/ui/react` (`TypeformTemplate`, unified inputs, navigation/progress components)
- Classic UI: `@formlink/runtime/ui/react` (`ClassicTemplate`)
- Runtime core: `@formlink/runtime` (`createRuntime`, `createFormfillerTransport`, `FormlinkFlow` helpers)

Verification

- Formfiller
  - Manual: load a known Typeform flow, verify progress, back/next, auto‑advance, uploads, submit, redirect.
  - Automated: unit tests for `FormlinkFlow.compile/nextNode/visibleSet/explain` on canned forms.
- LinkWithFormlink
  - Manual: external sample app toggling schema and version id; confirm caching and UI state.
  - Automated: jest/dom tests mocking fetch and localStorage.

Open TODOs (trackable)

- [ ] Decide `baseUrl` provisioning for `<LinkWithFormlink />` (prop vs env).
- [ ] Pick hash function for schema fingerprint (e.g., object stable hash of `questions` + `settings`).
- [ ] Identify first two forms to encode as RouteSpec fixtures for tests.
- [ ] Gate deletions of `components/typeform/*` behind a feature flag until parity is verified.
- [ ] Remove Typeform exports from `packages/ui/src/index.ts` after migration; publish a minor with a clear CHANGELOG entry.

Notes on Original List (fixed typos)

- “redundantant” → redundant; “brachingLogic” → branching logic; “connnection” → connection; “genration” → generation; “udpate” → update.
