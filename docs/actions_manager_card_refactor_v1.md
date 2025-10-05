# ActionsManagerCard Refactor (v1)

Date: 2025-10-06

## Purpose

Unify actions rendering/management and remove coupling to AI `plan` objects. `ActionsManagerCard` now accepts a plain `actions[]` list of proposed items and merges them with configured actions from lifecycle config (or active view in view mode).

## Touched Files

- apps/formcraft/app/dashboard/forms/[formId]/components/responses/ActionsManagerCard.tsx
- apps/formcraft/app/dashboard/forms/[formId]/components/responses/SubmissionAutomationsCard.tsx
- apps/formcraft/app/dashboard/forms/[formId]/components/responses/ResponseViewPlan/index.tsx

## New API

```
<ActionsManagerCard
  formId={formId}
  mode="lifecycle" | "view"
  actions?: Array<{ slug: string; provider: "usesend" | "composio"; params?: Record<string, unknown> }>
/>
```

Notes:

- `actions` is treated as proposed-only and filtered against configured slugs.
- In `view` mode, configured actions are read from the active response view store.
- In `lifecycle` mode, configured actions come from `useAutomationsConfig(formId)`.

## State & Behavior

- Internal state: `pendingSlug` (add menu), `openSlug` (setup drawer).
- Add removes duplicates and persists to either lifecycle config or active view (creating new view if needed).
- Remove updates the relevant store/config and persists via API when needed.
- Setup drawer drives auth/params; in `lifecycle` mode, `onSaveParams` persists via `syncAllowedActions`.

## Edge Cases

- Missing provider: defaults to `"composio"`.
- Empty `actions`: renders only configured items; shows “No actions yet” when union is empty.
- Auth state unknown: shows `Needs auth` until tools refresh.

## Verification

1. Typecheck: `pnpm typecheck` (repo root) — ensure no TS errors from prop changes.
2. Lint: `pnpm lint` — verify import paths and unused symbols.
3. Runtime: with `pnpm run dev` already running
   - Open a form’s Responses → open Automations drawer.
   - Confirm header select still adds to lifecycle config.
   - Confirm `ActionsManagerCard` shows configured items and any proposed items passed in.
   - Click `Setup` → drawer opens and persists params.
   - Remove action → disappears and persists.

## TODO

- De-duplicate “Add action” controls if UX requires a single entry-point.
- Wire any additional plan sources to pass `actions[]` directly.
