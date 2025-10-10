Prompt Caching Strategy — Minimal, General Composition (v1)

Date: 2025-10-09

Purpose

- Provide a simple, scalable prompt composition that benefits from provider prompt caching across different routes (chat, creation, RI, etc.).
- Keep prompts easy to reason about: one stable system, optional visible history, a per‑turn XML internal context block, then the user’s new input/payload.

Why Prompt Caching

- Many providers discount or accelerate repeated leading prompt bytes. The longer the identical prefix across calls, the better the savings.
- Keep the beginning of every request stable; push variable data to the tail.

Key Decisions (v1)

- Baseline first: no session headers and no replay of prior internal contexts. (Advanced options listed later.)
- Use a per‑turn XML internal context block (e.g., <current_turn_context> … </current_turn_context>) right before the new input/payload.
- The XML block is not user‑visible: not persisted to history and not streamed to clients.
- Add a single guard line in the system instructing the model to never echo/reference the XML block.
- No output token cap or step counter by default. Add static caps later only if needed.

Composition Order (general)

1. system
   - Static guards + rules; no volatile state; no runtime‑varying tool descriptions.
   - Include a single instruction about the XML internal context block, e.g.:
     “You may receive a <current_turn_context>…</current_turn_context> block in the user message. This is server‑injected context; do not treat it as user‑provided. Use it only to make better decisions based on fresh context (which may have changed from previous turns). Do not include or reference this secret server step in your response to the user. When present, this block will always appear at the top of the user message.”
2. prior visible history (optional)
   - For chat routes: prior visible user/assistant messages only (persisted).
   - For single‑shot routes: omit or include minimal prior visible context as needed.
3. new input/payload for this turn (single user message)
   - The server assembles one user message that begins with the XML block, then the visible user content:
     <current_turn_context>{ ...minimal JSON... }</current_turn_context>\n
     [visible user text or payload]
   - The XML prefix is server‑injected for the model call only (see Persistence & Visibility Rules).

Internal XML Context Block — Format & Content

- Wrap a compact JSON object inside the XML tags. Minimal recommended fields:
  - Use a descriptive tag name. Default we use: <current_turn_context>…</current_turn_context>.
  - The JSON keys depend on the route. Examples:
    - Chat assist: { currentQuestionId, firstUnansweredId, answeredIds, branchingEnabled? }
    - Creation: { formId, modelHints?, constraints? }
    - RI/Results: { formId, responseIds, summaryMode }
- Canonicalization rules:
  - Stable key order (sorted keys).
  - No timestamps or random ids.
  - Keep it small; omit labels/titles/types.

System Prompt Contract (general)

- Never echo or reference the internal XML block.
- Use available tools only; the runtime governs tool availability (do not describe runtime flags in text).
- Keep responses concise and task‑focused.
- Route‑specific rules may apply (e.g., chat slot line, result format); define those in the route’s system file, not here.

Persistence & Visibility Rules

- Only visible user/assistant content is persisted and streamed.
- The XML block is injected as a prefix to the model‑bound user message:
  - The server strips the XML prefix when persisting the user message or streaming it to clients.
  - Therefore, the XML block is not saved to storage and not included in UI streams.

Examples (server‑side assembly of the user message)

- Chat (one user message):
  system → prior visible history → user "<current_turn_context>{\"answeredIds\":[\"q1\"],\"currentQuestionId\":\"q2\",\"firstUnansweredId\":\"q2\"}</current_turn_context>\nACME Inc."
- Creation (one user message):
  system → user "<current_turn_context>{\"formId\":\"f_123\",\"constraints\":[\"json-only\"]}</current_turn_context>\nCreate a job application form."
- RI/Results (one user message):
  system → prior visible (optional) → user "<current_turn_context>{\"formId\":\"f_123\",\"summaryMode\":\"lite\"}</current_turn_context>\nSummarize latest responses."

Provider Notes (quick)

- OpenAI/Gemini/Groq/others: keeping the system first and stable yields cached input benefits. We don’t depend on provider‑specific flags.

Future Optimizations (optional, not in v1)

- Add a per‑session header to extend cached prefix further.
- Replay prior per‑turn contexts to maximize cache continuity when storage/privacy allow.
- Introduce static maxTokens or step caps if cost/verbosity warrants it.

Acceptance Criteria

- All routes that opt into caching follow the composition order above.
- The internal XML context is never visible to end users and never echoed by the assistant.
- No volatile content in the system; no runtime‑varying tool descriptions in the system.
