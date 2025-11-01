---
title: "Design & UX Guidelines"
description: "Practical guidance for Classic and Typeform modes: required labels, validation UX, component choices, placeholders, and layout patterns."
---

# Design & UX Guidelines

Scope

- Applies to `UniversalClassic` (multi-step) and `UniversalTypeform` (one-by-one) UIs.
- Complements the normative mapping tables; focuses on UX choices and structure.

Required fields

- Label must indicate required: add `*` or `(required)` in the label text.
- Set `validations.required` on the question schema; the runtime enforces it.
- Show errors on continue/submit: call `rt.actions.validate(qId)` and block advance until valid.
- For phone and email, rely on component validation and prevent invalid submit.

Components to prefer

- Phone: `UnifiedPhoneInput` (mode: `classic` or `typeform` as appropriate).
- Date: `UnifiedDatePicker`.
- File: `UnifiedFileUpload` (use `onFileUpload` → `await rt.actions.upload()` → `rt.actions.set()`).
- Single choice: `InlineSelect` (≤5 options), `UnifiedDropdownSelect` (>5).
- Multiple choice: `InlineMultiSelect` (≤5 options), `UnifiedDropdownMultiSelect` (>5).

Placeholders & affordances

- Email: `placeholder="name@company.com"`.
- URL: `placeholder="https://example.com"`.
- Phone: use country-aware input; avoid free-text `text`.
- Date: show format via the picker UI; avoid free-text `YYYY-MM-DD` inputs.

Classic mode specifics

- Keep labels concise; include help text for constraints (e.g., size limits for files).
- Use a summary/confirmation step only when needed; don’t duplicate validations.

Layout best practices

- Runtime initialization should occur once at the page level; avoid re-creating on every render.
- Place `RuntimeProvider` and `ShadCnProvider` high in the tree; keep Devtools at the page root (not inside the card) so it can shift the whole page when opened.
- If rendering the form inside a card, ensure Devtools panel is a sibling to that card, not a child.
- Import runtime CSS once in the app entry/root layout.

Setup (must-do)

- Install: `pnpm add @formlink/runtime`.
- Provide shadcn primitives via `ShadCnProvider components={...}` (see Pitfall: ShadCnProvider missing primitives).
- Confirm your UI exports needed primitives from a single place (e.g., `@/components/ui`).

References

- Normative mapping: [Runtime Codegen Specification](formlink-runtime-spec_v1_normative_only)
- Examples: [Universal Classic](examples/universal-classic), [Universal Typeform](examples/universal-typeform)
