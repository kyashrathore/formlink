# @formlink/ui — Form Components Overview

Audience: App developers wiring forms to the headless runtime. Purpose: Quick reference for supported form components in `packages/ui/src/form` and how to compose them with the runtime.

Guiding rules

- Keep state in the runtime. Pass `value`, call `runtime.actions.set(qid, next)` on change, and use `context.get.visibleError(qid)` for errors.
- Wrap inputs in Field for Classic layouts: Field, Label, FieldDescription, FieldControl, FieldMessage.
- Prefer Unified\* components for cross‑mode parity. Use mode="typeform" for Typeform flows; omit or use list layout for Classic where applicable.

Unified inputs (primary)

- `UnifiedDropdownSelect`
  - Single‑select, searchable when options are large.
  - Props: `mode`, `options: {value,label}[]`, `value: string | null`, `onChange`, `placeholder`.
  - Classic example:
    ```tsx
    <Field>
      <Label htmlFor="q_cloud">Primary cloud</Label>
      <FieldControl>
        <UnifiedDropdownSelect
          options={cloudOptions}
          value={(runtime.context.get.value("q_cloud") as string) ?? null}
          onChange={(next) => runtime.actions.set("q_cloud", next)}
          placeholder="Select a cloud provider"
          mode="typeform"
        />
      </FieldControl>
      <FieldMessage>{runtime.context.get.visibleError("q_cloud")}</FieldMessage>
    </Field>
    ```

- `UnifiedDropdownMultiSelect`
  - Multi‑select with badge chips and popover search.
  - Props: `mode`, `options`, `value: string[]`, `onChange`, `onSubmit?`.

- `UnifiedMultiSelect`
  - Inline checklist (short lists), no dropdown chrome.
  - Props: `mode`, `options`, `value: string[]`, `onChange`, `onSubmit?`.

- `UnifiedDatePicker`
  - Date or date range; Typeform‑ready popover.
  - Props: `mode`, `value`, `onChange`, `range?: boolean`, `required?`.

- `UnifiedCountrySelect`
  - Searchable country selector with flag + name; width matches trigger.
  - Props: `mode`, `value: string | null` (ISO2), `onChange`, `onSubmit?`, `required?`, `density?`, `triggerClassName?`.

- `UnifiedPhoneInput`
  - E.164 formatting backed by `libphonenumber-js`.
  - Props: `mode`, `value: string`, `onChange`, `onSubmit?`, `countryISO2?`.

- `UnifiedRating`
  - Star/N scale input.
  - Props: `mode`, `value: number | null`, `onChange`, `max?`, `min?`, `step?`.

- `UnifiedLinearScale`
  - Linear 1..N scale with labels; keyboard and click friendly.
  - Props: `mode`, `value: number | null`, `onChange`, `config: { start, end, step, startLabel?, endLabel? }`.

- `UnifiedLikert`
  - Row of labeled options; single choice.
  - Props: `mode`, `options: string[]`, `value: string | null`, `onChange`.

- `UnifiedRanking`
  - Drag/drop reordering with keyboard fallback.
  - Props: `mode`, `options: {value,label}[]`, `value: string[]`, `onChange`.

- `UnifiedSignature`
  - Canvas signature capture; returns data URL or blob based on app logic.
  - Props: `mode`, `value?: string`, `onChange`.

- `UnifiedAddressInput`
  - Structured address fields (street/city/state/postal/country) with validation.
  - Props: `mode`, `value: AddressData`, `onChange`, `required?`.

- `UnifiedFileUpload`
  - File selection + upload for Classic/Typeform. Size/type checks and uploading indicator.
  - Props: `mode`, `onChange`, `onFileUpload?`, `allowedFileTypes?`, `maxFiles?`, `maxSize?`, `questionId?` (Typeform), `uploadedFile?`, `disabled?`.
  - Behavior:
    - Typeform mode: uses `questionId` + `onFileUpload(questionId, file)`; shows a loader during upload; shows errors for size/type rejections; long filenames wrap safely.
    - Classic/list mode: renders a list of selected files with previews and remove buttons.

Shared composition patterns

- Classic + Field
  - Always wrap inputs in `Field`. Use `FieldMessage` to display `context.get.visibleError(qid)`.

- InputGroup inside FieldControl
  - For adornments and inline actions:
    ```tsx
    <Field>
      <Label htmlFor="q_salary">Expected salary</Label>
      <FieldControl>
        <InputGroup>
          <InputGroupAddon align="inline-start">
            <InputGroupText>$</InputGroupText>
          </InputGroupAddon>
          <InputGroupInput id="q_salary" inputMode="numeric" />
          <InputGroupAddon align="inline-end">
            <InputGroupText>USD</InputGroupText>
          </InputGroupAddon>
        </InputGroup>
      </FieldControl>
    </Field>
    ```

Primitives (advanced)

- `form/primitives/useBaseFileUpload`
  - Exposes file validation and upload orchestration for list layouts: `addFiles`, `removeFile`, `uploadFile`, `uploadAll`, `retryUpload`, `errors`, `dropZoneProps`, `inputProps`.
  - Accepts `accept`, `maxSize`, `maxFiles`, `multiple`, `enableDragDrop`, `onUpload`.

- `form/primitives/useBaseRanking`
  - Core DnD logic for ranking questions; consumed by `UnifiedRanking`.

Modes and shared

- `form/modes/typeform`
  - Typeform‑mode scaffolding helpers and components tailored to one‑question‑at‑a‑time layouts.

- `form/modes/shared`
  - Building blocks used by multiple modes (buttons, hints, a11y utilities).

Recommendations

- Prefer `Unified*` components for inputs.
- Keep Classic field composition consistent: Field > Label/Description > FieldControl > Input/Group > FieldMessage.
- For large option sets, use dropdown variants; for short lists, prefer inline checklists.
