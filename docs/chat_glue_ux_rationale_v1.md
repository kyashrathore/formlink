# Chat Glue UX — Rationale and Next Steps (v1)

Scope: Document the UX choices used in `apps/ui-docs/stories/ChatGlueRealBackend.stories.tsx` and call out the key improvement (single‑column left alignment with a boxed chat and attached bottom prompt), the current rough edge (layout jerk when a slot/input disappears), and concrete refinements. This is a compare‑and‑contrast against the app implementation in `apps/formfiller/app/[formId]/FormAIComponent.tsx`.

## Summary

- Single‑column, left‑aligned messages for both roles improves scanning, rhythm, and reduces eye travel vs split left/right bubbles.
- A bordered “chat canvas” makes full‑width answer controls (selects/inputs) feel natural instead of floating in the page.
- An attached‑to‑bottom prompt keeps attention on the current turn, mirroring modern chat UIs and minimizing context loss.
- Larger, prominent input sections focus the user on “the one thing to do now”; right/left alternation competes for attention and feels less cohesive.

## Current Implementation (pointers)

- Story uses a single column conversation with both roles rendered in the same flow inside a bordered container:
  - `apps/ui-docs/stories/ChatGlueRealBackend.stories.tsx:564`
  - Message map + assistant/user rendering: `apps/ui-docs/stories/ChatGlueRealBackend.stories.tsx:565`
  - Bottom‑attached prompt (within the same visual box): `apps/ui-docs/stories/ChatGlueRealBackend.stories.tsx:640`
- Formfiller app also attaches the prompt to bottom (fixed over page, with blur), useful as reference for motion/animation wrappers:
  - Fixed bottom input wrapper: `apps/formfiller/app/[formId]/FormAIComponent.tsx:670`

## Why This Feels Better

- Consistent alignment: Keeping both assistant and user left‑aligned avoids the z‑pattern scan. The eye tracks downward, not sideways.
- Cohesive stage: A single bordered canvas makes embedded answer controls (dropdowns, multiselects, file uploads) feel like part of the chat, not page chrome.
- Anchored focus: The bottom prompt is always where the action ends; attaching it to the chat box keeps continuity between last message and the next action.
- Emphasis on “now”: Larger controls for the active question make it clear what to do next; split bubbles dilute focus.

## UX Issue: Layout Jerk on Selection

Observed: Selecting an option (e.g., `InlineSelect`/`UnifiedDropdown*`) commits the answer and the input section vanishes immediately. The bottom prompt then shifts upward as the message list reflows. This feels like a “jerk” because the active control collapses to zero height instantly.

Repro (story): interact with the last assistant slot control and select an option; once committed, note the immediate collapse and scroll jump.

Root cause: the slot component is conditionally rendered within the last assistant message; when the answer is submitted, that subtree unmounts without an exit transition.

## Targeted Fix: Smooth Slot Teardown

Design goal: Preserve spatial continuity when an input control completes so the canvas does not jump. Options below are incremental (pick one to land v1 quickly):

1. Height collapse transition (fastest)

- Wrap the slot region (inside the last assistant message) with a container that animates height from measured content height → a small min‑height instead of unmounting immediately.
- Exit duration: 180–220ms, easing: `ease-out`. Keep a transient `min-h-[56px]` placeholder to stabilize the bottom area while the next messages stream.
- Where to implement: around the slot renderer inside the assistant block:
  - Assistant block: `apps/ui-docs/stories/ChatGlueRealBackend.stories.tsx:596`
  - The slot is rendered by `ChatMessageAssistant` (from `@formlink/runtime/ui/react`). If editing the runtime is heavy, add a wrapper in the story (or app) that provides the animated container and defers unmount until after the animation completes.

2. Crossfade to AnswerSummary chip (slightly richer)

- On submit, replace the full control with a compact “Your answer: …” chip in place for ~300–500ms, then render the persisted user message. This creates object permanence and avoids the sudden gap.
- Use `framer-motion` `AnimatePresence` with `layout` or a CSS `height` transition; ensure the user message appears at the same y‑position.

3. Reserved prompt rail (structural guard)

- Give the bottom prompt a constant rail with `min-h` so its baseline doesn’t move when the last message height changes. This can be combined with (1) or (2) for belt‑and‑suspenders stability.

Implementation notes

- If `ChatMessageAssistant` is uneditable, wrap it in an animated container and delay unmount using a local “completed” state that flips after the animation timeout.
- Ensure `ConversationScrollButton` logic remains correct when the last block animates: it should not auto‑scroll the user away during exit.

## Additional Refinements

- Mute older messages
  - Reduce contrast on messages older than the last N (e.g., last 3 remain full contrast). Example style: `text-muted-foreground/60` + `bg-muted/30`.
  - Apply in the `messages.map` loop with an index threshold: `apps/ui-docs/stories/ChatGlueRealBackend.stories.tsx:565`.

- Role labels → icons
  - Replace the literal `assistant`/`user` text header with small icons (e.g., `Bot`, `UserCircle2` from `lucide-react`), keeping labels for screen readers.
  - Pointer where labels render: `apps/ui-docs/stories/ChatGlueRealBackend.stories.tsx:589` and `apps/ui-docs/stories/ChatGlueRealBackend.stories.tsx:618`.

- Reading rhythm for long answers
  - Add `prose` defaults for `Response` blocks and comfortable `leading-[1.5]`; keep `max-w-3xl` container already present: `apps/ui-docs/stories/ChatGlueRealBackend.stories.tsx:557`.

- Keyboard affordances
  - Keep Enter → submit, Shift+Enter → newline (already implemented for textarea inputs); reflect hint text consistently.

## Verification

- Manual pass
  - Rapidly select options in consecutive questions; confirm no perceived jump and that the bottom prompt baseline stays visually stable.
  - Toggle between long text entry (textarea) and single‑select; verify scroll‑to‑bottom controls don’t fight the animation.

- Regressions to watch
  - Auto‑scroll should not yank the viewport during exit transitions.
  - Screen reader labels for the control → summary handoff must remain accurate.

- CI hygiene
  - `pnpm typecheck` and `pnpm lint` must pass; the animation wrapper should not introduce unused imports or implicit `any`.

## Actionable TODOs

- [ ] Implement animated slot teardown (height collapse) around the assistant slot control.
- [ ] Optionally add an in‑place AnswerSummary chip for 300–500ms before the user message renders.
- [ ] Replace role text headers with icons + aria‑labels.
- [ ] Apply muted styles to older messages beyond the last 3.
- [ ] Validate on mobile widths and high zoom (≥125%).

## Appendix: Compare vs FormAIComponent

- The app’s `FormAIComponent` already uses a fixed bottom prompt with motion wrappers:
  - Fixed rail: `apps/formfiller/app/[formId]/FormAIComponent.tsx:670`
- Borrow the same motion pattern (`AnimatePresence`/`motion.div`) for slot exit in the story (and later in the shared runtime component) to remove layout jerk while preserving the left‑aligned, boxed chat.

---

Pre‑Implementation Note (for this doc file)

- Purpose: Capture current UX rationale and specify minimal, high‑impact fixes.
- API/props: N/A (documentation only).
- States: N/A.
- Edge cases: Ensure guidance covers both inline controls and dropdown/multiselect inputs.
- Verification method: Manual UX checks described above; type/lint passes.
