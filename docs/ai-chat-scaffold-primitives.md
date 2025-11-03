# Chat Scaffold Primitives — Start Card and Placeholder

Purpose

- Provide small, reusable primitives to:
  - Show a start card and initiate the chat in a consistent way.
  - Derive the current question’s text format and placeholder string.

Exports

- `useChatStartCard` from `@formlink/runtime/ui/react`
- `useQuestionPlaceholder` from `@formlink/runtime/ui/react`

When to use

- You have a bottom‑attached prompt and want to hide the chat until the user clicks “Start”.
- You want consistent placeholders based on the active question’s format (email/url/tel/number/password) with automatic fallback to question description/title/label.

Quick start

```tsx
import {
  useChatStartCard,
  useQuestionPlaceholder,
} from "@formlink/runtime/ui/react";

function MyChat({
  sendMessage,
  messages,
  status,
  formSchema,
  currentQuestionId,
  answers,
  drafts,
}) {
  const { started, canStart, start } = useChatStartCard({
    sendMessage,
    messages,
    status,
    getFormSchema: () => formSchema,
    getResponses: () => ({ ...answers, ...drafts }),
    getCurrentQuestionId: () => currentQuestionId,
    // Optional customization:
    // startText: "Begin",
    // buildBody: ({ text, formSchema, currentQuestionId, responses }) => ({ initiate: true, startMode: "start" }),
  });

  const question =
    (formSchema?.questions || []).find(
      (q: any) => q.id === currentQuestionId,
    ) ?? null;
  const { format, placeholder } = useQuestionPlaceholder({ question });

  return (
    <>
      {!started && (
        <div>
          <h1>{formSchema?.title}</h1>
          <p>{formSchema?.description}</p>
          <button onClick={start} disabled={!canStart}>
            Start
          </button>
        </div>
      )}

      {started && (
        <>
          {/* ... messages ... */}
          <textarea placeholder={placeholder} />
        </>
      )}
    </>
  );
}
```

API — useChatStartCard

- Input
  - `messages`: message history array (used to derive `started`)
  - `status`: `"ready" | "submitted" | "streaming" | "error"`
  - `sendMessage(message, { body })`: your AI SDK send function
  - `getFormSchema()`: returns current form schema (required)
  - `getResponses?()`: returns merged response drafts (optional)
  - `getCurrentQuestionId?()`: returns active question id (optional)
  - `startText?`: override start text (default `"Start"`)
  - `buildBody?({ text, formSchema, currentQuestionId, responses })`: override request body

- Output
  - `started`: `boolean` — `true` when `messages.length > 0`
  - `canStart`: `boolean` — `true` when `status === "ready"`
  - `start()`: sends first message with body

Default body (when `buildBody` is not provided)

```ts
{
  userInput: text,
  submissionBehavior: "manualUnclear",
  currentQuestionId,
  formSchema,
  responses,
}
```

API — useQuestionPlaceholder

- Input
  - `question`: `{ id?, title?, label?, description?, type?: { name?, format? } }`
  - `defaultPlaceholder?`: string (default `"What would you like to know?"`)

- Output
  - `format`: `string | null` — `null` when not a text question
  - `placeholder`: derived placeholder; if `format` is one of `email|url|tel|number|password`, returns a canonical example; otherwise falls back to description/title/label or the default.

Notes

- These primitives are headless; wire them to your existing UI (`Conversation`, `PromptInput`, etc.).
- They complement the typed input primitives described in `docs/ai-typed-input-primitives.md`.
- For bottom anchoring with no body scroll, pair with a `svh`‑based viewport strategy as documented in the typed primitives doc.

Verification

- Toggle between no messages and some messages — start card should hide after first `start()`.
- Change the current question type to `email|url|tel|number|password|text` and ensure the placeholder updates accordingly.
