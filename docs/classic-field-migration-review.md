# Classic Mode Field Migration Review

_Last updated: October 9, 2025_

## Scope

- Audit of "classic" renderer inputs across `apps/formfiller` and supporting primitives in `packages/ui`.
- Gap analysis for adopting the shadcn `Field` primitives (`Field`, `FieldLabel`, `FieldDescription`, `FieldGroup`, `FieldLegend`, `FieldSet`, `FieldSeparator`, `FieldMessage`).
- Recommendations for migrating legacy `FormItem`-style wrappers and custom widgets to the new Field API without breaking RHF wiring or accessibility guarantees.

## Package Inventory

- `apps/formfiller/components/classic`
  - `ClassicFormView.tsx`: top-level RHF orchestrator, computes question schema, paging, and calls `ClassicFormField` per question.
  - `ClassicFormField.tsx`: RHF `Controller` wrapper that renders labels, descriptions, validation helper text, and routes rendering to `QuestionInputSwitcher`.
  - `QuestionInputSwitcher.tsx`: multiplexer over question types; imports `Input`, `Select`, `Checkbox`, `RadioGroup`, `Textarea`, `DatePickerWrapper`, `FileUploadInput`, `RankingInput`, `RatingSlider`, `AddressInput`.
  - Widget helpers: `AddressInput.tsx`, `DatePickerWrapper.tsx`, `FileUploadInput.tsx`, `RankingInput.tsx`, `RatingSlider.tsx`.
- `packages/ui`
  - `src/ui/form.tsx`: exposes RHF-aware primitives (`FormField`, `FormItem`, `FormControl`, etc.).
  - `src/ui/input.tsx`, `select.tsx`, `checkbox.tsx`, `radio-group.tsx`, `textarea.tsx`: current shadcn inputs consumed by classic mode.
  - Missing: no `field.tsx` implementation/export for shadcn Field pattern.

## Key Findings

1. **Missing shared Field primitives** – need `packages/ui/src/ui/field.tsx` plus exports in `packages/ui/src/index.ts` so apps consume canonical Field components instead of bespoke snippets.
2. **`ClassicFormField` semantics drift** – still relies on `FormItem/FormLabel` stack; must migrate to `<Field>` wrappers and align required/error helpers with `FieldDescription`/`FieldMessage` contexts.
3. **Controller prop forwarding gaps** – `QuestionInputSwitcher` rarely forwards `fieldProps.onBlur`, `aria` ids, or `ref` to primitives, meaning Field `htmlFor` + touched state will be inconsistent post-migration.
4. **Widget accessibility debt** – address, ranking, rating, date, and file inputs render their own labels/tooltips; they need optional Field context ids so `FieldDescription`/`FieldLegend` drive `aria-describedby` rather than duplicating labels.
5. **Docs drift** – `docs/REPO_CONTEXT.md` still documents `FormItem` usage for classic mode, so Field migration requires documentation updates to prevent regressions.

## Migration Recommendations

- **Introduce Field primitives** (`packages/ui/src/ui/field.tsx`): port the shadcn API verbatim, ensure contexts provide `fieldId`, `descriptionId`, `messageId`, `orientation`, and `required` booleans. Export via `packages/ui/src/index.ts` and create a smoke Story in UI docs.
- **Refactor `ClassicFormField.tsx`**:
  - Wrap `FormField` render output with `<Field>`; replace `FormLabel` with `<FieldLabel>` and `FormDescription` with `<FieldDescription>`.
  - Map validation/helper arrays to either `FieldDescription` children or a dedicated `<FieldMessage>` list for multi-line contexts.
  - Pass Field context ids (`fieldId`, `descriptionId`) to `QuestionInputSwitcher` for nested controls.
- **Normalize `QuestionInputSwitcher.tsx`**:
  - Define `attachFieldHandlers(control, fieldProps)` helper to spread `name`, `onBlur`, and `id` onto inputs/selects.
  - Ensure list-rendered controls (radio/checkbox/select) use deterministic ids derived from Field context (e.g., `${fieldId}--${option.value}`) instead of inline string math.
  - For custom controls (rating, ranking, file upload, date picker), plumb Field context ids through props to support `aria-describedby`.
- **Widget updates**:
  - `AddressInput`: accept `fieldId`, `descriptionId`, `messageId`; remove inline `Label` duplication when Field supplies label; expose controlled value updates only.
  - `DatePickerWrapper`: accept `triggerId` prop (defaults to Field id) and set `aria-expanded`, `aria-controls` for the popover content.
  - `FileUploadInput`: expose `inputId` prop and ensure drag-drop zone references Field context.
  - `RankingInput`/`RatingSlider`: move static label/placeholder constants to upper-scope constants (`FIELD_LABELS`, etc.) to satisfy lint rule on top-level constants.
- **Docs/Storybook**:
  - Add `docs/classic-field-migration-review.md` (this file) and cross-link from `docs/REPO_CONTEXT.md` via TODO.
  - Create a classic form Storybook story demonstrating Field usage after migration for regression coverage.

## TODOs

- [ ] `TODO(classic-field-migration): Update docs/REPO_CONTEXT.md after Field primitives ship.`
- [ ] `TODO(classic-field-migration): Add Storybook coverage for classic Field permutations (text, select, file, ranking).`
- [ ] `TODO(classic-field-migration): Write unit smoke tests for packages/ui Field contexts (ids, aria attributes).`

## Verification Plan

1. `pnpm lint`
2. `pnpm typecheck`
3. Manual classic preview in `apps/formfiller` (ensure `pnpm run dev` already running) focusing on required validation, dropdown/select toggles, file upload, ranking reorder.
4. Optional Storybook regression in `apps/ui-docs` once Field primitives land.

## Risk Log

- Changing DOM structure for ranking/file widgets may break `@dnd-kit` sensors—validate drag handles after Field refactor.
- Phone/number input sanitization currently relies on `Input` event values; confirm new `Field` wrappers do not intercept `onChange` semantics.
- Field context adds new provider components; watch bundle size and tree-shaking when bundling `@formlink/ui` consumers.
