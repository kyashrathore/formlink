# Formfiller Typeform Mode — Phase 0 Status, Changes, and Known Bugs

Owner: Staff Frontend Architect  
Scope: apps/formfiller (mode-owned), minimal changes to @formlink/ui

Last updated: 2025-09-02

## Summary

Phase 0 aimed to correct Typeform-mode mappings and render semantics for AI-generated question types without a broad refactor or touching unrelated modes. The goal was to make Typeform mode own its behavior/visuals and ensure labeled Likert vs numeric linear scale, semantic text formats, and correct choice widgets.

Despite the changes, the user reports selection is not working for single choice and likert, and ranking interactions are blocked. This document captures the exact code diffs, current behavior, suspected causes, and a concrete plan to fix.

---

## What changed in Phase 0

1. New Typeform input switcher (apps/formfiller)

- Added: apps/formfiller/components/typeform/TypeFormQuestionInputSwitcher.tsx
- Replaced InputContainer usage in TypeFormQuestion with this switcher:
  - File: apps/formfiller/components/typeform/TypeFormQuestion.tsx

2. Correct mapping for question types (Typeform mode)

- text.format → TypeFormTextInput (email/url/tel/number/password/textarea/text)
- singleChoice → local TypeFormSingleSelect (Phase 0 fallback)
  - Added file: apps/formfiller/components/typeform/TypeFormSingleSelect.tsx
- multipleChoice → UnifiedMultiSelect in “typeform” mode
- rating → UnifiedRating in “typeform” mode (max, keyboard hints)
- linearScale → UnifiedLinearScale in “typeform” mode (start/end/step/labels)
- likertScale → local TypeFormLikert (labels only, not numeric)
  - Added file: apps/formfiller/components/typeform/TypeFormLikert.tsx
  - Added pointer-events and event-stop patch in this file to prevent parent’s swipe/scroll capturing
- date (single) → UnifiedDatePicker in “typeform” mode with ISO conversion
- dateRange → temporary text input placeholder (will implement in Phase 1)
- fileUpload → UnifiedFileUpload in “typeform” mode with validations and questionId-aware upload
- address → UnifiedAddressInput in “typeform” mode
- ranking → UnifiedRanking in “typeform” mode; wrapped in pointer-events container to stop swipe scroll capturing
- fallback → TypeFormTextInput

3. Navigation/gesture guards

- apps/formfiller/components/typeform/TypeFormView.tsx
  - Disabled scroll/swipe navigation when current question is interactive (ranking, likertScale, singleChoice, multipleChoice)
  - This aims to avoid gestures swallowing pointer events while choosing options

4. Docs

- Phase plan and broader architecture documented in docs/v2/lld-formfiller-mode-components.md

---

## Current user-reported behavior (bugs)

- Single choice (TypeformSingleSelect):
  - Not selectable; click does not register/doesn’t advance.
- Likert (TypeFormLikert):
  - Not selectable; appears like a single-select list but clicks do not register.
- Ranking (UnifiedRanking in Typeform mode):
  - Cannot drag items; ranking dropdowns not usable.

Reproduction context:

- Typeform mode, with generated schema containing singleChoice, likertScale, and ranking items.

---

## Files touched in Phase 0

- New components:
  - apps/formfiller/components/typeform/TypeFormQuestionInputSwitcher.tsx
  - apps/formfiller/components/typeform/TypeFormSingleSelect.tsx
  - apps/formfiller/components/typeform/TypeFormLikert.tsx

- Updated:
  - apps/formfiller/components/typeform/TypeFormQuestion.tsx (switched from InputContainer to the new switcher)
  - apps/formfiller/components/typeform/TypeFormView.tsx (disable scroll/swipe when interactive)

No changes were made to Chat/Classic in Phase 0.

---

## Hypotheses for broken interactions

1. Gesture/scroll capture still interfering

- Even with scroll/swipe disabled on interactive questions, there may be a parent handler or transition capturing pointer events or preventing default in a way that blocks clicks/drags.
- Candidates:
  - TypeFormTransition (motion AnimatePresence) is okay for most systems, but worth validating if the wrapper or positioning influences hit testing.
  - Layout container (TypeFormLayout) sets overflow-hidden on the screen; while normal, it can interact with child transforms. Shouldn’t block clicks, but verify.

2. Z-order and overlay (less likely)

- We did not find a z-index overlay or pointer-events: none in the Typeform components. CSS search in `apps/formfiller/components` found no clues for overlay/absolute interceptors.
- However, navigation or progress UI could be positioned above the main content in some conditions.

3. Event props collisions in unified primitives

- Some unified components rely on containerProps.get\* (e.g., BaseSelect/BaseRanking) that may need the container event handlers (onKeyDown, onClick) attached to higher divs. In our local wrappers (TypeFormSingleSelect, TypeFormLikert) we did not attach those hooks (by design to keep Phase 0 local), but they use direct onClick, which should still work.
- Ranking relies on dnd-kit; pointer event capture by higher layers would block drag.

---

## Diagnostic plan (Phase 0.1)

Goal: make selection and drag work reliably. Approach: binary isolate gesture/navigation and verify event hit testing.

1. Temporarily remove TypeFormTransition for interactive questions (test only)

- Render child without AnimatePresence for interactive question types.
- If click/drag starts working, the transition wrapper may be intercepting events unintentionally.

2. Add a top-level “interaction sandbox” wrapper for interactive types

- For singleChoice, likertScale, ranking, and multipleChoice:
  - Wrap rendered component in a div with:
    - className="relative z-10 pointer-events-auto"
    - onMouseDown/onTouchStart: stopPropagation
- This ensures nothing above intercepts pointer events and nothing
