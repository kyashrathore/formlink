# Formfiller: Mode-First Form Components Refactor Plan (Skip Matrix & Signature Initially)

Author: Staff Frontend Architect  
Scope: apps/formfiller (mode-owned components), reuse @formlink/ui primitives where possible  
Non-goals: New question types (likertMatrix, signature) in first iterations

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

Files:

- Add apps/formfiller/components/typeform/TypeFormQuestionInputSwitcher.tsx
- Edit apps/formfiller/components/typeform/TypeFormQuestion.tsx (replace InputContainer usage)

Tasks:

1. Implement TypeFormQuestionInputSwitcher.tsx: a small pure component returning the correct input for Typeform based on:
   - text.format: "text" | "textarea" | "email" | "url" | "tel" | "number" | "password" | "country"
     - tel → TypeFormPhoneInput
     - country → TypeFormCountrySelect
     - else → TypeFormTextInput with inputMode/autoComplete
   - singleChoice/multipleChoice + display "radio" | "checkbox" | "dropdown" | "multiSelectDropdown"
     - singleChoice → TypeFormSelect(multiple=false, display)
     - multipleChoice → TypeFormSelect(multiple=true, display)
   - rating → TypeFormRating (min,max,step,minLabel?,maxLabel?)
   - linearScale → TypeFormLinearScale (start,end,step,startLabel?,endLabel?)
   - likertScale → TypeFormLikert (options: string[]). IMPORTANT: do NOT map to linear.
   - date.format "date" | "dateRange" → TypeFormDate
   - fileUpload → TypeFormFileUpload (enforce validations: allowedTypes, maxFiles, maxSize)
   - address → TypeFormAddress
   - ranking → TypeFormRanking

2. Update TypeFormQuestion.tsx: replace <InputContainer ... /> with <TypeFormQuestionInputSwitcher ... />. Keep existing Continue button and validation flow.

3. Ensure full config passthrough for:
   - rating: min/max/step/minLabel/maxLabel
   - linearScale: start/end/step/startLabel/endLabel
   - date: date vs dateRange
   - fileUpload: allowedTypes, maxFiles, maxSize

Acceptance:

- For provided JSON, likertScale shows labeled options (not 1..5 numbers).
- linearScale 1–10 with startLabel; rating min/max/step respected.
- Typeform Continue button correctly validates text formats (email/url/tel/number) before enabling.

### Phase 1 — Typeform components (compose primitives, add Typeform chrome)

Files (under apps/formfiller/components/typeform/):

- Add/adjust: TypeFormTextInput.tsx, TypeFormPhoneInput.tsx, TypeFormCountrySelect.tsx, TypeFormSelect.tsx, TypeFormRating.tsx, TypeFormLinearScale.tsx, TypeFormLikert.tsx, TypeFormDate.tsx, TypeFormFileUpload.tsx, TypeFormAddress.tsx, TypeFormRanking.tsx

Shared contract:

- Props: { value, onChange, onSubmit?, ...specificProps }
- Visuals: bigger size, Typeform layout conventions; hint “Press Enter to continue” handled by TypeFormQuestion (controller), not components.
- Navigation: Components may call onSubmit() for convenience; TypeFormView still owns gating and actual navigation.

Component specifics:

- TypeFormTextInput
  - Map format → input type, inputMode, autoComplete; textarea when format === "textarea"; number: soft parsing (maintain string to parent)
  - Show inline hints (not blocking); respect min/maxLength/pattern
- TypeFormPhoneInput
  - Use BaseTextInput with tel type + simple digit mask; display country code hint optionally; validation: digit count >= 7
- TypeFormCountrySelect
  - Searchable dropdown; returns ISO code string; keyboard up/down + Enter
- TypeFormSelect
  - display=radio/checkbox: big tiles; display=dropdown/multi: popover select; ensure keyboard navigation and space/enter select
- TypeFormRating
  - Render star or pill; show min/max labels; numeric keys 1..N select; left/right arrows adjust
- TypeFormLinearScale
  - Discrete ticks; start/end labels; numeric shortcuts; left/right arrows
- TypeFormLikert
  - Horizontal labeled radio group; never numeric-only; arrows to move focus/selection
- TypeFormDate
  - format "date" or "dateRange"; popover calendar; string value contract; no Date objects out of the component
- TypeFormFileUpload
  - Enforce allowedTypes/maxFiles/maxSize; drag-drop; preview; remove/reset
- TypeFormAddress
  - Grouped fields; country typeahead; tab order safe
- TypeFormRanking
  - Drag handles and keyboard reorder (up/down); return array of values (parent may stringify if needed)

Acceptance:

- Typeform UX feels cohesive: big controls, accessible focus, consistent padding/typography. Continue button logic works across types.

### Phase 2 — Chat and Classic mapping alignment (reuse primitives, minimal wrappers)

Chat:

- Edit apps/formfiller/components/chat/hooks/useQuestionRenderer.tsx to mirror mapping used in Typeform (formats/displays/likert).
- Add/update ChatPhoneInput.tsx, ChatCountrySelect.tsx, ChatLikert.tsx as needed.
- Validation: soft while typing; errors on submit.

Classic:

- Edit apps/formfiller/components/classic/QuestionInputSwitcher.tsx to mirror mapping.
- Add ClassicPhoneInput.tsx, ClassicCountrySelect.tsx, ClassicLikert.tsx if missing.
- Use ClassicFormField.tsx consistently (label, description, error).

Acceptance:

- All modes render correct controls for all current schema types; Classic maintains shadcn feel; Chat minimal and contextless.

### Phase 3 — QA & Cleanup

- Stories in apps/ui-docs for each component and both Typeform/Chat/Classic variants.
- Unit tests for keyboard interactions and a11y roles.
- Visual regression snapshots for critical states (focused, error, disabled).
- Remove leftover InputContainer usage in Typeform. Keep Chat/Classic using their switchers.
- Defer matrix/signature to a later iteration.

---

## 5. Detailed Switch for TypeFormQuestionInputSwitcher.tsx

Pseudo-code:

```tsx
export default function TypeFormQuestionInputSwitcher(props: {
  question: Question;
  response: QuestionResponse;
  onAnswer: (value: QuestionResponse) => void;
  onFileUpload?: (qId: string, file: File) => Promise<void>;
  uploadedFile?: File | null;
  onFileSelect?: (f: File | null) => void;
  onNext?: () => void;
}) {
  const { question, response, onAnswer, ...rest } = props;
  const t = question.type.name;

  if (t === "text") {
    const f = question.type.format;
    if (f === "tel")
      return (
        <TypeFormPhoneInput
          value={toString(response)}
          onChange={onAnswer}
          {...rest}
        />
      );
    if (f === "country")
      return (
        <TypeFormCountrySelect
          value={toString(response)}
          onChange={onAnswer}
          {...rest}
        />
      );
    return (
      <TypeFormTextInput
        format={f}
        value={toString(response)}
        onChange={onAnswer}
        {...rest}
      />
    );
  }

  if (t === "singleChoice") {
    const d = question.type.display;
    return (
      <TypeFormSelect
        multiple={false}
        display={d}
        options={question.type.options}
        value={toString(response)}
        onChange={onAnswer}
        {...rest}
      />
    );
  }

  if (t === "multipleChoice") {
    const d = question.type.display;
    return (
      <TypeFormSelect
        multiple
        display={d}
        options={question.type.options}
        value={toStringArray(response)}
        onChange={onAnswer}
        {...rest}
      />
    );
  }

  if (t === "rating") {
    const cfg = question.type.config;
    return (
      <TypeFormRating
        min={cfg.min}
        max={cfg.max}
        step={cfg.step}
        minLabel={cfg.minLabel}
        maxLabel={cfg.maxLabel}
        value={toNumber(response)}
        onChange={onAnswer}
        {...rest}
      />
    );
  }

  if (t === "linearScale") {
    const cfg = question.type.config;
    return (
      <TypeFormLinearScale
        start={cfg.start}
        end={cfg.end}
        step={cfg.step}
        startLabel={cfg.startLabel}
        endLabel={cfg.endLabel}
        value={toNumber(response)}
        onChange={onAnswer}
        {...rest}
      />
    );
  }

  if (t === "likertScale") {
    return (
      <TypeFormLikert
        options={question.type.options}
        value={toString(response)}
        onChange={onAnswer}
        {...rest}
      />
    );
  }

  if (t === "date") {
    const isRange = question.type.format === "dateRange";
    return (
      <TypeFormDate
        range={isRange}
        value={toDateValue(response, isRange)}
        onChange={onAnswer}
        {...rest}
      />
    );
  }

  if (t === "fileUpload") {
    const v = question.validations || {};
    return (
      <TypeFormFileUpload
        allowedTypes={v.allowedTypes?.value}
        maxFiles={v.maxFiles?.value}
        maxSize={v.maxSize?.value}
        value={toFileList(response)}
        onChange={onAnswer}
        {...rest}
      />
    );
  }

  if (t === "address") {
    return (
      <TypeFormAddress
        value={toAddress(response)}
        onChange={onAnswer}
        {...rest}
      />
    );
  }

  if (t === "ranking") {
    return (
      <TypeFormRanking
        options={question.type.options}
        value={toStringArray(response)}
        onChange={onAnswer}
        {...rest}
      />
    );
  }

  return null;
}
```

Helper coercers (inlined or local utils):

- `toString`, `toStringArray`, `toNumber`, `toDateValue`, `toAddress`, `toFileList`.

---

## 6. Validation Mapping (Typeform gating, Chat post-submit, Classic inline)

Common rules from schema (`question.validations`):

- required: boolean
- minLength / maxLength / pattern (text)
- minSelections / maxSelections (multi)
- minDate / maxDate (date)
- maxSize / allowedTypes / maxFiles (file)

Typeform:

- Components show soft hints only (e.g. invalid email pattern shows a message but doesn’t own blocking).
- Continue button disables when invalid:
  - For text: apply required/min/max length/pattern; use default format checks (email/url/tel/number) when pattern absent.
  - Non-text: presence of response unless specific constraints exist (e.g., multi needs at least one selection when required).
- Auto-advance: only for ["singleChoice", "rating", "linearScale", "likertScale"] when `submissionBehavior=autoAnswer`.

Chat:

- Validation primarily after submit (display error messages inline); allow soft real-time hints without blocking.

Classic:

- On blur/change; summary on submit; errors appear under each field.

---

## 7. Accessibility & Keyboard

Roles and patterns:

- SingleChoice & Likert: radiogroup, options radio; arrows move between options; Space/Enter selects.
- MultipleChoice (checkbox groups): group/fieldset/legend; Space toggles; Tab moves.
- Linear/Rating: slider semantics or roving-array with aria-pressed; arrows adjust; number keys jump.
- Date: proper labeling; Esc closes popover; arrows navigate days; PageUp/PageDown for months (if supported).
- LikertMatrix: SKIPPED initially.
- Combobox (searchable selects): role=combobox; listbox; activeDescendant management.
- File: button to open dialog, list of files as list with remove buttons.

---

## 8. Testing Plan

Unit tests (Vitest/RTL):

- TypeFormTextInput: validates email/url/tel/number; char counter behavior.
- TypeFormSelect: keyboard navigation (arrows, space/enter), selection states.
- TypeFormRating/LinearScale: min/max/labels, arrow and numeric shortcuts.
- TypeFormLikert: labeled options, radiogroup semantics.
- TypeFormDate: date vs dateRange; value contract; Esc/arrow nav.
- TypeFormFileUpload: allowedTypes/maxFiles/maxSize enforcement.
- TypeFormPhone/Country: basic validation and selection.

Integration tests:

- TypeFormView: Continue disabled until valid; Enter key triggers continue; scroll-up goes to previous; corner arrows work; auto-advance for eligible types.

Visual snapshots:

- Each component in focused/error/disabled states for light/dark modes.

---

## 9. Rollout & Risk Management

- Deliver in small PRs aligned with phases. Each PR targets one area (TypeForm switch + likert/text formats; then Typeform Linear/Rating; then Phone/Country; then Date/File; then Chat; then Classic).
- Feature-guard new behaviors if needed, but aim to keep changes localized to Typeform switch during Phase 0 to avoid wide regressions.
- Maintain InputContainer untouched for Chat/Classic until those phases begin; in Typeform, fully replace it in TypeFormQuestion.

---

## 10. Immediate TODO (Phase 0)

- [ ] Add TypeFormQuestionInputSwitcher.tsx with mapping outlined above.
- [ ] Update TypeFormQuestion.tsx to use the switcher.
- [ ] Ensure likertScale renders labeled options; remove any implicit mapping to linear.
- [ ] Ensure text formats map to correct input props for Typeform.
- [ ] Pass full config to rating/linear/date/file from question.
- [ ] Define minimal coercers inside switcher or a small local util module.

Acceptance Criteria for Phase 0 using provided JSON:

- Q1 (linearScale 1..10 startLabel): renders 1..10 with label at start; selection enables Continue (or auto-advance if configured).
- Q2 (rating 1..5 with minLabel): properly constrained; labels visible.
- Q3 (likertScale options): shows labeled options; selection enables Continue/auto-advance.
- Q4/Q5 (singleChoice/multipleChoice): display variant respected.
- Q11 (dateRange): two-ended selection, stable value contract.
- Q12 (fileUpload): validations wired (do not accept disallowed type or oversize); successful upload advances when configured.
- Q13–Q20 (text formats): email/url/password/tel/number/textarea/country behave semantically with correct keyboard and validation.

---

## 11. Notes

- Do not introduce a new theming layer; use shadcn tokens directly.
- Keep imports top-level. Remove dead code instead of commenting.
- Use motion/react for small transitions; respect reduced motion.
- If a type ambiguity arises, halt and clarify—no guesses.

---

## 12. Phase 1 — Detailed UX, Overflow, Validation, and Visual Plan

This section adds concrete, implementation-ready details for Phase 1 specific to:

- Overflow and safe-area handling (including corner arrow overlap)
- “Typeform-like but our own taste” visual rules
- Placeholders, validation, error messages, and descriptions

A) Layout, Overflow, and Safe Areas

- Viewport and Safe Areas
  - Use dynamic viewport height for mobile: 100dvh instead of h-screen.
  - Add bottom padding to the content area: padding-bottom = navigation height + env(safe-area-inset-bottom).
  - TypeFormNavigation: sticky/fixed at bottom with z-index above content. Ensure only buttons receive pointer events; avoid blocking content beneath.
- Scroll Management
  - The content container (that wraps the question input) uses overflow-y: auto and overscroll-behavior: contain.
  - On focus or significant value change, if input is not fully visible within the container, scroll it into view with element.scrollIntoView({ block: "center", behavior: "smooth" }). Guard for reduced motion.
  - When textarea auto-grows, use ResizeObserver to re-center within the container.
- Popovers/Overlays (select dropdowns, date pickers, etc.)
  - Use floating-ui (flip, shift, and size restriction) to guarantee fit within viewport and avoid clipping behind navigation.
  - Cap popover/menu height at min(60vh, availableHeight). Always render via a portal whose stacking is above navigation (e.g., z-40).
  - Close on Escape, trap focus while open, and restore focus to trigger on close.
- Right-Corner Arrow Overlap (desktop)
  - Reserve an interaction-safe area by padding the content inline-end equal to the corner navigation footprint; or layer the navigation with minimal clickable footprint and pointer-events discipline.
  - Z-index hierarchy: popover/overlays > navigation > controls. Tiles and dropdowns must not be obscured or become unclickable beneath the nav.
- Acceptance for Overflow
  - Popovers never clip behind navigation; they flip/shift when near edges.
  - Long lists (multi-select, ranking) scroll internally; Continue/arrow nav remain clickable.
  - Ranking with many items fits within the panel; keyboard reordering works without page jumping.
  - Mobile safe-area respected; navigation does not cover inputs.

B) “Typeform-like, our own taste”

- No custom token layer. Use shadcn tokens and Tailwind/CVA variants (tf-control) to express size/density and state.
- Layout rhythm: large controls (default size=lg), consistent paddings, max input rail width around 640–720px for readability.
- Tiles for radio/checkbox: prominent, subtle elevation (shadow-sm), clear selected state with brand-accented ring and background.
- Typography: Title strong and legible; description subdued and readable line-length; helper text and errors use system tokens.
- Micro-interactions via motion/react only; subtle opacity/scale; honor reduced motion.

C) Placeholders, Description, Errors, and Validation

- Placeholders (default mapping; schema can override via question.placeholder)
  - text: “Type your answer”
  - textarea: “Type your answer”
  - email: “name@example.com”
  - url: “https://example.com”
  - tel: “(555) 123-4567”
  - number: “Enter a number”
  - password: “Enter your password”
  - country: “Search country…”
  - singleChoice (dropdown): “Select an option”
  - multipleChoice (multi-select dropdown): “Select one or more”
  - rating: “Choose a rating”
  - linearScale: “Choose a value”
  - likert: no placeholder (labels visible)
  - date: “YYYY-MM-DD”
  - dateRange: “YYYY-MM-DD to YYYY-MM-DD”
  - fileUpload: “Drag and drop or click to upload”
  - address: “Start typing your address”
  - ranking: no placeholder (visible items render)
- Description and Required Indicator
  - Render description below title with muted foreground. Append a required asterisk in the title when validations.required.
  - Wire aria-describedby from the input to include description id and error id.
- Errors: controller-owned gating, component soft hints
  - Components display soft hints (e.g., char counters, pattern hints) but do not block navigation themselves.
  - TypeFormQuestion/TypeFormView remains the single source of truth for validity. Errors appear in an aria-live="polite" region below the control.
  - Default error messages (English for Phase 1):
    - required: “This field is required”
    - email/url/tel/number defaults: “Enter a valid …”
    - minLength/maxLength: “Must be at least X characters” / “Must be X or fewer characters”
    - pattern: “Answer format is invalid”
    - multi min/max selections: “Select at least X” / “Select no more than X”
    - date constraints: “Date must be on/after …” / “on/before …”
    - file constraints: “File type not allowed”, “Max X files”, “File exceeds size limit”
  - i18n may follow later; keep strings in a small mapping utility.

D) Shared Props and ARIA

- CommonProps<T> for Typeform components: { value: T; onChange: (v: T) => void; onSubmit?: () => void; disabled?; readOnly?; autoFocus?; id?; ariaDescribedBy?; placeholder?; className? }.
- Components accept ariaDescribedBy and set aria-invalid when the controller flags an error. Controls reference description and error ids via aria-describedby.

E) Code Touchpoints (based on current code)

- TypeFormLayout: switch to 100dvh, add safe-area and bottom padding for navigation; ensure content scroll container uses overflow-y: auto and overscroll-behavior: contain.
- TypeFormNavigation: keep bottom overlays with higher z-index and correct pointer-events; maintain mobile full-width bar and desktop corner arrows, but reserve content padding-inline-end to avoid overlap.
- TypeFormQuestion:
  - Render required indicator in title, description consistently, and a dedicated aria-live="polite" error region.
  - Pass placeholder to inputs using mapping above, falling back to schema override if provided.
  - Plumb ariaDescribedBy ids into the input components.
- TypeFormQuestionInputSwitcher:
  - Continue to pass configs from question for rating/linear/date/file. Use placeholder mapping when schema.placeholder is empty.
  - For Phase 1, replace country/tel fallbacks with TypeFormCountrySelect and TypeFormPhoneInput.
- TypeFormView:
  - Keep gating and auto-advance logic unchanged; leverage the new error region for consistent messaging.

F) Phase 1 Acceptance Additions

- Popovers (select/date) never render off-screen or beneath navigation; flipping and size restriction verified on desktop and mobile.
- Long option lists and ranking use internal scroll; navigation buttons remain clickable and visible.
- Placeholders appear correctly per type unless overridden by schema.
- Description and required indicator render consistently; when invalid, error appears in aria-live region and is read by screen readers.
- Keyboard shortcuts and numeric selection remain functional for rating/linear/likert; reduced motion respected.

G) PR Breakdown (refined)

- PR1: Layout updates (100dvh, safe-area, padding), Question meta (title/desc/error region, required), placeholders utility, Phone + Country base components wired minimally.
- PR2: Select variants (radio/checkbox/drops), popover overflow handling, keyboard navigation tests.
- PR3: Likert + Rating + LinearScale with numeric shortcuts and radiogroup/slider semantics.
- PR4: Date (single + range) with flip/shift/size and string value contract.
- PR5: FileUpload (constraints, previews, client-side filtering).
- PR6: Address + Ranking with internal scroll and keyboard reordering.

H) Risks and Mitigations

- Value contract drift: strict typing at switcher boundary, emit exact types (no Date objects escaping components).
- File accept ambiguity (mime vs extension): implement helper matching both; reject invalid before emitting.
- Keyboard regressions: cover with RTL tests; align patterns across groups.
- Performance on large lists: Phase 1 caps height; consider virtualization later if warranted.
