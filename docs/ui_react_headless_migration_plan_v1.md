# Formlink Runtime — ui/react → headless/react Migration Plan (Typeform Mode)

This document is the implementation plan to refactor `@formlink/runtime/ui/react` so all Typeform‑mode components are powered by a new spreadable hooks layer (`@formlink/runtime/headless/react`). It is intended to be used as a task breakdown for a new implementation thread.

Status: Draft (v1)
Owners: Runtime UI team
Related docs:

- docs/formlink_runtime_headless_ports_v1.md (Headless Ports Guide: behaviors, contracts, wiring)

---

## 1) Mission & Success Criteria

Mission

- Make `ui/react` a thin, styled layer on top of spreadable, framework‑agnostic “headless” logic.
- Preserve current behavior 1:1 (branching, transitions, keyboard/focus, required‑only gating, auto‑advance policies).
- Improve DX so authors can use simple hooks (like react‑hook‑form): spread `containerProps`/`getItemProps`/`triggerProps` and things “just work”.

Success Criteria

- All Typeform components in `ui/react` now built on `headless/react` hooks with no embedded keyboard/roving logic.
- Shortcut gating works: letters/digits only when hints are rendered.
- Option‑focused Enter/Space does not advance for multi/rating/linear; popover triggers bail global Enter.
- Branch‑aware numbering and direction are still correct; Progress remains outside Transition.
- Clear docs + examples for React (and guidance for Vue/Solid/Svelte/Preact ports).

Non‑Goals (for this iteration)

- Re‑theme or restyle components (keep Tailwind + shadcn).
- Change public props of `ui/react` components (beyond internal rebuild).
- Implement non‑Typeform modes (Classic/Chat) in headless (can follow later).

---

## 2) Deliverables Overview

Packages & surfaces

- New: `@formlink/runtime/headless/react` (subpath export) providing spreadable hooks.
- Refactor: `@formlink/runtime/ui/react` components to use those hooks.
- Docs: Headless ports guide (already present), API reference for hooks, provider contract, stories.

Tests

- Headless unit tests (Node) for controllers.
- Adapter smoke tests (JSDOM) for key interactions; Storybook flows for visual parity.

---

## 3) Roadmap & Phases

Phase 0 — Package scaffolding (1 day)

- Add subpath export `./headless/react` in `packages/runtime/package.json`.
- Create `src/headless/react/index.ts` (barrel) and folder `src/headless/react/hooks/`.
- Ensure build config picks up new subpath (tsup/exports).

Phase 1 — Headless controllers (2–3 days)

- Add pure controllers (no DOM/framework/timers):
  - `src/headless/keyboard/KeyboardEngine.ts` — map key events → intents; features: enterToContinue, lettersForChoices, numbersForScale; bailouts: editable, IME, overlay, `data-fl-keyscope-stop`, `data-fl-hints` gating.
  - `src/headless/focus/RovingFocusController.ts` — getInitialIndex, next(index, key, { itemCount, disabled? }).
  - `src/headless/choice/ChoiceController.ts` — selectByIndex/Letter/Digit (multi/single/likert) → { nextValue, autoAdvance }.
  - `src/headless/scale/ScaleController.ts` — rating/linear numeric selection; linear alignment with start..end..step.
  - `src/headless/scaffold/TypeformScaffoldCore.ts` — derive(snapshot, engine), direction(prev,next,navHint), shouldAutoAdvance().
  - `src/headless/policy/ValidationPolicy.ts` — helper to get dynamic schema/eligible set with required‑only gating.
- Add node‑only unit tests for each controller.

Phase 2 — React headless hooks (3–4 days)

- Implement spreadable hooks (names align with question semantics):
  - Single choice family: `useSingleChoice`, `useMultiChoice`, `useLikert`, `useRating`, `useLinearScale`.
  - Trigger‑select: `useTriggerSelect` (country/dropdown), `useDate`.
  - Inputs: `useText`, `useTextarea`, `usePhone`.
  - Others: `useRanking`, `useFileUpload`, `useAddress`, `useSignature`.
  - Scaffold: `useTypeformScaffold`, `useTypeformProgress`, `useTypeformDirection`.
- Provide a small global keyboard provider/hook: attaches one capture keydown and pipes to KeyboardEngine; shortcuts only when `data-fl-hints` present.
- Minimal demo story for raw hooks (unstyled) to validate DX.

Phase 3 — ui/react refactor (4–6 days)

- Rebuild components to consume hooks (remove embedded logic):
  - InlineSelect → useSingleChoice
  - InlineMultiSelect → useMultiChoice
  - UnifiedLikert → useLikert
  - InlineRating → useRating (focus arrows; Enter/Space select only)
  - UnifiedLinearScale → useLinearScale (underline via getValueLabelProps)
  - UnifiedDropdownSelect/UnifiedCountrySelect → useTriggerSelect (trigger has `data-fl-keyscope-stop`; Enter toggles)
  - UnifiedDatePicker → useDate (popover/native variants)
  - TypeFormTextInput → useText; Textarea → useTextarea; Phone → usePhone
  - InlineRanking → useRanking (+ optional dnd adapter)
  - UnifiedFileUpload → useFileUpload (upload then continue)
  - UnifiedAddressInput → useAddress (emit on user edits; Enter step; last → continue)
  - Transition & Layout unchanged; get direction from `useTypeformScaffold`.
- TypeformTemplate/Scaffold: call `useTypeformScaffold`; pass navHint (±1) before actions; keep Progress outside Transition.
- ShadCnProvider: remain default primitive injector; document provider contract; allow custom primitives.

Phase 4 — Docs & Storybook (2 days)

- Update `docs/formlink_runtime_headless_ports_v1.md` with API index per hook and per‑control checklists.
- Add “Headless Hooks” stories: spread props on native elements.
- Add “Scaffold demo” story (Typeform journey in ~40 LOC).

Phase 5 — Tests & parity (2–3 days)

- Headless unit tests (Node): keyboard (letters/digits/numbers + bails), roving, choice/scale auto‑advance, scaffold direction, validation policy, address emit‑loop guard.
- Adapter smoke tests (JSDOM):
  - Enter does not advance from focused multi/rating/linear options.
  - Trigger buttons toggle on Enter/Space; global Enter is bailed.
  - Numeric shortcuts accept only valid linear values; only when hints on.
- Manual Storybook walkthrough against existing stories.

Phase 6 — Release (1 day)

- Version bump; CHANGELOG.
- Optional deprecations: remove/mark old internal utilities.
- Announce: ui/react powered by headless/react; behavior unchanged; headless hooks available for custom renderers.

---

## 4) Directory & File Map

- `packages/runtime/src/headless/`
  - `keyboard/KeyboardEngine.ts`
  - `focus/RovingFocusController.ts`
  - `choice/ChoiceController.ts`
  - `scale/ScaleController.ts`
  - `scaffold/TypeformScaffoldCore.ts`
  - `policy/ValidationPolicy.ts`
- `packages/runtime/src/headless/react/`
  - `index.ts`
  - `hooks/useSingleChoice.ts`, `useMultiChoice.ts`, `useLikert.ts`, `useRating.ts`, `useLinearScale.ts`
  - `hooks/useTriggerSelect.ts`, `useDate.ts`
  - `hooks/useText.ts`, `useTextarea.ts`, `usePhone.ts`
  - `hooks/useRanking.ts`, `useFileUpload.ts`, `useAddress.ts`, `useSignature.ts`
  - `hooks/useTypeformScaffold.ts`, `useTypeformProgress.ts`, `useTypeformDirection.ts`
  - `KeyboardProvider.tsx` (optional)
- `packages/runtime/src/ui/react/` (refactors)
  - Components import hooks from `headless/react` and spread props; remove embedded keyboard/focus code.

---

## 5) Hook Specs (React)

Each hook returns prop getters to spread on DOM nodes. Shown here are primary shapes (details in ports guide):

- `useSingleChoice({ id, options, showKeyboardHints?, autoAdvance? })`
  - `containerProps: { ref, role:'group', 'data-fl-hints'?: '1' }`
  - `getItemProps(i): { role:'option', tabIndex, 'aria-selected', onKeyDown, onClick }`
  - `renderHint(i): ReactNode` (A/B/C or 1..N when hints on)
- `useMultiChoice({ id, options, showKeyboardHints? })`
  - Same shape; Enter/Space toggles (stopPropagation); group Enter continues.
- `useLikert({ id, options, showKeyboardHints? })`
  - Wraps useSingleChoice with string options.
- `useRating({ id, min?, max?, showKeyboardHints? })`
  - `getStarProps(i)`; arrows move focus; Enter/Space select (no continue); click/digits auto‑advance when hints on.
- `useLinearScale({ id, start, end, step?, showKeyboardHints? })`
  - `values: number[]` + `getItemProps(i)` + `getValueLabelProps(i)` (underline focus); digits only if alignment valid.
- `useTriggerSelect({ id, options, autoAdvanceOnSelect? })`
  - `triggerProps: { role:'combobox', 'data-fl-keyscope-stop': true, onKeyDown(Enter/Space toggle) }`
  - `listboxProps`, `getItemProps(i)` (select + auto‑advance), `{ open, setOpen, selectedLabel }`.
- `useDate({ id, mode:'popover'|'native' })`
  - Popover mode behaves like trigger‑select; native mode allows Enter to continue (optional policy).
- `useText({ id, type? })`, `useTextarea({ id })`, `usePhone({ id })`
  - `inputProps`/`textareaProps` with underline; Enter continues; Shift+Enter newline (textarea); number sanitize.
- `useRanking({ id, options, dndAdapter? })`
  - `getItemProps(i)`, `moveUp(i)`, `moveDown(i)`, `onReorder(next)`.
- `useFileUpload({ id, accept?, maxFiles? })`
  - `inputProps`, `browseProps`; onChange → upload → continue.
- `useAddress({ id, requiredFields? })`
  - `fields`, `getFieldProps(name, idx, isLast)`: Enter steps; last → continue; emits on user edits only.
- `useSignature({ id })`
  - `canvasRef`, `canvasProps`, `clear()`.
- Scaffold:
  - `useTypeformScaffold()` → `{ qId, q, index, total, percent, direction, setNavHint, onContinue, onBack, enterHint }`
  - `useTypeformProgress()` → `{ index, total, percent }`
  - `useTypeformDirection()` → `{ navHint, setNavHint }`

---

## 6) Acceptance Criteria (Detailed)

- UI parity: All Typeform stories work as before (flow/branching/direction/progress/auto‑advance/keyboard/focus/combobox/date).
- Shortcut gating: letters/digits work only when hints rendered (data‑fl‑hints on container).
- Safety: option‑focused Enter/Space does not advance for multi/rating/linear; triggers stop global Enter.
- Required‑only gating: optional unanswered does not block back/next; submit reveals only eligible errors.
- DX: components built from hooks show a clear mapping (hook → component), and docs explain spread pattern.

---

## 7) Risks & Mitigations

- Behavior drift → lock with headless unit tests + Storybook interaction checks.
- Provider coupling → document `ShadCnProvider` contract; allow unstyled/native fallbacks; encourage custom provider mapping.
- Performance → single global key capture; early bails (overlay, data‑attr, IME); no per‑option capture.
- Incremental refactor → migrate one component family at a time; keep small PRs; validate with stories.

---

## 8) Owner Checklist (per phase)

- [ ] Phase 0: subpath exports, barrel, build config
- [ ] Phase 1: controllers + tests (keyboard/focus/choice/scale/scaffold/policy)
- [ ] Phase 2: hooks + KeyboardProvider + unstyled stories
- [ ] Phase 3: ui/react refactor family‑by‑family (single/multi, rating/linear, triggers, inputs, ranking, file, address, signature)
- [ ] Phase 4: docs + storybook (hooks + scaffold demos)
- [ ] Phase 5: tests (headless + adapter smoke) + manual parity run
- [ ] Phase 6: release + changelog + deprecations

---

## 9) Next Steps

1. Kick off Phase 0/1 in a fresh branch.
2. Land controllers with tests; create initial `useSingleChoice` and `useTriggerSelect` hooks as exemplars.
3. Refactor InlineSelect and UnifiedDropdownSelect to use hooks; validate in Storybook.
4. Iterate across remaining components; update docs as hooks land.
5. Final test pass + release.

---

This plan keeps the UI surface stable, moves all behavior to headless, and enables consistent ports across React/Vue/Solid/Svelte/Preact with minimal userland glue.
