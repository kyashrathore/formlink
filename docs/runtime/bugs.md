7. [fixed] Date input is unstyled — `UnifiedDatePicker` now renders a typeform‑style bottom‑border control; if `Calendar` is provided via `ShadCnProvider`, it uses a shadcn calendar popover.
8. [fixed] File upload error — Expected object, received string — Helium story now stores the FileDescriptor returned by `runtime.actions.upload` (object with `url/name/size`), matching the runtime schema.
9. [fixed] No swipe/scroll to move question — Added mobile swipe (left/right) handlers in `TypeFormNavigation`.
10. [fixed] Hard to reach bottom‑right; add left/right arrow keys — Global arrow key navigation wired in `TypeFormNavigation`.
11. [fixed] Auto‑advance delay (select, rating, etc.) — Inline components delay 150ms before advancing so selection is visible.
12. [pending] Linear scale autofocus and focus styling — Current demo uses `@formlink/ui/UnifiedLinearScale`. Port or adapt a runtime `LinearScale` for full parity.
13. [fixed] Date calendar (shadcn) — If host provides `Calendar` + `Popover*`, `UnifiedDatePicker` uses the shadcn calendar popover.
14. [fixed] Country select doesn’t focus — `UnifiedCountrySelect` defaults to focusing the trigger in typeform mode (without auto‑opening).
15. [verified] Signature — `InlineSignature` captures to data URL; clear works; value flows through runtime schema (string).
