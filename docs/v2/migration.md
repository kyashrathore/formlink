# FormLink AI SDK v4 → v5 Migration: Troubleshooting Log and Manual Fixes

This document records all issues encountered after running the AI SDK v5 codemod and the manual fixes applied across the codebase. It serves as a living post‑migration playbook for developers and a reference for future migrations.

Contents:

- 1. Context and Objectives
- 2. Symptoms and Errors Observed
- 3. Backend Streaming Architecture (AI SDK v5)
- 4. Frontend Chat Integration (AI SDK v5)
- 5. Custom Data Events and Tool Invocation Cards
- 6. Message Persistence and Formats
- 7. Question Generation Failures: Root Cause and Attempts
- 8. Provider Strategy and Initialization Plan
- 9. Type/Schema Fixes
- 10. Testing Protocols
- 11. File Change Log (by path)
- 12. Open Items / Decisions

---

## 1) Context and Objectives

- We migrated from AI SDK v4 to v5 using the codemod.
- The codebase uses custom SSE data events for real‑time form generation and tool progress cards.
- Goal: restore end‑to‑end streaming, tool cards rendering, and live form generation (questions created and previewed) while aligning to v5 APIs and types.

---

## 2) Symptoms and Errors Observed

- Stream parsing errors and malformed SSE:
  - “Failed to parse stream string. No separator found”
  - “[object Object][object Object]” chunks
- Frontend not receiving custom events; progress cards missing.
- TypeScript API mismatch in `useChat` (v5):
  - No `streamData` or `data` field; incorrect `endpoint` option; `append` renamed to `sendMessage`.
- Tool card parts not rendering (v5 types changed to ToolUIPart/DynamicToolUIPart).
- Server logs on question generation (critical):
  - OpenRouter/Azure response_format JSON Schema validation failures (HTTP 400):
    - “Invalid schema for response_format 'response': ... Missing 'minLabel' ... in context ('properties', 'type', 'anyOf', '2', 'properties', 'config')”
  - Flow ends with: “No questions were successfully generated.”

---

## 3) Backend Streaming Architecture (AI SDK v5)

Replaced v4 data stream pattern with v5 UI message stream:

Before (v4-ish):

```ts
return createDataStreamResponse({
  execute: async (dataStream) => {
    // ...
    result.mergeIntoUIMessageStream(dataStream);
  },
});
```

After (v5):

```ts
const stream = createUIMessageStream({
  execute: async ({ writer }) => {
    // Emit custom data events (must use data-* types)
    // Example: chat initialized
    writer.write({ type: 'data-chat_initialized' })

    // Stream model output
    const result = await streamText({
      model: MODEL,
      messages: convertToModelMessages(messages),
      tools,
      system: contextualSystemPrompt,
      // streaming hooks…
      onFinish: async (...) => {
        // persist assistant message; emit completion
        writer.write({ type: 'data-chat_completed' })
      },
      onError: async (err) => { /* persist and log */ }
    })

    writer.merge(result.toUIMessageStream())
  },
  onError: (error) =>
    error instanceof Error ? error.message : String(error),
})

return createUIMessageStreamResponse({ stream })
```

Key rules (v5):

- Use `createUIMessageStream` and `createUIMessageStreamResponse`.
- Convert UI messages to model messages with `convertToModelMessages(messages)`.
- Custom events must be `type: "data-<event>"` with flat payload fields.

File:

- `apps/formcraft/app/api/chat/handlers/form-creation.ts`

---

## 4) Frontend Chat Integration (AI SDK v5)

Replaced deprecated patterns and wired proper streaming:

- Removed incorrect `streamData` property from `useChat` return.
- Use `onData` callback with `DefaultChatTransport` to receive `data-*` event parts.

Final pattern:

```tsx
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";

const { messages, sendMessage, status, setMessages } = useChat({
  id: formId,
  transport: new DefaultChatTransport({
    api: "/api/chat",
    body: () => ({ formId, userId: userId || "anonymous", selectedModel }),
  }),
  onData: (dataPart) => {
    if ((dataPart as any)?.type === "data-agent_event") {
      const event = (dataPart as any).data;
      // bridge into zustand + event bus
      processEvent(event);
      bridgeEvent(event);
    }
  },
  onError: (error) => {
    /* push agent_error into event store */
  },
});
```

- Ensure client sends in v5 format:

```ts
await sendMessage(
  {
    parts: [{ type: "text", text: message }],
  },
  { body: { formId, userId, selectedModel } },
);
```

File:

- `apps/formcraft/app/dashboard/forms/[formId]/components/chat/ChatPanel.tsx`

---

## 5) Custom Data Events and Tool Invocation Cards

Custom events:

- All events emitted as `writer.write({ type: 'data-<event>', ...payload })`
- Consumed in ChatPanel `onData` and dispatched to store.

Tool invocation cards (v5 UI parts):

- Use `ToolUIPart` and `DynamicToolUIPart` with states:
  - `input-streaming`, `input-available`, `output-available`, `output-error`

Rendering:

- Gray/“spinning” for inflight (`input-streaming` / `input-available`)
- Green for `output-available` with success
- Red for `output-error` or `output-available` where `output.success === false`

File:

- `apps/formcraft/app/dashboard/forms/[formId]/components/chat/MessageWithParts.tsx`

---

## 6) Message Persistence and Formats

- Save assistant messages on `onFinish` in backend with:
  - `role: "assistant"`
  - `content: text`
  - `parts: toolCalls` (if any)
- In UI, derive `content` for legacy display by concatenating text parts from `msg.parts`.
- History hydration:
  - Accept arrays with `role in ["user","assistant","system"]` and either `parts` or `content`.
  - Normalize to v5 `UIMessage` shape.

Files:

- API handler save logic in `app/api/chat/handlers/form-creation.ts`
- History load in ChatPanel `useEffect`.

---

## 7) Question Generation Failures: Root Cause and Attempts

Symptom in logs:

```
[QUESTION_GENERATION_ERROR] Failed to generate question "What is your name?":
Error [AI_APICallError]: Provider returned error
responseBody: {
  "error":{"message":"Provider returned error","code":400,
  "metadata":{
    "raw":"{
       \"error\": {
         \"message\": \"Invalid schema for response_format 'response':
             In context=('properties','type','anyOf','2','properties','config'),
             'required' is required ... Missing 'minLabel'.\",
         \"type\":\"invalid_request_error\",
         \"param\":\"response_format\"
       }
    }","provider_name":"Azure"}}
}
```

Diagnosis:

- OpenRouter (Azure backend) strictly validates the JSON Schema sent in `response_format`.
- Our `QuestionSchema` is a discriminated union (`type.name`) with nested `config` objects for rating/linearScale, where some fields are optional (`minLabel`, etc.).
- Azure error expects all `config` properties listed in `required`, conflicting with optional fields in Zod → causes provider 400 before our code sees any output.

Mitigations attempted:

- Switched model from `openai/gpt-4o` → `openai/gpt-4o-mini`.
- Used `generateObject` with `mode: "tool"` → then `mode: "json"` to avoid strict json_schema constraints.
- Added repair loop with `experimental_repairText`.
- Enriched system prompt with exact schema expectations:
  - `type` discriminated union
  - `options[].score` required for choices
  - `config` structure for rating/linearScale
  - auto set `submissionBehavior`

Code (final attempt):

```ts
const generateSchemaResult = await generateObject({
  model: openRouterProvider("openai/gpt-4o-mini"),
  schema: QuestionSchema,
  mode: "json",
  system: enrichedSystemPrompt,
  prompt: userPrompt,
  experimental_repairText: repairFunction,
});
```

Result:

- Provider still returns 400 due to `response_format` constraints on Azure path.
- Root cause is provider‑side schema handling, not local validation.

File:

- `apps/formcraft/app/lib/chat/tools/generate-question.ts`

---

## 8) Provider Strategy and Initialization Plan

To avoid OpenRouter/Azure json_schema enforcement, we decided to centralize provider initialization and prefer Vercel AI Gateway or direct OpenAI:

Utility (initialization only; still use AI SDK calls):

- `getAIProvider("vercel" | "openrouter" | "openai")` returns a provider fn usable with AI SDK (e.g., `provider("gpt-4o")`)

Planned config (pseudocode):

```ts
// apps/formcraft/app/lib/ai/provider.ts
import { openai } from "@ai-sdk/openai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";

export function getAIProvider(type: "vercel" | "openrouter" | "openai") {
  switch (type) {
    case "vercel":
      return openai({
        apiKey: process.env.OPENAI_API_KEY,
        baseURL: "https://gateway.ai.vercel.com/v1",
      });
    case "openrouter":
      return createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY || "" });
    case "openai":
      return openai({ apiKey: process.env.OPENAI_API_KEY });
  }
}
```

Refactor sites that currently call `createOpenRouter` or direct `openai()` to use the factory, then set provider to `"vercel"` for question generation to bypass Azure schema validation.

Affected files to refactor:

- `app/api/forms/[formId]/route.ts`
- `app/api/ai/route.ts`
- `app/api/chat/handlers/form-creation.ts`
- `app/lib/ai/repair.ts`
- `app/lib/chat/tools/generate-metadata.ts`
- `app/lib/chat/tools/generate-question.ts`

---

## 9) Type/Schema Fixes

- v5 UI message types:
  - Tool part rendering moved to `ToolUIPart` / `DynamicToolUIPart` and state decoding.
- `useFormEditorStore.tsx` default question:
  - Added `styling: { colSpan: 12 }` to satisfy `QuestionSchema` requirements.
- Message normalization in ChatPanel:
  - Derive legacy `content` by concatenating text parts; keep `parts` intact.

---

## 10) Testing Protocols

- Frontend:
  - Trigger chat with a short prompt, watch Network/EventStream for:
    - `data-chat_initialized`
    - `data-agent_event` (state_snapshot, agent_warning, state updates)
    - tool parts: `tool-input-start`, `tool-input-delta`, `tool-output-available`
    - `data-chat_completed`
  - Verify:
    - Tool cards display with correct color/states
    - Right panel exits loading with `agent_finalized`
- Backend:
  - Watch server logs for:
    - `[QUESTION_GENERATION_ERROR]` per question
    - Provider HTTP 400s with `response_format` schema errors
- After provider switch:
  - Confirm presence of `question_schema_generated` events
  - Confirm UI preview shows generated questions

---

## 11) File Change Log

- Chat/Frontend
  - `apps/formcraft/app/dashboard/forms/[formId]/components/chat/ChatPanel.tsx`
    - Switched to `DefaultChatTransport({ api: "/api/chat" })`
    - Process custom events via `onData`
    - History normalization to v5 `UIMessage`
  - `apps/formcraft/app/dashboard/forms/[formId]/components/chat/MessageWithParts.tsx`
    - Render `ToolUIPart`/`DynamicToolUIPart` with states and status colors

- Backend/Streaming
  - `apps/formcraft/app/api/chat/handlers/form-creation.ts`
    - v5: `createUIMessageStream`/`createUIMessageStreamResponse`
    - `writer.merge(result.toUIMessageStream())`
    - Emit `data-*` events

- Tooling/Workflow
  - `apps/formcraft/app/lib/chat/tools/create-form-workflow.ts`
    - Ensure `agent_finalized` on failure
  - `apps/formcraft/app/lib/chat/tools/generate-metadata.ts`
    - `gpt-4o-mini`, stable streaming and snapshots
  - `apps/formcraft/app/lib/chat/tools/generate-question.ts`
    - Switch to `gpt-4o-mini`, `mode: "json"`, repair loop, enriched prompt, post-fixes
    - Stream per-question errors for diagnostics

- Types/Schema
  - `apps/formcraft/app/dashboard/forms/[formId]/stores/useFormEditorStore.tsx`
    - Add default `styling: { colSpan: 12 }` for new question

- Planned Utility (initialization only)
  - `apps/formcraft/app/lib/ai/provider.ts`
    - `getAIProvider("vercel"|"openrouter"|"openai")`

---

## 12) Open Items / Decisions

- [Planned] Provider initialization utility and refactor of all provider construction sites.
- [Decision] Use `"vercel"` provider path for question generation to bypass Azure JSON Schema enforcement.
- [Validation] Re-test question generation flow and ensure `question_schema_generated` events reach client and preview renders questions.

---

## Appendix: Representative Code Snippets

### A. ChatPanel v5 streaming

```tsx
const { messages, sendMessage, status, setMessages } = useChat({
  id: formId,
  transport: new DefaultChatTransport({
    api: "/api/chat",
    body: () => ({ formId, userId: userId || "anonymous", selectedModel }),
  }),
  onData: (dataPart) => {
    if ((dataPart as any)?.type === "data-agent_event") {
      const event = (dataPart as any).data;
      processEvent(event);
      bridgeEvent(event);
    }
  },
});
```

### B. Backend v5 stream with custom events

```ts
const stream = createUIMessageStream({
  execute: async ({ writer }) => {
    writer.write({ type: "data-chat_initialized" });
    const result = await streamText({
      model: MODEL,
      messages: convertToModelMessages(messages),
      tools,
      system,
    });
    writer.merge(result.toUIMessageStream());
  },
});
return createUIMessageStreamResponse({ stream });
```

### C. Question generation (final attempt)

```ts
const generateSchemaResult = await generateObject({
  model: openRouterProvider("openai/gpt-4o-mini"),
  schema: QuestionSchema,
  mode: "json",
  system: enrichedSystemPrompt,
  prompt: userPrompt,
  experimental_repairText: repairFn,
});
```
