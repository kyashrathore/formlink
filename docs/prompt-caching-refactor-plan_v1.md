contract:prompt-caching-refactor:v1 (2025-09-28)

# Prompt Caching Refactor Plan — Stable Systems, Cheap Calls

How Prompt Caching Works

- Providers discount or accelerate the repeated leading prefix of a request if it is byte‑for‑byte identical to a recent prior request. Anything after the first difference is billed normally.
- The shared prefix must be first in the request (system and any stable headers before history and dynamic context). Inserting new content above the prefix shrinks the cacheable region.
- Caches are short‑lived (minutes; provider‑specific). Long gaps can drop the cache; the next call re‑establishes it.
- Provider behavior (high level):
  - OpenAI/Gemini/Groq: long, identical prefix (often ≥ ~1k tokens) triggers cached‑input pricing; no special flags required.
  - Anthropic: requires marking cacheable inputs with cache_control; usage reports cache reads.
  - OpenRouter: passes through upstream rules; switching upstream models breaks continuity.

Techniques To Use It Efficiently

- Keep the system prompt compact and identical across calls. Include only per‑session values that never change (e.g., journeyScriptHash), not volatile state.
- Persist and replay internal context messages:
  - Store every internal context you send (e.g., `FORM_CONTEXT:{...}`) with `is_internal=true` and a canonical, stable stringify (sorted keys, no timestamps, no random IDs).
  - On subsequent calls, replay those internal context messages in the same order so the identical prefix extends up to the last previous turn.
  - Add a single per‑session header (e.g., `SESSION_HEADER_V1:{ formId, formVersionId, journeyScriptHash, promptVariantId, toolSchemaFingerprint }`) after the system and replay it every call.
- Keep the dynamic tail small: Put per‑turn state (currentQuestionId, answeredIds) at the end; cap outputs (e.g., 120 tokens); prefer tool‑first behavior.
- Canonicalize static text and tool schemas: fixed ordering and wording; avoid per‑request rewording or whitespace diffs.
- Prune carefully: If you trim history, never remove the session header or earlier turns you want cached; pruning from the head shortens the cacheable prefix.

Alternatives (and Pros/Cons)

- System‑only stability (don’t persist internal context)
  - Pros: simplest; zero storage.
  - Cons: only the system caches; smaller savings.
- System + stable session header (persisted once)
  - Pros: low complexity; larger prefix than system‑only.
  - Cons: still no caching of per‑turn contexts.
- Full transcript replay (persist UI + internal context)
  - Pros: maximum cached prefix and savings.
  - Cons: storage overhead; privacy/redaction; strict canonicalization required.
- Deterministic rebuild instead of storage
  - Pros: avoids storing internal context.
  - Cons: fragile; any serialization drift breaks the cache.

Goals

- Support 10k submissions and 100 forms per account per month without degrading UX.
- Keep a system prompt in every call, but make it stable and cache‑friendly.
- Reduce token spend by moving changing data into user/prompt while preserving behavior.

Key Principles

- Stable system first: The identical “static prefix” must be the first bytes of every request.
- Move only truly variable data out of system; keep stable per‑session values inside to grow the cached prefix.
- Canonicalize tool/function schemas (stable order, text) and avoid per‑request rewording.
- Keep dynamic context compact and last; cap outputs.

Provider Prompt Caching Facts (summary)

- OpenAI: Automatic cached input when the repeated prefix ≥ ~1,024 tokens; discount applies to cached tokens; cache window minutes (≤ ~1h). Inspect via usage.prompt_tokens_details.cached_tokens.
- Anthropic (Claude): Explicit Input Cache; mark cacheable messages with cache_control; usage exposes cache_read_input_tokens.
- Google Gemini: Caches long, repeated instruction prefixes; thresholds vary (Flash ~1k, Pro higher). Cached counts in usage.
- Groq: Discounted cached prompt tokens; stable leading prefix applies.
- OpenRouter: Passes through upstream behaviors/discounts; keep prefix stable; model switching breaks continuity.

Targets

- Chat assist (turns ≥ 2) system: ≤ 200 tokens (or a compact, stable contract + guards).
- Non‑chat branching system: ≤ 250 tokens (already close).
- Creation metadata system: ≤ 1,200 tokens.
- RI and result systems: ≤ 400–600 tokens.
- Output cap for chat: 120 tokens.

Audit — Where Systems Vary and What To Do

Safe As‑Is (keep as is)

- Non‑chat Branching: apps/formfiller/app/api/ai/branching/\_shared.ts
  - System is static (filler/branching-system.md). Dynamic context lives in user prompt.

Keep Stable Per‑Session Value Inside System

- Chat Assist: apps/formfiller/app/api/ai/chat-assist/route.ts
  - Keep journeyScript inside system (stable for a submission). Do not inject changing values (currentQuestionId, answeredIds) into system; send them in user message (FORM_CONTEXT).
  - Persist & replay: Save one internal `SESSION_HEADER_V1` per submission and a `FORM_CONTEXT_T{n}` per turn (canonical JSON, is_internal=true). On each new call, replay them before sending new content so the prefix extends to the last identical message.

Make System Static; Move Dynamic to Prompt/User Message

- Creation Chat Orchestration: apps/formcraft/app/api/chat/handlers/form-creation.ts
  - System: chat/form-creation-system.md → static only (include_guards true).
  - Move session_form_id, session_intent, ri_requested to a user message.

- Creation Workflow (Metadata): apps/formcraft/app/lib/chat/tools/generate-metadata.ts
  - System: form/enhanced-metadata.md → static.
  - Pass { userInput } via prompt (stringified); not in system.

- Creation Workflow (Question): apps/formcraft/app/lib/chat/tools/generate-question.ts
  - System: form/question-schema.md → static.
  - Pass per-question details via prompt JSON.

- Responses Page (Text Summaries): apps/formcraft/app/api/responses/route.ts
  - System: ri/summary-system.md → static.
  - Pass { rows, questions, angles, context } via prompt JSON.

- Synthetic Data Generator: apps/formcraft/app/api/responses/generate/route.ts
  - System: responses/data-generation-rules.md → static.
  - Pass normalized questions via prompt JSON.

- Response Intelligence (RI) Builder: apps/formcraft/app/lib/chat/tools/response-intelligence/prompt.ts
  - System: ri/ri-system.md → static.
  - Pass available_actions_text, flags, ids, plans, hints via prompt JSON.

- Generic AI Ops API: apps/formcraft/app/api/ai/route.ts
  - Systems (ai/\*.md) → static. Move user_prompt, questions, currentQuestionId, form_details into prompt JSON.

- Lifecycle Orchestrator Tools: apps/formcraft/app/lib/intel/submission-job/orchestrator.ts
  - Tool systems (intel/tool\_\*.md) → static. Pass answers/sidecar via prompt JSON.

- Action Schema Suggestion: apps/formcraft/app/api/actions/schema/route.ts
  - System static. Pass { slug, tool_schema, questions } via prompt JSON.

- Blog Visual Generator: apps/formcraft/app/blog/[slug]/generateSvgVisual.tsx
  - System static. Pass { title, description } via prompt.

New Prompt Variants (add, don’t replace)

- packages/prompts/md/filler/form-assistant-contract_v1.md
  - 150–200 tokens; tool‑first rules (saveAnswer/presentQuestion/completeSubmission), completion rule, brevity, JSON hygiene.

- packages/prompts/md/form/enhanced-metadata-lite_v1.md
  - ≤ 1,200 tokens; same schema/journeyScript constraints; trimmed narrative.

- packages/prompts/md/ri/ri-system-lite_v1.md
  - ≤ 600 tokens; section checklist and constraints only.

- packages/prompts/md/responses/data-generation-rules-lite_v1.md
  - ≤ 400 tokens; short deterministic result-page guidance.

Composition Order (every request)

1. system (static, identical text; includes guards + tools + stable per‑session items like journeyScriptHash)
2. session header (internal, identical every call): `SESSION_HEADER_V1:{...}`
3. prior history: UI‑visible user/assistant messages (persisted)
4. prior internal contexts: `FORM_CONTEXT_T1`, `FORM_CONTEXT_T2`, … (persisted)
5. new internal context for this turn: `FORM_CONTEXT_T{n+1}`
6. new user message

Serialization Rules

- Tools/functions: fixed order; stable text; avoid per‑request re-descriptions.
- FORM_CONTEXT: ids/flags + answeredIds only; omit labels/titles/types.
- No timestamps/hashes/random content in system.
- Canonicalize internal JSON (sorted keys, fixed spacing); use hashes for large blobs.

Provider‑Specific Notes

- OpenAI/Gemini/Groq: rely on stable prefix ≥ threshold; keep it first; inspect cached token usage in response.
- Anthropic: mark the system message with cache_control for input cache; inspect cache_read_input_tokens.
- OpenRouter: keep model fixed per session; switching upstream invalidates cache continuity.

Verification & Telemetry

- Log a short hash of final system string per route; ensure it’s constant across successive calls in a session.
- Record provider usage cached token fields where exposed.
- Label each call with prompt_variant (full|contract|lite) and provider/model.
- Weekly review: cache hit rates, avg cached tokens, cost per route/mode.

Worked Example (growing cached prefix)

- Call 1: [system][SESSION_HEADER][user1][FORM_CONTEXT_T1]
- Call 2: [system][SESSION_HEADER][user1][FORM_CONTEXT_T1][assistant1][user2][FORM_CONTEXT_T2]
  - Cache covers the identical prefix up to FORM_CONTEXT_T1.
- Call 3: [system][SESSION_HEADER][user1][FORM_CONTEXT_T1][assistant1][user2][FORM_CONTEXT_T2][assistant2][user3][FORM_CONTEXT_T3]
  - Cache covers the identical prefix up to FORM_CONTEXT_T2.

Rollout Plan

1. Chat‑assist: keep journeyScript in system; add contract_v1 for turns ≥ 2; cap outputs at 120 tokens; trim FORM_CONTEXT.
2. Creation: switch metadata to static system + prompt JSON; keep question system static; use repair only on failure.
3. RI/Results: swap to static/lite systems; dynamic in prompt; cap outputs.
4. Branching: keep tiny static system; call model only on ambiguity; else deterministic next question.
5. Add telemetry and system-hash logging; validate cached token counters.

Acceptance Criteria

- System hash per route/session stays identical across successive calls.
- Cached token counters > 0 on second call within TTL for providers that expose them.
- Chat submissions: input tokens per submission drop significantly while behavior is unchanged.
- Non‑chat linear submissions: zero model calls during fill.

Open Decisions

- Chat output cap: 120 vs 160–200 tokens.
- Whether to ship lite variants immediately or after establishing baseline with static originals.
