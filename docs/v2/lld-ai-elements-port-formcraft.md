# Low-level Implementation Doc: Port FormCraft Chat to AI Elements (non-breaking, commit-gated)

This document defines a safe migration of FormCraft’s chat UI to Vercel AI Elements, without changing business logic, API contracts, event handling, or stores. The integration mirrors the FormFiller approach by consuming AI Elements from `@formlink/ui/ai-elements` (installed and isolated under `packages/ui/src/ai-elements`). We will test changes on a branch/PR and merge when green; no runtime feature flag.

## Non-breaking principles

- UI-layer swap only:
  - Replace Conversation/Message rendering and the Prompt composer.
  - Do not change server endpoints, transports, tool invocation contracts, or store shapes.
- Isolation:
  - Import AI Elements strictly from `@formlink/ui/ai-elements`.
  - Do not run any installer in `apps/formcraft` or touch its `components.json`.
- Zero collisions:
  - No writes to shared primitives or app-level primitives.
  - Optionally keep legacy copies as `*_legacy.tsx` for easy diff/rollback during review.

## Current FormCraft architecture snapshot

Key files (verified):

- apps/formcraft/app/dashboard/forms/[formId]/components/chat/ChatPanel.tsx
  - Main chat container; uses `useChat` (AI SDK v5), renders messages via `MessageWithParts`.
  - Handles tool invocations/parts; coordinates with event systems and stores.
- apps/formcraft/app/dashboard/forms/[formId]/components/chat/MessageWithParts.tsx
  - Custom renderer for `message.parts` (`text`, tool parts, step-start, errors).
  - Manages complex tool visualization and states.
- apps/formcraft/app/components/chat/chat.tsx
  - Input component wrapper; renders `ChatInput`.
  - Model selection and system prompt selection; basic text input handling.
- apps/formcraft/app/components/chat/chat-input.tsx
  - Concrete input widget; file upload support; keyboard handlers.

Supporting systems to preserve:

- Multiple tools (create-form, update-form, get-form-context, show-config) with progress/success/failure visualization.
- Event bridge: `FormGenerationEventHandler`, `useFormGenerationEventBridge`.
- Model selection and system prompt selection.
- Chat history persistence and error handling.

## AI Elements surface to adopt

Consume from the design system (already isolated in `packages/ui/src/ai-elements` per the FormFiller LLD):

```ts
import {
  Conversation,
  Message,
  MessageContent,
  PromptInput,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputTools,
  PromptInputSubmit,
} from "@formlink/ui/ai-elements";
```

Notes:

- MessageContent may be used to render plain text; for markdown/code, use your existing renderer if required.
- AI Elements “Tool”/“Reasoning” UIs are optional and purely presentational; FormCraft’s detailed tool UI stays custom.

## Migration strategy (phased, commit-gated)

- Phase 1: Conversation/Message swap
  - Render messages via `Conversation` + `Message`; map text from `message.parts`.
  - Keep `MessageWithParts.tsx` checked in as legacy for diff/rollback.
- Phase 2: Prompt composer swap
  - Replace `ChatInput` with `PromptInput` composite.
  - Embed model/system prompt controls in a toolbar; reuse existing file upload flow.
- Phase 3: Integration, a11y, regression verification
  - Validate all message types, tools, file uploads, event bridge, persistence, errors, mobile, and dark mode.

## Implementation steps

### 1) Create AI Elements conversation layer

New file:

- apps/formcraft/app/dashboard/forms/[formId]/components/chat/conversation_v3.tsx

Responsibilities:

- Render messages with AI Elements; extract user/assistant text from parts.
- Do not replace custom tool visualization; keep that in `ChatPanel`/adjacent components.
- Preserve hidden/ephemeral filtering.

Skeleton:

```tsx
"use client";

import {
  Conversation,
  Message,
  MessageContent,
} from "@formlink/ui/ai-elements";

type Part =
  | { type: "text"; text: string }
  | { type: string; [k: string]: unknown };

type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  parts?: Part[];
  // other fields already in your message shape
};

export function ConversationV3({ messages }: { messages: ChatMessage[] }) {
  return (
    <Conversation>
      {messages.map((m) => {
        const textPart = m.parts?.find((p) => p.type === "text") as
          | { type: "text"; text: string }
          | undefined;
        const text = textPart?.text ?? (m as any).content ?? ""; // fallback if some messages still have content
        return (
          <Message key={m.id} role={m.role as "user" | "assistant"}>
            <MessageContent>
              {text}
              {/* If desired: light, non-authoritative tool activity summary line */}
            </MessageContent>
          </Message>
        );
      })}
    </Conversation>
  );
}
```

Notes:

- If you need markdown, replace the inner content with your existing markdown renderer (keep parity with current appearance).
- Stick-to-bottom: AI Elements typically handle this; if needed, keep your current hook.

### 2) Wire `ChatPanel` to ConversationV3

File to modify:

- apps/formcraft/app/dashboard/forms/[formId]/components/chat/ChatPanel.tsx

Changes:

- Import and render `ConversationV3` directly (no conditional at runtime).
- Do not change `useChat`, handlers, tool logic, or event bridge integration.
- Keep `MessageWithParts` file in repo for easy diff/rollback if needed.

Pseudo-diff (illustrative):

```tsx
import { ConversationV3 } from "./conversation_v3";

// ...
export function ChatPanel(/* existing props */) {
  // messages, handlers, tool state, events remain as-is

  return (
    <>
      <ConversationV3 messages={messages} />
      {/* The rest of your panel layout (tool UI sections, side panes, etc.) stays the same */}
    </>
  );
}
```

### 3) Build a Prompt composer using AI Elements

New file:

- apps/formcraft/app/components/chat/chat_v3.tsx

Responsibilities:

- Render `PromptInput` + toolbar + submit.
- Keep file upload flow unchanged.
- Embed model/system prompt selection in the toolbar.
- Match keyboard behavior (Enter send; Shift+Enter newline).

Skeleton:

```tsx
"use client";

import {
  PromptInput,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputTools,
  PromptInputSubmit,
} from "@formlink/ui/ai-elements";

type ChatComposerV3Props = {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  onFiles?: (files: File[]) => void;
  model: string;
  onModelChange: (m: string) => void;
  systemPrompt: string;
  onSystemPromptChange: (v: string) => void;
};

export function ChatComposerV3(props: ChatComposerV3Props) {
  const {
    value,
    onChange,
    onSubmit,
    disabled,
    onFiles,
    model,
    onModelChange,
    systemPrompt,
    onSystemPromptChange,
  } = props;

  return (
    <PromptInput onSubmit={onSubmit} disabled={!!disabled}>
      <PromptInputTextarea
        value={value}
        onChange={onChange}
        // replicate current Enter/Shift+Enter behavior if defaults differ
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onSubmit();
          }
        }}
      />
      <PromptInputToolbar>
        {/* Preserve model selection */}
        <ModelSelector model={model} onChange={onModelChange} />
        {/* Preserve system prompt selection */}
        <SystemPromptSelector
          value={systemPrompt}
          onChange={onSystemPromptChange}
        />
        <PromptInputTools>
          {/* Reuse existing file upload flow */}
          <FileAttach onFiles={onFiles} />
        </PromptInputTools>
        <PromptInputSubmit disabled={!!disabled} />
      </PromptInputToolbar>
    </PromptInput>
  );
}
```

### 4) Replace composer with AI Elements PromptInput

File to modify:

- apps/formcraft/app/components/chat/chat.tsx

Changes:

- Replace `ChatInput` usage with `ChatComposerV3` directly.
- Ensure `onSubmit` builds the same payload used today (no API changes).

Illustrative excerpt:

```tsx
import { ChatComposerV3 } from "./chat_v3";

export function Chat(/* existing props or internal hooks */) {
  // existing state/hooks: input, model, systemPrompt, file handling, submit handler
  // ensure onSubmit builds the same payload used today (no API changes)

  return (
    <ChatComposerV3
      value={input}
      onChange={setInput}
      onSubmit={handleSubmit}
      disabled={isDisabled}
      onFiles={handleFiles}
      model={model}
      onModelChange={setModel}
      systemPrompt={systemPrompt}
      onSystemPromptChange={setSystemPrompt}
    />
  );
}
```

### 5) Preserve file upload integration

- Keep current endpoints, validations, and form generation flows.
- The AI Elements toolbar is presentational; all actual upload control and lifecycle remain in your existing services and handlers.
- Ensure attachments are injected into the outgoing message parts exactly as before.

### 6) Preserve tool invocation visualization

- Do not remove or rewrite the existing tool UI or its state machines.
- AI Elements are used for message presentation only.
- If desired, add a small, non-authoritative status hint inside `MessageContent` for assistant messages, but the definitive visualization stays in your current custom views.

### 7) Preserve event system and stores

- Keep `FormGenerationEventHandler` and `useFormGenerationEventBridge` untouched.
- `onFinish`, `onError`, tool-part handling, and state transitions remain as-is.
- Do not change store contracts, selectors, or message shapes.

## Theming and a11y

- AI Elements inherit tokens and Tailwind from `@formlink/ui`.
- Verify:
  - Dark mode parity and color tokens.
  - Focus management for composer and toolbar controls.
  - Keyboard: Enter-to-send and Shift+Enter-newline (override if AI Elements default differs).
  - Mobile layout and virtual keyboard interactions.

## Testing matrix

Messages

- Roles: user, assistant (system/tool as currently presented).
- Types: text-only, tool-only, mixed, step-start, error, long markdown, code blocks.
- Hidden/ephemeral filtering.

Tools

- create-form, update-form, get-form-context, show-config:
  - Progress → success/failure visualization.
  - Retry flows.

Composer

- Model selection, system prompt selection.
- File uploads: types, sizes, validation, error handling.
- Keyboard: Enter/Shift+Enter behavior; disabled states (streaming/empty/missing preconditions).

State and events

- Chat history persistence.
- Event bridge updates while streaming; race conditions.

Theming and a11y

- Dark mode, focus states, ARIA labels.

Mobile

- Layout resilience, sticky composer, IME behavior.

## Acceptance criteria

- No server, transport, or store contract changes.
- Feature parity across message rendering and tool states.
- File upload works identically; same endpoints and validations.
- Model and system prompt selection remain fully functional.
- All AI Elements imports resolve from `@formlink/ui/ai-elements`.
- Visual style matches current theme (including dark mode).
- CI green; manual regression checklist passed.

## Rollout and rollback (commit-gated)

- Rollout:
  - Open PR with changes from Phase 1..3.
  - Run CI + manual regression from the testing matrix.
  - Merge when green.
- Rollback:
  - Revert the commit(s) in git, or restore `*_legacy.tsx` files.
  - No runtime flag involved.

## Risks and mitigations

- Risk: Installer collisions in app scope.
  - Mitigation: Never run the generator in `apps/formcraft`. Consume from `@formlink/ui/ai-elements` only.
- Risk: Primitive duplication.
  - Mitigation: Design system already isolates AI Elements via adapters; no primitives are duplicated here.
- Risk: Markdown/code rendering differences.
  - Mitigation: Keep your existing markdown renderer inside `MessageContent` where needed.
- Risk: A11y/keyboard regressions.
  - Mitigation: Verify behaviors; override `onKeyDown` to enforce parity.

## Timeline (conservative)

- Phase 1: 4–6 hours (messages; account for tool-related edge cases)
- Phase 2: 3–4 hours (composer, toolbar integrations)
- Phase 3: 4–6 hours (integration, a11y, testing, polish)

## Appendix: Reference implementation (FormFiller)

- FormFiller consumes AI Elements from `@formlink/ui/ai-elements` and keeps business logic intact.
- It provided the isolated design system installation and adapter strategy documented in `docs/v2/lld-ai-elements-swap.md`.
- Mirror its approach; do not diverge on installer or primitive usage.
