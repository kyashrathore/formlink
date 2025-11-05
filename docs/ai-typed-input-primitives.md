# AI Typed Input Primitives — Implementation Guide

Goal

- Move the “typed input + chat framing” logic from ui-docs into reusable primitives in `@formlink/runtime` so any chat UI can add submit‑time validation, a phone country selector, and bottom‑anchored layout with minimal code.

Scope

- Headless utilities (no UI deps)
- Lightweight React UI components that bind to ShadCnProvider primitives in runtime
- Clear, copy‑pastable docs and examples

Primitives

1. Headless utilities (no UI deps)

- File (proposed): `packages/runtime/src/headless/ai/input-intent.ts`
- Exports:
  - `detectInputIntent(text): IntentResult`
  - types: `InputIntent = 'tel' | 'email' | 'url' | 'number'`; `IntentResult`
  - helpers: `extractDialCode(text)`
- Notes: strict email detection (RFC‑ish), URL via `URL()`, number with grouping, tel via `libphonenumber-js`. Return `confidence`, `valid`, `normalized`, `country`, `dialCode`.

2. Submit gate (headless)

- File (proposed): `packages/runtime/src/headless/ai/useSubmitGate.ts`
- `useSubmitGate({ expectedFormat, value, confidence = 0.9 })` → `{ canSubmit, block, reason, detection, onAttempt() }`
- Centralizes “submit‑time high‑confidence invalid” logic.

3. Phone country selector (runtime UI)

- File (proposed): `packages/runtime/src/ui/react/ai/PhoneCountrySelector.tsx`
- Props: `{ value, onValueChange, countries = buildCountryOptions(), triggerVariant?, maxHeight?, onDialChange? }`
- Behavior:
  - Controlled HoverCard/Popover + Command search
  - Filter by country name or +code
  - Caret‑preserving dial‑code replacement in the bound textarea
  - Keyboard accessible

4. Prompt input typed assist (runtime UI)

- Name: `PromptInputTypedAssist` (matches `@ai-elements` PromptInput\* naming)
- File (proposed): `packages/runtime/src/ui/react/ai/PromptInputTypedAssist.tsx`
- Props: `{ expectedFormat: 'tel'|'email'|'url'|'number'|null, value, onValueChange, showError, confidenceThreshold = 0.9, alwaysShowTelSelector = true }`
- Behavior:
  - Tel: always render `PhoneCountrySelector` (selector first), add compact error when `showError`
  - Email/URL/Number: render compact inline error when `showError`
  - No UI if `expectedFormat` is null

5. Debug (dev‑only)

- File (proposed): `packages/runtime/src/ui/react/ai/TypedIntentDebugCard.tsx`
- Props: `{ show, expectedFormat, detection, isIntentMatch, isHighConfidenceInvalid, showValidation, threshold }`
- Renders nothing when `show=false`; for Storybook/dev.

Integration (apps/ui-docs → runtime)

- Replace local `TypedAssist` with `PromptInputTypedAssist` + `PhoneCountrySelector`
- Use `useSubmitGate` in onSubmit; block and reveal header assist when invalid
- Keep DebugCard behind a boolean

Proposed APIs (draft)

- `detectInputIntent(text: string): IntentResult`

```
IntentResult {
  intent: 'tel'|'email'|'url'|'number'|null,
  confidence: number, // 0..1
  valid: boolean | null,
  normalized?: string,
  country?: string | null,
  dialCode?: string | null,
  reason?: string
}
```

- `submitGate` (pure helper)

```
const { canSubmit, block, reason, detection, onAttempt } = submitGate({
  expectedFormat: 'email',
  value: input,
  confidence: 0.9,
});

function onSubmit() {
  if (block) { /* show header assist, disable submit */ return; }
  // proceed
}
```

- `PhoneCountrySelector`

```
<PhoneCountrySelector
  value={value}
  onValueChange={setValue}
  countries={buildCountryOptions()}
/>
```

- `PromptInputTypedAssist`

```
<PromptInputTypedAssist
  expectedFormat={currentFormat}
  value={input}
  onValueChange={setInput}
  showError={showValidation}
  confidenceThreshold={0.9}
/>
```

Bottom anchoring (example‑only)

Use `100svh` heights on your scroll container to prevent body scroll and keep content anchored to the bottom. Example:

```
<Conversation className="border rounded-md rounded-b-none">
  <ConversationContent
    className={[
      "flex flex-col justify-end",
      started
        ? "h-[calc(100svh-64px)] lg:h-[calc(100svh-148px)]"
        : "h-[calc(100svh-8px)] lg:h-[calc(100svh-42px)]",
    ].join(" ")}
  >
    {/* messages or start card */}
  </ConversationContent>
</Conversation>
```

Notes:

- Two variants are typically needed:
  - With prompt visible: subtract the footer reserve (header + input + bottom gap).
  - Start page only: subtract just the page padding.
- Prefer `100svh` over `100vh` to avoid mobile browser chrome shifts.

A11y & QA

- HoverCard/Popover must be controlled when used for interactive search; hold open while input or list is focused
- Ensure Command input and list are keyboard accessible
- Provide aria-live for streaming status (“Thinking…”) and proper roles on selectors

Exports & Packaging

- Re-export in `packages/runtime/src/ui/react/index.ts` and headless index
- Keep runtime UI wired to ShadCnProvider primitives to stay portable across hosts

Migration notes

- Replace ad hoc detection + header/error logic with `submitGate` + `PromptInputTypedAssist`
- Swap any bespoke tel selectors with `PhoneCountrySelector` (caret‑preserving dial updates)

Acceptance

- Add Storybook demos for each primitive
- Add unit tests for `detectInputIntent`
- Docs published and linked from REPO_CONTEXT
