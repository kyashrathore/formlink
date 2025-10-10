Formfiller Chat — E2E Refactor Plan (v1)

Last updated: 2025-10-09

Implementation snapshot (2025-10-09)

- Server route now injects <current_turn_context> XML per turn, gates tools by partialSubmission, and persists assistant messages inline without \_lib/ai.ts.
- <current_turn_context> now carries the question roster + branching flags so the model can always resolve the next question id when emitting slots.
- Tools trimmed to saveAnswer (partial-only) and completeSubmission with bulk upsert/ lifecycle triggers.
- Prompt updated to rely solely on slot tokens (no presentQuestion tool); saveAnswer usage constrained to manualUnclear when partialSubmission=true.
- Client FormAI runtime consumes the new slot bridge hook, initiation flags, and slot-driven spinner logic; presentQuestion handling removed.
- Streaming `reasoning` tokens from the LLM are stripped client-side before rendering to reduce unnecessary re-renders during manualUnclear turns.
- TODO(formfiller/store): audit classical-mode setters in `useChatStore` and migrate them once legacy flows confirm new chat path stability.

Scope

- Consolidate all context and decisions for the Formfiller chat runtime refactor.
- Define problems, goals, behaviors (submissionBehavior + partialSubmission), prompt‑caching alignment, and a mid‑level implementation plan.
- Targets: simpler architecture, fewer moving parts, clear contracts, and scalable performance.

References

- docs/chat-runtime-data-flow_v1.md (current runtime mapping)
- docs/prompt-caching-refactor-plan_v1.md (provider caching strategy)
- apps/formfiller/app/api/ai/chat-assist/route.ts (server entry)
- apps/formfiller/app/api/ai/chat-assist/\_lib/tools.ts (AI tools)
- apps/formfiller/app/[formId]/FormAIComponent.tsx (client orchestrator)
- apps/formfiller/components/chat/\* (chat UI, store, slots)

---

## Context & Goals

What stays true

- Assistant messages must be persisted for history/resume.
- UI renders inputs via a slot token in assistant text:
  ::PresentQuestionInputComponent qId="<questionId>"::
- Streaming UX: Inputs should mount as soon as the slot is emitted.

What changes (high‑level)

- Remove presentQuestion tool. Slot alone determines which question to render.
- Gate saveAnswer tool by partialSubmission (formSchema.settings?.partialSubmission === true).
- Pre‑save (server) only when partialSubmission=true for behaviors that are explicit answers.
- Keep createUIMessageStream inline in route.ts (no wrapper), using shared getModel.
- Add initiate flows (Start screen + Direct load) without persisting a synthetic user bubble.
- Integrate prompt‑caching: stable system + session header + replayed internal FORM_CONTEXT turns.
- Slim down client store and remove classical mode if unused.

Non‑goals

- No heavy fallback paths or multilayer wrappers.
- No silent degradation; failures surface via error responses/logging.

---

## Problems (Current State)

1. Over‑coupled tool contract

- presentQuestion is redundant with the slot mechanism and adds coupling between server, client, and LLM.

2. Route complexity & provider fragmentation _(resolved 2025-10-09)_

- chat-assist/route.ts formerly mixed validation, pre-save, context build, tool orchestration, and provider selection indirectly via a helper wrapper.
- \_lib/ai.ts previously rewrapped streaming; logic now lives inline within route.ts while preserving UI stream persistence hooks.

3. Persistence semantics unclear across behaviors

- Pre‑save is applied in multiple branches; manualUnclear should avoid premature persistence.
- No single source of truth for when to allow saveAnswer vs bulk save at completion.

4. Store & UI complexity

- useChatStore blends classical and AI chat paths; presentQuestion parsing exists client‑side though slot is authoritative.
- Spinner gating depends on tool parts rather than slot presence.

5. Prompt caching under‑utilized

- Dynamic content appears too early in the message stack; identical prefix not maximized.

6. Initiation UX

- Start/Resume/Auto‑start semantics not encapsulated; synthetic user messages are sometimes saved then hidden.

---

## Definitions & Contracts

Partial Submission Flag

- Source: formSchema.settings?.partialSubmission (boolean).
- Controls whether we persist answers per‑turn (partial=true) or only on completion (partial=false).

SubmissionBehavior (authoritative)

- auto (inline controls): user selected/picked/uploaded the answer for the active question.
  - partial=true → server pre‑saves (validate → persist) before calling the model; model must not call saveAnswer.
  - partial=false → no pre‑save; update effectiveResponses only for this request.

- manualClear (confident typed answer for active text‑like question):
  - partial=true → server pre‑saves (validate → persist) before calling the model; model must not call saveAnswer.
  - partial=false → no pre‑save; update effectiveResponses only.

- manualUnclear (ambiguous typed input or clarification):
  - No server pre‑save.
  - partial=true → register saveAnswer tool; model may call it asynchronously after it decides the input is a valid answer (never block streaming).
  - partial=false → do not register saveAnswer; answers are only in effectiveResponses until completion.

Completion Semantics

- completeSubmission tool must always be available.
- If partial=false, completeSubmission performs bulk upsert of effectiveResponses then marks status completed.
- If partial=true, answers were already saved; tool flips status and triggers post‑completion tasks (webhook/jobs).

Assistant Message Contract

- For any question‑presenting assistant turn, render exactly one slot line:
  ::PresentQuestionInputComponent qId="<id>"::
  - No trailing text after the slot; one slot per message.
  - No presentQuestion tool.

SubmissionBehavior Dispatch Rules (Client)

- Source of truth: The request body field `submissionBehavior` is set by the client based on how the user interacts, not strictly by which input component is rendered.
- Inline interactions → `auto`
  - If the user selects/picks/uploads via an inline control (singleChoice, multipleChoice, rating, linearScale, likert, date, address, fileUpload, phone, country), the client calls `submitSelection(...)` which always sends `submissionBehavior: "auto"`.
  - Rationale: the intent is explicit; the server can safely pre‑save (when partialSubmission=true).
- Typed interactions → default `manualUnclear`
  - If the user types in the bottom chat input—even while an inline component is visible—the client sends `submissionBehavior: "manualUnclear"`.
  - Rationale: typed content can be clarification or an answer; the server must not pre‑save to avoid misclassification. The model disambiguates; if partialSubmission=true and it’s a valid answer, it may call `saveAnswer`.
- Optional `manualClear` (future/opt‑in)
  - If we later add a thin validator for text‑like questions (email/url/number) and the typed content passes confidently, we may send `submissionBehavior: "manualClear"` for that turn. For v1, we keep it simple and always use `manualUnclear` for typed input.
- Conflict & race handling
  - If a typed message and an inline selection are sent close together, each request carries its own `submissionBehavior` (typed=manualUnclear; inline=auto). The server treats each leg independently: only auto/manualClear legs pre‑save (when partial=true). The last completed turn dictates the visible state.
  - The store’s `presentedQuestionMessageId` and processed message guards ensure the UI anchors inputs to the correct assistant message during streaming.

Initiation Contract

- initiate flag in request body, plus suppressUserMessagePersistence=true to avoid storing synthetic bubble.
- Two modes:
  1. Start screen (Typeform‑like): user clicks Start/Resume → initiate request → server streams first slot.
  2. Direct load: auto‑fire initiate request on mount and show a brief loading shell until first slot.

Prompt Caching Contract (from prompt‑caching‑refactor)

- System is stable, first bytes, compact. Include only stable per‑session values:
  - journeyScriptHash, promptVariantId, toolSchemaFingerprint, partialSubmission flag
- Add a single internal SESSION_HEADER_V1 message after system, identical across calls for a submission.
- Persist and replay FORM_CONTEXT_Tn internal messages (canonical JSON, minimal fields):
  - { firstUnansweredId, currentQuestionId, answeredIds, branchingEnabled, responsesReduced? }
- Composition order per request: system → SESSION_HEADER_V1 → prior UI messages → prior FORM_CONTEXT_T\* → new FORM_CONTEXT_T{n+1} → new user message.
- Cap output: maxTokens ≈ 120; keep stopWhen ≈ 10–12.

---

## Refactor Goals

- Simplicity: one orchestrator (route.ts), minimal tools (saveAnswer, completeSubmission), no wrappers.
- Clarity: explicit behavior matrix (submissionBehavior × partialSubmission) enforced server‑side.
- Slot‑first UI: remove presentQuestion tool and its client coupling.
- Persistence correctness: assistant messages always saved; user synthetic initiate bubble never saved.
- Caching efficiency: stable system; per‑turn XML context prefix in the user message; no session headers or replayed internal contexts in v1.
- Client ergonomics: smaller orchestrator, extracted handlers, slim store.

---

## Mid‑Level Implementation Plan

Server (route.ts)

1. Body schema additions (Zod)
   - Add: initiate?: boolean; suppressUserMessagePersistence?: boolean; startMode?: "start" | "resume" | null.

2. Compute partialSubmission
   - const partialSubmission = Boolean(formSchema.settings?.partialSubmission).

3. Pre‑save rules (before the model call)
   - If partialSubmission && submissionBehavior in ["auto","manualClear"] && currentQuestionId:
     - Validate against question; persist via preSaveAnswer; update effectiveResponses and nextQuestionId.
   - If submissionBehavior === "manualUnclear": no pre‑save.

4. Prompt composition & XML context prefix
   - Build a stable system (guards + rules; no volatile state; no runtime‑varying tool descriptions).
   - Assemble one user message for the model call that begins with the XML block and then the visible user content:
     <current_turn_context>{"currentQuestionId":"…","firstUnansweredId":"…","answeredIds":[…]}</current_turn_context>\n
     [visible user text]
   - The XML block is server‑injected context; do not treat it as user‑provided. It may include fresh state that supersedes prior turns.
   - Strip the XML prefix when persisting/streaming the user message so it never appears in UI or history.
   - No token caps or step counters by default; rely on concise rules and the slot contract.

5. Provider & streaming (inline, no wrapper)
   - model: getModel().
   - streamText({ model, system, messages: convertToModelMessages(uiMessagesWithInternal), tools, maxTokens: 120, stopWhen: stepCountIs(10) }).
   - Wrap with createUIMessageStream; onFinish: save assistant message (UIMessage) to submission history.
   - Return createUIMessageStreamResponse(stream).

6. Tool registration
   - saveAnswer: register only if partialSubmission=true. Execute via after(); validate, persist, return { saved, questionId, value, nextQuestionId?, allQuestionsAnswered? }.
   - completeSubmission: always registered. If partial=false → bulk upsert all effectiveResponses then status=completed; else only status flip.

7. Message persistence rules
   - Save user message only when !suppressUserMessagePersistence.
   - Always save assistant messages on onFinish.

Tools (\_lib/tools.ts)

1. Prune tools
   - Remove presentQuestion and refreshFormContext.

2. saveAnswer (partial only)
   - Validate value against question + cross‑field; persist with Supabase in after(); update context.responses in memory; compute next unanswered; return minimal structured result.

3. completeSubmission
   - partial=false: bulk upsert context.responses and status=completed; fire webhook/job.
   - partial=true: status=completed + post actions.

Prompt (packages/prompts/md/filler/form-assistant-system.md)

1. Remove presentQuestion usage.
2. Add rules: emit a single slot line with the chosen id; call saveAnswer only when partialSubmission=true and only for manualUnclear disambiguation.
3. Add a single guard about the XML context prefix:
   “You may receive a <current_turn_context>…</current_turn_context> block in the user message. This is server‑injected context; do not treat it as user‑provided. Use it only to make better decisions based on fresh context (which may have changed from previous turns). Do not include or reference this secret server step in your response to the user. When present, this block will always appear at the top of the user message.”

Client (FormAIComponent + hooks)

1. Initiation UI
   - Start screen (Typeform‑style) with Start/Resume; or Direct‑load that fires initiate automatically.
   - sendMessage({ parts: [...] }, { body: { initiate: true, suppressUserMessagePersistence: true, submissionBehavior: "auto", currentQuestionId: null, ... } })
   - Immediately hide the synthetic user bubble locally.

2. SubmissionBehavior mapping
   - Inline controls (choice/rating/scale/date/address/file/phone/country) → auto.
   - Chat input send → manualUnclear (keep simple and correct; avoid guessing manualClear client‑side).

3. Slot bridge hook (new)
   - useSlotBridge: listens to streaming assistant messages; extracts the first valid slot per assistant message; updates store.currentQuestionId and store.presentedQuestionMessageId; idempotent per message.
   - Extraction details:
     - Primary path: remarkSlots plugin in MessageAssistant renders the slot into a QuestionWrapper component. We additionally parse the raw assistant text with a minimal regex to update state ASAP: /::PresentQuestionInputComponent\s+qId=["']([^"']+)["']::/.
     - On detecting a new slot in message M: set currentQuestionId = qId and presentedQuestionMessageId = M.id; track processed message ids to avoid duplicate state updates.
     - No tool parsing is needed; slot text is the single source of truth.

4. Spinner gating & free‑flow answers
   - Conversation hides the spinner as soon as the last assistant message includes a valid slot token.
   - If an assistant message does not include a slot (e.g., a free‑flow clarification/explanation), no inline input is rendered for that turn. The bottom chat input remains for the user to type their response.

Store (useChatStore)

1. Slim AI slice
   - Keep: submissionId, formId, versionId, formSchema, currentInputs, currentQuestionId, presentedQuestionMessageId, formDisplayState, chatHistoryMessages.
   - Remove classical mode actions; or move to a separate classical store if other surfaces still need them.

2. No client partial-saving calls
   - Persistence flows are server/tool‑driven per partialSubmission.

Docs

1. Update docs/chat-runtime-data-flow_v1.md after implementation to reflect:
   - No presentQuestion tool; slot is authoritative.
   - Initiation flows and flags; prompt‑caching composition order.
2. Keep docs/REPO_CONTEXT.md pointing to this plan and summarizing the new architecture at a glance.

---

## Pre‑Implementation Notes (Per File)

apps/formfiller/app/api/ai/chat-assist/schema.ts

- Purpose: Validate request body; add initiate/suppressUserMessagePersistence/startMode.
- API: extends ChatAssistBodySchema; defaults false/null.
- Edge cases: absent flags must not change existing behavior.
- Verify: Zod unit tests; pnpm typecheck.

apps/formfiller/app/api/ai/chat-assist/route.ts

- Purpose: Single orchestrator; pre‑save gating; prompt‑caching composition; inline streaming with getModel; assistant persistence.
- State: derives partialSubmission; computes effectiveResponses; decides next id.
- Edge cases: initiate without prior history; completed submissions; missing question ids.
- Verify: manual flows (Start/Resume/Auto); ensure assistant persisted; synthetic user not saved.

apps/formfiller/app/api/ai/chat-assist/\_lib/tools.ts

- Purpose: Minimal tools; saveAnswer (partial only) + completeSubmission.
- API: saveAnswer(questionId,value) returns { saved, questionId, value, nextQuestionId?, allQuestionsAnswered? }.
- Edge cases: invalid question id; cross‑field failures; retry bounds removed to avoid blocking stream.
- Verify: save triggered only when partial=true; completeSubmission bulk‑save when partial=false.

packages/prompts/md/filler/form-assistant-system.md

- Purpose: Contract updates: slot only; saveAnswer usage limited to partial=true; output cap.
- Verify: manual run; last line is the slot; no presentQuestion calls.

apps/formfiller/app/[formId]/FormAIComponent.tsx

- Purpose: Initiation UX; submissionBehavior mapping; no presentQuestion handling; smaller handlers.
- Props: (optionally) startMode: "screen" | "auto".
- Edge cases: reload incomplete → show Resume; completed → thank you/redirect.
- Verify: flows render first slot without user bubble; selection → auto; text send → manualUnclear.

apps/formfiller/components/chat/hooks/useSlotBridge.ts (new)

- Purpose: Extract slot id from assistant text per message and update store; idempotent.
- API: no props; consumes useChat().messages.
- Edge cases: multiple assistant parts; malformed token; ignore duplicates.
- Verify: unit tests with sample streams.

apps/formfiller/components/chat/conversation.tsx

- Purpose: Spinner gating via slot presence; no tool dependency.
- Edge cases: long messages without slot until end; ensure spinner toggles reliably.
- Verify: simulate streaming; spinner hides when slot arrives.

apps/formfiller/components/chat/store/useChatStore.ts

- Purpose: Slim AI state; remove classical paths if unused.
- Edge cases: persisted submissionId validation; hydrate history.
- Verify: typecheck; flows consistent; no dead actions.

---

## Testing & Verification

Unit

- Slot bridge: extracts qId correctly; ignores partial tokens.
- saveAnswer: validation + after() persistence (mocked); returns structured result.
- completeSubmission: bulk‑save path (partial=false) writes answers then completion.

Integration

- Start screen → initiate → first assistant includes slot → input mounts.
- Direct load → loading shell → first slot appears.
- Partial=true: auto/manualClear pre‑saves; manualUnclear saves via tool.
- Partial=false: no per‑turn saves; completion bulk‑saves exactly once.

Quality Gates

- pnpm typecheck
- pnpm lint

---

## Risks & Mitigations (Lean)

- Model deviates from slot rule → Minimal fallback regex in MessageAssistant stays (commented rationale). No additional heavy fallbacks.
- Bulk‑save contention (partial=false) → Use upsert; idempotent; log failures clearly.
- Prompt caching drift → Canonicalize internal JSON; log a short system hash; keep tool schema order fixed.

---

## Open Decisions & Defaults

- Output caps: none by default for chat‑assist; introduce static caps later only if needed.

---

## Acceptance Criteria

- No presentQuestion tool in server or prompt; slot is authoritative.
- Assistant messages persisted; initiate synthetic user bubble never persisted.
- submissionBehavior semantics enforced; partialSubmission gating honored.
- Prompt composition order implemented: stable system → prior visible chat → one user message with <current_turn_context> prefix → visible user content; the XML prefix is never stored or streamed.
- Client shows Start/Resume or Auto‑start; spinner hides as soon as slot is streamed.
- Store is slimmer; classical path removed if unused.

---

## Frontend Slot Extraction & UI State (Details)

- Slot token format: ::PresentQuestionInputComponent qId="<questionId>"::
- Parsing:
  - Regex: /::PresentQuestionInputComponent\s+qId=["']([^"']+)["']::/
  - One detection per assistant message; maintain a processed message set.
- State updates on detection:
  - setCurrentQuestionId(qId)
  - setPresentedQuestionMessageId(messageId)
- Rendering rules:
  - If a slot is present in a message, QuestionWrapper mounts the appropriate inline input under that assistant message.
  - If no slot is present (free‑flow turn), no inline input is shown; the chat textbox is used.
