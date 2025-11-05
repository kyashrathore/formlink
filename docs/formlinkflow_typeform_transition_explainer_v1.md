# FormlinkFlow + Typeform Transition — Deep Explainer (v1)

This document explains how the new FormlinkFlow engine integrates with the Typeform UI runtime, the rationale behind recent fixes, and the patterns to model deferred branching (depend on Q1, branch after Q5).

## 1) High‑Level Architecture

- Runtime loop (Typeform mode):
  - Schema and values managed by TanStack Form (`FormApi`).
  - Navigation/visibility computed from `FormlinkFlow` via `visibleSet()`.
  - UI renders one question at a time; animations via `TypeFormTransition`.
  - Actions: `start`, `set`, `next`, `prev`, `goTo`, `submit`, `validate`.

- Flow engine (deterministic):
  - Input: `RouteSpec` with routes `{ id, from, when{jsonata}, to, priority }`.
  - Compilation: `FormlinkFlow.compile()` builds a `Program` with order, ANY routes, and `from`-specific routes.
  - Decisions: `nextNode()` uses JSONata truthiness; ANY routes are evaluated first by descending priority, then `from`-specific, else default fallthrough to next in form order; `END` stops.

## 2) Files of Interest

- Flow engine core
  - packages/runtime/src/core/formlinkFlow.ts:1
- Runtime state + navigation
  - packages/runtime/src/core/state.ts:1
  - packages/runtime/src/core/selectors.ts:1
- Typeform UI
  - packages/runtime/src/ui/react/UniversalTypeform.tsx:1
  - packages/runtime/src/ui/react/typeform/Transition.tsx:1
  - apps/ui-docs/stories/UniversalTypeformQuickStart.stories.tsx:1

## 3) Flow Engine Details

- Route evaluation order
  - ANY routes first, sorted by `priority` (higher first).
  - Then `from` == current node, also sorted by `priority`.
  - If none match, default to the next question in the form order; otherwise `END`.

- Path and visibility
  - `path(values)` simulates successive `nextNode()` hops from the first question, with a guard against trivial loops.
  - `visibleSet(values, mode)`: in Typeform mode returns the set of questions visible “so far”. See “Required‑only gating” below.

- JSONata context
  - `when.expr` is evaluated with `{ a: values }`. Example: `a.q_mode = 'city'`.

## 4) Typeform Visibility Semantics (Required‑Only Gating)

Problem this solves: Optional questions left blank used to block navigation and “Back” logic.

- Previous behavior (bug): In Typeform mode, `visibleSet()` stopped at the first unanswered question regardless of `required`. This made optional blanks behave like blockers.

- Current behavior (fix): For the OO API (`new FormlinkFlow`), `visibleSet()` includes questions up to the first REQUIRED unanswered. Optional blanks no longer truncate visibility.

- Runtime integration: `createRuntime()` consumes `flowEngine.visibleSet(values, 'typeform')` to build `eligibleIds`. Back/Next and progress all derive from these ids.

## 5) Runtime Navigation Notes

- `next()`
  - Validates the current field (Typeform: reveal error only on the current field).
  - Advances to `getNextQuestionId(currentId, eligibleIds)`.
  - If Typeform gating yields no next (rare), it falls back to `flowEngine.nextNode(values, currentId)` to keep branch‑consistent progression.

- `prev()`
  - Uses `getPreviousQuestionId(currentId, eligibleIds)`; with required‑only gating, optional blanks no longer trap back navigation.

- Snapshot & progress
  - `eligibleIds` and `currentId` produce `progress.index/total` for progress UI.
  - `firstUnansweredId` is computed from REQUIRED questions only.

## 6) Typeform Transition (Animation)

- Component: `TypeFormTransition`
  - Single keyed child, wrapped by `AnimatePresence` (`mode="wait"`).
  - Variants: `enter` (y: ±100, opacity 0), `center` (y:0, opacity 1), `exit` (y: ∓100, opacity 0).
  - Spring: `{ stiffness: 300, damping: 30 }`.
  - Direction: explicit (+1 next, −1 back) and frozen per transition to prevent mid‑flight flips.

- Why this shape:
  - Single child avoids interactive overlap and “click‑through” bugs.
  - Wait mode keeps sequencing crisp; direction freeze ensures the exiting element moves the right way on back.

## 7) Two Tricky Bugs — Root Cause and Fixes

1. Back shows nothing after skipping an optional
   - Root cause: `visibleSet()` gated on any unanswered, so optional blanks truncated `eligibleIds`. Back relied on truncated `eligibleIds` and became a no‑op; animation appeared blank.
   - Fix: Typeform `visibleSet()` stops only at the first REQUIRED unanswered. Optional blank does not block `eligibleIds`, Back works.

2. Forward/Back animation flicker and click‑through
   - Root cause: dual CSS layers and/or direction mismatch during key change led to overlap, wrong exit direction, and opacity stuck at 0.
   - Fix: single keyed motion.div with wait mode; freeze direction on `questionId` change; defer `prev()` a frame so the old key commits with `direction=-1`.

## 8) Deferred Branching Pattern (Depend on Q1, Branch after Q5)

Goal: Evaluate a condition on an early answer (e.g., Q1), but only change the route after a later question (e.g., after Q5).

- How to model this (simple, robust):
  - Set the route’s `from` to the later question where you want the decision to occur (e.g., `from: 'q_season'`).
  - Reference earlier answers in the `when` JSONata expression (e.g., `a.q_mode = 'city'`).
  - The route will be evaluated when the respondent reaches `from`; it reads Q1’s value but defers branching until after Q5, because `from` is Q5.

- Example (as implemented in the Travel story):
  - Before: routes had `from: 'q_mode'`, which skipped Q2–Q5.
  - After: routes use `from: 'q_season'` while still testing `a.q_mode` — preserving linear base info, then branching.

- Why this works: `FormlinkFlow` evaluates routes at the node in `from`. Predicates can read any earlier values via `a.<questionId>`. You can thus defer the decision point while keeping conditions tied to earlier answers.

- Alternatives (if you need more control):
  - Combine conditions: `when: a.q_mode = 'city' and a.q_season != null` to guard against premature routing.
  - Priorities: place higher priority routes for specific outcomes, plus lower priority defaults.
  - Future idea (not implemented): a `deferUntil` field that explicitly separates “condition source” from “decision point” to reduce authoring churn.

## 9) Best Practices

- Keep `from` at the question where you want the decision to execute; use `when` to reference prior answers.
- Use `priority` to order specificity; prefer ANY routes only for true global overrides (e.g., fast END), not for normal branching.
- In Typeform mode, mark truly blocking questions as `required`; optional blanks will not block navigation.
- For stability, avoid creating chains of routes that immediately fire from early nodes unless intended.
- Reserve arrow keys for in‑control interactions (rating/linear/select navigation). Do not bind global Left/Right/Up/Down for question navigation to avoid conflicts.

## 10) Testing & Debugging Tips

- Unit tests
  - Flow engine: compile validation, nextNode precedence, path cycles, visibleSet typeform/classic, backtracking with value changes.
  - Runtime: next/prev/goTo respect `visibleSet`; submit only at path end.

- Devtools
  - Show eligible/visible set and the current cursor; first required‑unanswered; route trace via `engine.explain(values, currentId)`.

- Common gotchas
  - ANY routes with high priority will preempt form order — ensure that’s intended.
  - Forgetting to mark a blocker as `required` will allow skipping it in Typeform mode.

---

Appendix: Key APIs

- `FormlinkFlow.compile(spec, form)` → `FormlinkFlow`
- `engine.nextNode(values, currentId)` → `nodeId | 'END'`
- `engine.path(values)` → `nodeId[]`
- `engine.visibleSet(values, mode)` → `Set<nodeId>`
- `engine.explain(values, at)` → decision trace
