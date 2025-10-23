# Runtime Error Visibility Policy (v1)

Scope: `@formlink/runtime`

Goals

- Centralize when validation errors are revealed to the UI.
- Keep UI components dumb: render `context.get.visibleError(qid)` and wire events to runtime actions.

Modes

- Typeform (`uiMode: 'typeform'`, default)
  - Reveal: on `actions.next()` if the current field is invalid; on `actions.submit()` reveal all invalid fields.
  - Clear: on `actions.set(qid, value)` when the field validates cleanly.
- Classic (`uiMode: 'classic'`)
  - Reveal: on `actions.blur(qid)` if the field is invalid.
  - Clear: on `actions.set(qid, value)` when the field validates cleanly.
  - Note: `actions.next()` does not reveal errors in classic.

UI Contract

- Display: `const err = runtime.context.get.visibleError(qid)`; render when `err` is defined.
- Events: call `runtime.actions.set(qid, value)` on change; wire `onBlur={() => runtime.actions.blur(qid)}` for classic; call `runtime.actions.next()` for Typeform continue.

Verification

- Storybook examples in `apps/ui-docs` use the policy:
  - Typeform stories rely on `visibleError(currentId)` and `actions.next()`.
  - Classic story (`AirbnbAppSecApplication`) uses `uiMode: 'classic'`, wires `onBlur` to `actions.blur`, and renders `visibleError(qid)` inline per field.
