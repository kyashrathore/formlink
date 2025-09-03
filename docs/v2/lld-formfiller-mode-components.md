# Formfiller: Mode-First Form Components Refactor Plan (Skip Matrix & Signature Initially)

Author: Staff Frontend Architect  
Scope: apps/formfiller (mode-owned components), reuse @formlink/ui primitives where possible  
Non-goals: New question types (likertMatrix, signature) in first iterations

**Document Status (Sept 3, 2025):** Updated based on codebase review. Phase 0/1 (Typeform) is largely complete. Phase 2 (Chat/Classic alignment) is in progress.

---

## 1. Context & Objectives

Current issues:

- AI generates rich question types (text formats, linear vs rating vs likert) but UI renders many as generic controls.
- Typeform, Chat, Classic have different behaviors and chrome; previous attempts to unify via a single wrapper/registry reduced clarity and broke semantics.
- Typeform needs big, guided UX with Continue CTA, keyboard hints, scroll/swipe navigation; Chat is contextless with post-submit validation; Classic is shadcn-native inline forms.

Objectives:

- Mode-first, explicit mapping: each mode owns its behavior and visuals; avoid a registry/unified wrapper.
- Correctly render all current question formats with visual cohesion per mode.
- Keep shadcn as the single source for design tokens; use class variants for mode density/scale (no extra token layer).
- Ship incrementally, test each step in isolation.

---

## 2. Hard Decisions

- No registry. No unified wrapper. Use explicit switches per mode to pick components by (question.type.name, format, display).
- shadcn variables are the only design token source; mode identity is expressed via Tailwind/CVA classes.
- Reuse @formlink/ui primitives for low-level interactions (text, select, rating, linear, date, file, address, ranking). Add hooks/utilities only where they provide clear value (validation mapping, a11y helpers, value coercers).
- motion/react only for micro transitions (never framer-motion).

---

## 3. Data Contracts (Value Types)

These are consumed/produced by mode components. They must stay consistent:

- text.\*: string
  - email/url/password/tel/number/textarea/text
- country: string (ISO 3166-1 alpha-2 recommended)
- singleChoice: string (option.value)
- multipleChoice: string[] (option.value[])
- rating: number
- linearScale: number
- likertScale: string (selected label or option.value; recommendation: option.value if provided; fallback to label)
- date: string (ISO “YYYY-MM-DD”)
- dateRange: either string "YYYY-MM-DD to YYYY-MM-DD" or object { start: string; end: string }. Recommendation: keep string if that’s what the backend expects today; otherwise migrate to object across app with a single adapter.
- fileUpload: File (UI) → FileData (persistence). UI should support converting FileData → File for display.
- address: { street1, street2, city, stateProvince, postalCode, country }
- ranking: string[] (option.value ordered). If persistence needs JSON string, stringify at the edge.
- signature: SKIPPED (not in initial scope)
- likertMatrix: SKIPPED (not in initial scope)

Document any deviation during implementation and unify.

---

## 4. Phase Plan (Incremental)

### Phase 0 — Typeform: Introduce input switcher, correct mappings (no visual overhaul yet)

**Status: [DONE]** The `TypeFormQuestionInputSwitcher.tsx` has been created and is in use. It correctly maps most question types to their respective components, including specialized unified components.

Files:

- Add apps/formfiller/components/typeform/TypeFormQuestionInputSwitcher.tsx
- Edit apps/formfiller/components/typeform/TypeFormQuestion.tsx (replace InputContainer usage)

Tasks:

1.  **[DONE]** Implement TypeFormQuestionInputSwitcher.tsx: a small pure component returning the correct input for Typeform based on:
    - **[DONE]** text.format: "text" | "textarea" | "email" | "url" | "tel" | "number" | "password" | "country"
      - **[DONE]** tel → `UnifiedPhoneInput`
      - **[DONE]** country → `UnifiedCountrySelect`
      - **[DONE]** else → `TypeFormTextInput` with inputMode/autoComplete
    - **[DONE]** singleChoice/multipleChoice + display "radio" | "checkbox" | "dropdown" | "multiSelectDropdown"
      - **[DONE]** singleChoice → `TypeFormSingleSelect`
      - **[DONE]** multipleChoice → `UnifiedMultiSelect`
    - **[DONE]** rating → `UnifiedRating`
    - **[DONE]** linearScale → `TypeFormLinearScale`
    - **[DONE]** likertScale → `TypeFormLikert`
    - **[DONE]** date.format "date" | "dateRange" → `TypeFormDate`
    - **[DONE]** fileUpload → `UnifiedFileUpload`
    - **[DONE]** address → `TypeFormAddress`
    - **[DONE]** ranking → `TypeFormRanking`

2.  **[DONE]** Update TypeFormQuestion.tsx: replace <InputContainer ... /> with <TypeFormQuestionInputSwitcher ... />. Keep existing Continue button and validation flow.

3.  **[DONE]** Ensure full config passthrough for:
    - rating: min/max/step/minLabel/maxLabel
    - linearScale: start/end/step/startLabel/endLabel
    - date: date vs dateRange
    - fileUpload: allowedTypes, maxFiles, maxSize

Acceptance:

- **[DONE]** For provided JSON, likertScale shows labeled options (not 1..5 numbers).
- **[DONE]** linearScale 1–10 with startLabel; rating min/max/step respected.
- **[DONE]** Typeform Continue button correctly validates text formats (email/url/tel/number) before enabling.

### Phase 1 — Typeform wrappers (compose unified primitives, add Typeform chrome)

**Status: [DONE]** This is the current architecture. Unified primitives exist in `packages/ui/src/form/modes/unified` and are consumed by Typeform components. Thin wrappers are used where necessary.

Files (under apps/formfiller/components/typeform/):

- **[DONE]** Prefer unified primitives from @formlink/ui (UnifiedRating, UnifiedLinearScale, UnifiedDatePicker, UnifiedFileUpload, UnifiedMultiSelect) with mode="typeform" and CVA classes. Add thin Typeform wrappers only where extra chrome or onSubmit/Enter-hint behavior is required.
- **[DONE]** Country/Phone: consume shared primitives in packages/ui (UnifiedCountrySelect, UnifiedPhoneInput) across all modes. This has been implemented.

Shared contract:

- **[DONE]** Props: { value, onChange, onSubmit?, ...specificProps }
- **[IN PROGRESS]** Visuals: bigger size, Typeform layout conventions; hint “Press Enter to continue” handled by TypeFormQuestion (controller), not components.
- **[DONE]** Navigation: Components may call onSubmit() for convenience; TypeFormView still owns gating and actual navigation.

Component specifics:

- **[DONE]** TypeFormTextInput
- **[DONE]** TypeFormPhoneInput (via `UnifiedPhoneInput`)
- **[DONE]** TypeFormCountrySelect (via `UnifiedCountrySelect`)
- **[DONE]** TypeFormSelect (implemented as `TypeFormSingleSelect` and `UnifiedMultiSelect`)
- **[DONE]** TypeFormRating (via `UnifiedRating`)
- **[DONE]** TypeFormLinearScale
- **[DONE]** TypeFormLikert
- **[DONE]** TypeFormDate
- **[DONE]** TypeFormFileUpload (via `UnifiedFileUpload`)
- **[DONE]** TypeFormAddress
- **[DONE]** TypeFormRanking

Acceptance:

- **[IN PROGRESS]** Typeform UX feels cohesive: big controls, accessible focus, consistent padding/typography. Continue button logic works across types.

### Phase 2 — Chat and Classic mapping alignment (reuse primitives, minimal wrappers)

**Status: [IN PROGRESS]** Switchers for both modes exist, but they have not been updated to use the new `Unified` primitives from `packages/ui`. This is the next major area of work.

Chat:

- **[PENDING]** Edit apps/formfiller/components/chat/hooks/useQuestionRenderer.tsx to mirror mapping used in Typeform (formats/displays/likert). **Note:** Current hook is minimal and renders a generic `QuestionWrapper`.
- **[PENDING]** Add/update ChatPhoneInput.tsx, ChatCountrySelect.tsx, ChatLikert.tsx as needed, preferably by consuming `Unified` primitives.
- **[DONE]** Validation: soft while typing; errors on submit.

Classic:

- **[PENDING]** Edit apps/formfiller/components/classic/QuestionInputSwitcher.tsx to mirror mapping. **Note:** It has its own implementations and does not use the `Unified` primitives yet.
- **[PENDING]** Add ClassicPhoneInput.tsx, ClassicCountrySelect.tsx, ClassicLikert.tsx if missing.
- **[DONE]** Use ClassicFormField.tsx consistently (label, description, error).

Acceptance:

- **[PENDING]** All modes render correct controls for all current schema types; Classic maintains shadcn feel; Chat minimal and contextless.

### Phase 3 — QA & Cleanup

**Status: [IN PROGRESS]** A good testing foundation exists for primitives, but mode-specific components and stories are pending.

- **[PENDING]** Stories in apps/ui-docs for each component and both Typeform/Chat/Classic variants.
- **[IN PROGRESS]** Unit tests for keyboard interactions and a11y roles. **Note:** `packages/ui/src/form/primitives` has solid test coverage. Mode-specific components need more.
- **[PENDING]** Visual regression snapshots for critical states (focused, error, disabled).
- **[PENDING]** Remove leftover InputContainer usage in Typeform. Keep Chat/Classic using their switchers.
- **[DONE]** Defer matrix/signature to a later iteration.

---

## 5. Detailed Switch for TypeFormQuestionInputSwitcher.tsx

**Status: [DONE]** The implementation in `apps/formfiller/components/typeform/TypeFormQuestionInputSwitcher.tsx` closely follows this pseudo-code, using unified components where appropriate.

Pseudo-code:
...

---

## 6. Validation Mapping (Typeform gating, Chat post-submit, Classic inline)

**Status: [IN PROGRESS]** Typeform gating is functional. Chat and Classic validation logic is present but could be further aligned.

...

---

## 7. Accessibility & Keyboard

**Status: [IN PROGRESS]** Primitives have good a11y foundations. This needs to be verified and expanded upon in the mode-specific wrappers.

...

---

## 8. Testing Plan

**Status: [IN PROGRESS]** As noted in Phase 3, unit tests for primitives are in a good state. Integration and visual tests are the next step.

...

---

## 9. Rollout & Risk Management

**Status: [ON TRACK]** The project has followed this phased rollout successfully, with Typeform changes being well-isolated.

...

---

## 10. Immediate TODO (Phase 0)

- **[DONE]** Add TypeFormQuestionInputSwitcher.tsx with mapping outlined above.
- **[DONE]** Update TypeFormQuestion.tsx to use the switcher.
- **[DONE]** Ensure likertScale renders labeled options; remove any implicit mapping to linear.
- **[DONE]** Ensure text formats map to correct input props for Typeform.
- **[DONE]** Pass full config to rating/linear/date/file from question.
- **[DONE]** Define minimal coercers inside switcher or a small local util module.

...

---

## 11. Notes

**Status: [ADHERED TO]** The implementation has successfully followed these guiding principles.

...

---

## 12. Phase 1 — Detailed UX, Overflow, Validation, and Visual Plan

**Status: [IN PROGRESS]** Many of these detailed UX considerations are being actively worked on or are ready for implementation now that the core component structure is in place.

...
