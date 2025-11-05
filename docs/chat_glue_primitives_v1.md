# Formlink Runtime — Chat Glue Primitives (React)

Purpose: minimal, composable hooks to integrate your existing chat backend (chat‑assist + tools) with any React UI (e.g., ai‑elements). No UI components are bundled here — only glue around slot tokens, selection/file submission, and tool results.

## Server Assumptions

- Route: `/api/ai/chat-assist` returning UIMessage stream (AI SDK `streamText`).
- Tools: `saveAnswer` and `completeSubmission` (part types `tool-saveAnswer`, `tool-completeSubmission`).
- Slot token: model emits `::PresentQuestionInputComponent qId='{QUESTION_ID}'::` in assistant text to indicate which input to render next.
- Optional upload: `POST /api/upload` returns `{ url, name, size }`.
- AI mode: JourneyScript is the system prompt; do not inject schema routing hints.

## What We Export

From `@formlink/runtime/ui/react`:

1. `useSlotBridge({ messages, onSlot })`

- Parses the last assistant text for the slot token and calls `onSlot(qId)` once per new assistant.

2. `useSubmitSelection({ sendMessage, currentQuestionId, delayMs? })`

- Returns `submitSelection(questionId, value, displayText)`
- Sends a chat turn with body `{ submissionBehavior:'auto', currentQuestionId, justSavedAnswer:{ questionId, value } }` after a small delay (default 250 ms).

3. `useFileUploadSubmission({ uploadApi, submitSelection })`

- Returns `handleFileUpload(questionId, file)` that uploads to `uploadApi` and then calls `submitSelection(questionId, { url, name, size }, 'Uploaded file: …')`.

4. `useToolDispatcher({ onApplyResult })`

- Provides `apply(message)`; scans `message.parts` for `tool-*` and calls `onApplyResult(toolName, result)` where `result = part.output ?? part.result`.
  - Typical mapping:
    - `saveAnswer` → `setCurrentInput(result.questionId, result.value)`; if `result.nextQuestionId`, update current question.
    - `completeSubmission` → set completed state and run redirect.

5. `useIntroStart({ sendMessage, suppressUserMessagePersistence? })`

- Returns `start({ text?, startMode? })` helper for the Start button; sends `{ initiate:true, suppressUserMessagePersistence:true }` by default.

## Wiring With ai‑elements (React)

Use ai-elements for rendering; wire runtime hooks around it.

```tsx
import { useChat } from "@ai-sdk/react";
import {
  useSlotBridge,
  useSubmitSelection,
  useFileUploadSubmission,
  useToolDispatcher,
  useIntroStart,
} from "@formlink/runtime/ui/react";
import {
  Conversation,
  PromptInput,
  PromptInputTextarea,
  PromptInputSubmit,
} from "@formlink/ui/ai-elements";

export function ChatTemplate() {
  const { messages, sendMessage, status, regenerate } = useChat({
    api: "/api/ai/chat-assist",
    onFinish: ({ message }) => toolDispatcher.apply(message),
  });

  const [currentQuestionId, setCurrentQuestionId] = React.useState<
    string | null
  >(null);
  useSlotBridge({ messages, onSlot: setCurrentQuestionId });

  const toolDispatcher = useToolDispatcher({
    onApplyResult: (tool, result) => {
      if (tool === "saveAnswer") {
        // setCurrentInput(result.questionId, result.value)
        if (result?.nextQuestionId) setCurrentQuestionId(result.nextQuestionId);
      }
      if (tool === "completeSubmission") {
        // setCompleted(); redirect
      }
    },
  });

  const { submitSelection } = useSubmitSelection({
    sendMessage,
    currentQuestionId,
  });
  const { handleFileUpload } = useFileUploadSubmission({
    uploadApi: "/api/upload",
    submitSelection,
  });
  const { start } = useIntroStart({
    sendMessage,
    suppressUserMessagePersistence: true,
  });

  return (
    <div>
      <Conversation>
        {/* map messages; render inputs based on currentQuestionId */}
      </Conversation>
      <PromptInput
        onSubmit={({ text }) =>
          sendMessage(
            { text },
            { body: { submissionBehavior: "manualAnswer", currentQuestionId } },
          )
        }
      >
        <PromptInputTextarea />
        <PromptInputSubmit status={status} />
      </PromptInput>
    </div>
  );
}
```

## Real Backend Story (ui-docs)

In `apps/ui-docs/stories/Chat/Glue Real Backend`, we include a story that calls your running app:

- Base URL: `process.env.NEXT_PUBLIC_FORMLINK_BASE_URL` (defaults to `http://localhost:3000`).
- Fetches the form schema from `GET {BASE}/api/forms/:formId`.
- Sends chat messages to `{BASE}/api/ai/chat-assist` and includes `formSchema` in the request body.
- Parses slot token via `useSlotBridge` and applies tool outputs via `useToolDispatcher`.

Make sure your app (hosting the `/api/forms/:id` and `/api/ai/chat-assist` routes) is running when viewing the story.

## Notes

- Keep ai‑elements as your UI; these hooks are glue only.
- For selection controls, call `submitSelection(qId, value, displayText)`.
- For file controls, call `handleFileUpload(qId, file)`.
- On Start, call `start();` and hide the synthetic user message in your message store if needed.
