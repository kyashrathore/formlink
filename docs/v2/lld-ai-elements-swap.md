Low-level Implementation Doc: Integrate Vercel AI Elements via packages/ui/ai-elements (no collisions)

Summary and goals

- Scope: Replace the chat UI layer in apps/formfiller with Vercel AI Elements, keeping business logic, transport, stores, and API unchanged.
- Goals:
  - UI swap only, minimal disruption
  - Preserve tool-driven flows: saveAnswer, presentQuestion, completeSubmission
  - Preserve file upload flow and session logic
  - Retain existing markdown approach or use AI Elements Response where feasible
  - Match current theme (shadcn/Tailwind) and accessibility
  - Avoid collisions with existing primitives; enable clean upgrades

Install target and conflict strategy (Option B: packages/ui/ai-elements)

- Source of truth: packages/ui provides AI Elements for all apps.
- Isolation: Use a dedicated components.json under packages/ui/ai-elements so the AI Elements generator writes only to packages/ui/src/ai-elements and never touches existing primitives under packages/ui/src/ui.
- Import discipline: Apps import AI Elements strictly from @formlink/ui/ai-elements/\*.
- No overwrites: Do not write/overwrite any files under packages/ui/src/ui/\* or app-level primitives.

Repository structure

- packages/ui/ai-elements/components.json (isolated generator config)
- packages/ui/src/ai-elements/ (generated/maintained AI Elements)
  - conversation/
  - message/
  - prompt-input/
  - response/ (optional)
  - reasoning/ (phase 2)
  - tool/ (phase 2)
  - \_adapters/
    - ui/ (adapter re-exports to existing design-system primitives)
    - lib/ (if AI Elements expect local utils; optional)

Isolated components.json (example)

- Place at packages/ui/ai-elements/components.json
- Purpose: point generator to src/ai-elements and route any primitive imports through adapters.

Example (adapt to current conventions)
{
"$schema": "https://ui.shadcn.com/schema.json",
"style": "new-york",
"rsc": true,
"tsx": true,
"tailwind": {
"config": "",
"css": "../src/styles/globals.css",
"baseColor": "zinc",
"cssVariables": true
},
"iconLibrary": "lucide",
"aliases": {
"components": "@formlink/ui/ai-elements/\_adapters/ui",
"utils": "@formlink/ui/lib/utils",
"hooks": "@formlink/ui/hooks",
"lib": "@formlink/ui/lib",
"ui": "@formlink/ui/ui"
},
"paths": {
"components": "../src/ai-elements",
"utils": "../src/ai-elements/lib"
}
}

Notes:

- tailwind.config can remain empty here to mirror existing packages/ui/components.json, unless you maintain a config file in packages/ui.
- The adapters indirection ensures AI Elements never duplicate or import primitives directly from src/ui; you can swap bindings centrally.

Adapters (primitive mapping)

- Create adapter re-exports so AI Elements import primitives via a stable surface.
- Example files (only add those actually referenced by AI Elements):
  - packages/ui/src/ai-elements/\_adapters/ui/button.tsx
    export { Button } from "../../ui/button"
  - packages/ui/src/ai-elements/\_adapters/ui/input.tsx
    export { Input } from "../../ui/input"
  - packages/ui/src/ai-elements/\_adapters/ui/textarea.tsx
    export { Textarea } from "../../ui/textarea"
  - packages/ui/src/ai-elements/\_adapters/ui/card.tsx
    export { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from "../../ui/card"
  - packages/ui/src/ai-elements/\_adapters/ui/avatar.tsx
    export { Avatar, AvatarImage, AvatarFallback } from "../../ui/avatar"
- This keeps a single source for base primitives and prevents duplication.

Installation flow (per AI SDK Elements)

- Reference: https://ai-sdk.dev/elements/overview/setup
- Procedure:
  1. cd packages/ui/ai-elements
  2. Initialize if required by the tool (check docs as versions evolve):
     - npx ai-elements@latest init
  3. Add AI Elements components into the isolated namespace:
     - npx ai-elements@latest add conversation message prompt-input
     - Optional (phase 2+): add response reasoning tool
- The generator will write only under packages/ui/src/ai-elements according to the isolated components.json.

Public API and imports

- Re-export AI Elements for consumers:
  - Option A: Barrel per component
    - packages/ui/src/ai-elements/conversation/index.ts
    - packages/ui/src/ai-elements/message/index.ts
    - packages/ui/src/ai-elements/prompt-input/index.ts
    - packages/ui/src/ai-elements/response/index.ts (optional)
  - Option B: Aggregate:
    - packages/ui/src/ai-elements/index.ts
      export { Conversation } from "./conversation"
      export { Message } from "./message"
      export { PromptInput } from "./prompt-input"
      export { Response } from "./response"
- Consumer import (apps/formfiller):
  import { Conversation, Message, PromptInput } from "@formlink/ui/ai-elements"

Current architecture summary (apps/formfiller)

- Orchestrator: app/[formId]/FormAIComponent.tsx
  - useChat (@ai-sdk/react) + DefaultChatTransport(apiConfig.getChatAssistUrl())
  - onFinish parses message.parts/toolInvocations → store transitions:
    - saveAnswer: setCurrentInput, advance question
    - presentQuestion: setCurrentQuestionId
    - completeSubmission: setFormDisplayState("completed")
  - submitSelection and handleFileUploadWithSubmission preserve existing API shape and store coordination
  - Footer input: currently PromptInput primitives from @formlink/ui

- Message list:
  - components/chat/conversation.tsx uses StickToBottom; renders custom Message/MessageAssistant/MessageUser
  - components/chat/QuestionWrapper.tsx displays embedded InputContainer for presentQuestion
  - MessageAssistant filters reasoning parts; renders markdown via MessageContent (from @formlink/ui)

- Store:
  - components/chat/store/useChatStore.ts keeps chatHistoryMessages (UIMessage), currentInputs, currentQuestionId, etc.

AI Elements surface to adopt

- Required:
  - Conversation (chat container)
  - Message (user / assistant)
  - PromptInput (composer)
  - Response (markdown-like rendering; optional if you prefer existing MessageContent)

- Optional (phase 2+):
  - Reasoning (visible reasoning panel during streaming)
  - Tool (visual affordance for tool invocations)
  - Loader (consistent loading visuals)

Data model and transport compatibility

- Messages: Using standard AI SDK shapes (role, parts/content). Compatible with AI Elements.
- Transport: Keep useChat + DefaultChatTransport; no server changes.
- Handlers: Keep onFinish/onError logic intact to apply tool outputs to the store.

Component-by-component mapping

1. Conversation (list container)

- Replace apps/formfiller/components/chat/conversation.tsx usage with @formlink/ui/ai-elements/Conversation.
- Render messages with @formlink/ui/ai-elements/Message; maintain current hidden-message filtering.
- Keep or drop StickToBottom depending on AI Elements behavior.

2. Message (user/assistant)

- Replace custom MessageUser/MessageAssistant with @formlink/ui/ai-elements/Message.
- Assistant rendering:
  - Text via either:
    - AI Elements Response; or
    - Keep @formlink/ui MessageContent (markdown={true}) within AI Elements Message if you need custom markdown mapping.
  - Embedded controls (presentQuestion):
    - Detect last assistant + matching currentQuestionId; render your QuestionWrapper inside the Message as sibling JSX beneath the text.
    - Keep handleFileUploadWithSubmission and submitSelection wiring.

3. PromptInput (composer)

- Replace footer input with @formlink/ui/ai-elements/PromptInput.
- Wire onSubmit to existing sendMessage:
  - Build body payload (userInput, submissionBehavior, currentQuestionId, formSchema, responses, submissionId, isTestSubmission)
  - Keyboard: Enter send, Shift+Enter newline (verify defaults; adapt if needed).
- Disable logic unchanged: status === "streaming", empty input, or missing submissionId.

4. Reasoning and Tool (optional)

- Reasoning: show during streaming; auto-close on finish.
- Tool: show visual affordance for tool invocations (presentational only; no contract changes).

Theming and styling

- AI Elements are shadcn-style TSX + Tailwind-compatible.
- Ensure classes align with design system tokens.
- Dark mode: ensure shared theme provider cascades; apply className toggles as needed.

Integration steps

1. Branch

- git checkout -b feat/ai-elements-swap-formfiller

2. Install in design system (isolated)

- cd packages/ui/ai-elements
- npx ai-elements@latest add conversation message prompt-input
- Optional later: add response reasoning tool
- Verify generator only wrote under packages/ui/src/ai-elements/\*

3. Re-export in @formlink/ui

- Add barrel exports to expose Conversation, Message, PromptInput (and Response if used).

4. Wire in apps/formfiller

- Replace conversation.tsx usage with @formlink/ui/ai-elements/Conversation and Message.
- Replace footer with @formlink/ui/ai-elements/PromptInput.
- Assistant message rendering:
  - Text via Response or existing MessageContent.
  - When last assistant + presentQuestion, render:
    <QuestionWrapper
    handleFileUpload={handleFileUploadWithSubmission}
    onSubmitSelection={submitSelection}
    .../>

5. Keep store and handlers unchanged

- onFinish continues to parse parts[] and toolInvocations.
- processAssistantResponse remains to toggle formDisplayState back to ready.
- File uploads via handleFileUploadWithSubmission unchanged.

6. Verification

- Manual:
  - Streams visible tokens
  - Tool flows apply correctly
  - presentQuestion UI shows and works
  - File upload works
  - Enter/Shift+Enter behaviors
  - Mobile layout intact
- Regression: Ensure non-AI flows are unaffected.

Upgrade strategy

- Upgrades performed in packages/ui:
  - Re-run installer in packages/ui/ai-elements against the isolated components.json.
  - Resolve diffs in packages/ui/src/ai-elements only.
  - Publish/update @formlink/ui; apps consume new version.
- Acceptance: no writes outside packages/ui/src/ai-elements and packages/ui/src/ai-elements/\_adapters.

Risks and mitigations

- Generator assumes default components.json and writes into ui/:
  - Mitigation: Always run from packages/ui/ai-elements with isolated components.json.
- Primitive duplication:
  - Mitigation: Force all primitive imports through \_adapters that re-export from @formlink/ui/ui/\*.
- Markdown rendering differences:
  - Mitigation: Keep @formlink/ui MessageContent until AI Elements Response reaches parity; swap later if desired.
- A11y and keyboard:
  - Mitigation: Validate Enter/Shift+Enter, aria labeling; tweak if needed.

Acceptance criteria

- With AI Elements:
  - Conversation/Message/PromptInput render and function as before
  - presentQuestion interactive controls render inside the last assistant message and function
  - Tool outputs (saveAnswer/presentQuestion/completeSubmission) update store and UI as before
  - File upload flow works
  - Keyboard behaviors preserved
  - Visual style consistent with current theme (including dark mode)
- Isolation and safety:
  - Installation/upgrades modify only packages/ui/src/ai-elements/** and packages/ui/src/ai-elements/\_adapters/**
  - No changes to packages/ui/src/ui/\*\* or app-level primitives
  - All app imports to AI Elements are via @formlink/ui/ai-elements/\*\*
- No changes to server endpoints, transport, or store contracts

Work breakdown (initial)

- Isolated config + scaffolding in packages/ui: 0.5–1h
- Conversation/Message swap + embedded QuestionWrapper: 1.5–2.5h
- PromptInput swap + handlers: 0.5–1h
- Theming polish + responsive: 1–2h
- Verification + fixes: 1–2h
- Optional Reasoning/Tool visuals: 1–2h
