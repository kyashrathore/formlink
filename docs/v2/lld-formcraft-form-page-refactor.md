# LLD: FormCraft Form Page Chat/Loading/Persistence Refactor

Author: Cline  
Status: Ready for implementation (commit-gated on branch)  
Scope: apps/formcraft – Form page under dashboard forms route; API chat/form endpoints; minimal changes to packages/ui (none expected); zero server contract changes beyond additive message.parts persistence

Objective

- Fix: duplicate failing API calls on page load, chat suggestions flash/flicker, loader duplication, right panel loading sequence, tool invocation persistence across reload.
- Preserve existing business logic and flows; make behavior correct and consistent.
- Remove dead code (duplicate services, legacy chat components) and irrelevant state/variables after refactor.
- No runtime feature flag; implement on a branch, test, and merge.

Non-Goals

- No redesign of UI or server APIs.
- No DB schema changes; leverage existing messages.parts JSONB.

Repository Paths (key)

- Page: apps/formcraft/app/dashboard/forms/[formId]/page.tsx
- Chat: apps/formcraft/app/dashboard/forms/[formId]/components/chat/\*
- Editor/Right Panel: apps/formcraft/app/dashboard/forms/[formId]/components/\*
- Stores: apps/formcraft/app/dashboard/forms/[formId]/stores/\*
- Hooks: apps/formcraft/app/dashboard/forms/[formId]/hooks/\*
- API: apps/formcraft/app/api/\*
- Chat services: apps/formcraft/app/lib/chat/services/chat-service.ts (keep), apps/formcraft/app/dashboard/forms/[formId]/lib/chat/services/chat-service.ts (duplicate – remove)

---

1. Current behavior: root causes (short)

- Duplicate 404 calls: useEffect fetching in page.tsx, ChatPanel.tsx, useFormShortId runs twice in Next.js dev StrictMode; no dedupe/guards.
- Suggestions flash: ChatPanel renders suggestions prior to knowing chat history/context readiness and before auto-sending initialPrompt.
- Loader duplication: Conversation footer “Generating…”, PromptInput streaming state, tool cards “Preparing/Running…”, and right panel “generating questions…” produce overlapping indicators.
- Right panel flicker: Placeholder form set immediately (isLoading=false) before data → dummy UI, then shimmer, then real data.
- Tool invocations lost on reload: Only toolCalls descriptors saved; tool outputs/results not persisted to messages.parts.
- Code drift: Two ChatService implementations, inconsistent data-stream shapes.

---

2. Implementation Plan (extreme low-level; file-by-file)

2.1 React Query centralization and guards

2.1.1 Add query hooks (new files)

- apps/formcraft/app/dashboard/forms/[formId]/hooks/useFormDataQuery.ts
  - Purpose: Fetch GET /api/forms/:formId with dedupe and controlled retries.
  - Implementation:

```ts
"use client";
import { useQuery } from "@tanstack/react-query";

async function fetchForm(formId: string) {
  const res = await fetch(`/api/forms/${formId}`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const error: any = new Error(data.error || res.statusText);
    // annotate status for retry policy
    error.status = res.status;
    throw error;
  }
  return res.json();
}

export function useFormDataQuery(formId: string | undefined) {
  return useQuery({
    queryKey: ["form", formId],
    queryFn: () => fetchForm(formId as string),
    enabled: Boolean(formId),
    retry: (failureCount, error: any) => {
      if (error?.status === 404) return false;
      return failureCount < 1;
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}
```

- apps/formcraft/app/dashboard/forms/[formId]/hooks/useChatHistoryQuery.ts
  - Purpose: Fetch GET /api/chat?formId=…; avoid retries on 404; enabled only when form exists or session established.

```ts
"use client";
import { useQuery } from "@tanstack/react-query";

async function fetchChatHistory(formId: string) {
  const res = await fetch(`/api/chat?formId=${formId}`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const error: any = new Error(data.error || res.statusText);
    error.status = res.status;
    throw error;
  }
  return res.json() as Promise<any[]>;
}

export function useChatHistoryQuery(
  formId: string | undefined,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ["chat-history", formId],
    queryFn: () => fetchChatHistory(formId as string),
    enabled: Boolean(formId) && enabled,
    retry: (failureCount, error: any) => {
      if (error?.status === 404) return false;
      return failureCount < 1;
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}
```

2.1.2 [Removed] short-id query (agent-owned short_id)

- The FormCreateAgent is the sole authority to create short_id.
- Client no longer fetches short-id via a dedicated hook or endpoint.
- short_id is derived from:
  - GET /api/forms/:id (when present), and/or
  - agent snapshots merged into the editor store (currentForm.short_id).
- No useFormShortId hook.

  2.1.3 Update React Query provider defaults (optional but recommended)

- apps/formcraft/app/ReactQueryClientProvider.tsx

```ts
"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error: any) => {
        const status = (error as any)?.status;
        if (status === 404) return false;
        return failureCount < 1;
      },
    },
  },
});

export function ReactQueryClientProvider({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
```

2.2 Page data flow and right-panel render fixes

2.2.0 Defer formId creation until first user action (no client UUID on mount)

- Do not generate a client UUID at mount. If the route param is absent or a sentinel (e.g., "new"), keep formId undefined in client state.
- Do not call GET /api/forms/:id until a real id exists.
- Allow ChatPanel to operate with undefined formId for the first submit (useChat transport body will send formId: undefined). The server chat handler already creates a form when formId is missing (currentFormId = formId || form_nanoid()).
- Detect created form id via agent state snapshot (useFormGenerationStore.currentForm.id). When it appears:
  - Set editor store with the new form.
  - router.replace(/dashboard/forms/{createdId}) if the current route doesn’t match.
- Gate all UI that requires a real ID (Share tab, FormPreviewWithDevices, any actions that PATCH forms) until short_id exists (and thus formId exists).
- Remove page-level “uuidv4 on mount” and “router.replace on mount” logic.

  2.2.1 Replace placeholder/imperative fetching in page.tsx

- apps/formcraft/app/dashboard/forms/[formId]/page.tsx
  - Remove: placeholder setForm, setTimeout(loadExistingFormData), bare fetch.
  - Introduce useFormDataQuery(formId); when success, setForm once.
  - Maintain isLoading=true until either query success OR form-generation provides snapshot via agent events.

Implementation details:

- Track “formSetFromServer” ref to avoid re-setting on re-renders.
- Compute formExists from either editor store (form?.id) or currentForm in generation store.

Pseudo-diff (conceptual):

```tsx
import { useFormDataQuery } from "./hooks/useFormDataQuery";
import { useFormEditorStore } from "./stores/useFormEditorStore";
import { useFormGenerationStore } from "./stores/useFormGenerationStore";
import { useEffect, useRef } from "react";

// inside component:
const {
  data: formData,
  isLoading: formQueryLoading,
  isSuccess,
} = useFormDataQuery(formId);
const setForm = useFormEditorStore((s) => s.setForm);
const formSetRef = useRef(false);

useEffect(() => {
  if (isSuccess && formData && !formSetRef.current) {
    setForm(formData);
    formSetRef.current = true;
  }
}, [isSuccess, formData, setForm]);

// Remove immediate placeholder set; rely on isLoading logic in FormTabContent for skeleton.
```

2.2.2 Always shimmer first in FormTabContent

- apps/formcraft/app/dashboard/forms/[formId]/components/FormTabContent.tsx
  - Keep rendering skeleton when isLoading from store.
  - Empty state (“Start in Chat”) only if definitively no form AND not generating (agent not active).
  - No dummy details before shimmer.

If needed, add:

```ts
const { isFormGenerating } = useFormGenerationStore();
if (isLoading || isFormGenerating) return <FormShimmers />; // import from components/form/shimmers/FormShimmers
```

2.2.3 Short ID handling (agent-owned; no extra calls)

- Do not query short-id separately or poll.
- Read short_id from useFormEditorStore((s) => s.form?.short_id) or from generation snapshots already merged into the store.
- Gate the Share tab: hide/disable it until short_id exists; reveal immediately when short_id becomes available (from GET or agent snapshot). No fallback to formId for public sharing.
- Gate the preview mount: only mount FormPreviewWithDevices when short_id exists; prior to that, show a skeleton/placeholder.
- TabContentManager/NavigationBar: derive hasShortId from the editor store and (1) prevent switching to Share, (2) hide/disable the Share button, until hasShortId is true.

  2.3 Chat history hydration and suggestions gating

  2.3.1 Replace ChatPanel history fetch with React Query

- apps/formcraft/app/dashboard/forms/[formId]/components/chat/ChatPanel.tsx
  - Remove fetch(`/api/chat?formId=…`) useEffect.
  - Use useChatHistoryQuery(formId, enabled=Boolean(formId)); onSuccess normalize and setMessages ONCE; guard with ref.

Normalization utility (new):

- apps/formcraft/app/dashboard/forms/[formId]/components/chat/parts.ts

```ts
export function normalizePersistedParts(rawParts: any[], fallbackText: string) {
  if (!Array.isArray(rawParts) || rawParts.length === 0) {
    return fallbackText ? [{ type: "text", text: fallbackText }] : [];
  }
  return rawParts.map((p: any) => {
    if (p?.type === "tool-invocation") {
      return p; // already in UIMessage v5-compatible shape with results
    }
    const isFunctionCall = p?.toolCallType === "function" && p?.toolName;
    const isToolCall = p?.type === "tool-call" && p?.toolName;
    if (isFunctionCall || isToolCall) {
      let parsedArgs: any = isFunctionCall ? p.args : p.input;
      try {
        if (typeof parsedArgs === "string") parsedArgs = JSON.parse(parsedArgs);
      } catch {}
      return {
        type: "tool-invocation",
        toolInvocation: {
          state: "result",
          step: 1,
          toolCallId: p.toolCallId || p.id,
          toolName: p.toolName,
          args: parsedArgs,
          // No result available in legacy rows; UI will show ✓ Completed without details
        },
      };
    }
    return p;
  });
}
```

Use in ChatPanel when hydrating history:

```ts
const formatted = historyMessages
  .filter((m) => ["user", "assistant", "system"].includes(m.role))
  .map((m) => {
    const id = m.id?.toString() ?? uuidv4();
    const fallback = typeof m.content === "string" ? m.content : "";
    const parts = normalizePersistedParts(
      Array.isArray(m.parts) ? m.parts : [],
      fallback,
    );
    return { id, role: m.role, parts };
  });
setMessages(formatted as any);
```

2.3.2 Suggestions gating and initialPrompt send timing

- In ChatPanel.tsx:
  - Derive:
    - const historyLoading = chatHistoryQuery.isFetching && !chatHistoryLoadedRef.current;
    - const formReady = Boolean(useFormEditorStore(s => s.form?.id)) || Boolean(useFormGenerationStore(s => s.currentForm?.id));
    - const suggestionsVisible = !historyLoading && !formReady && !initialPrompt && !hasUserInteracted && chatMessages.length === 0;
  - Only render suggestions when suggestionsVisible === true.
  - Defer auto-send for initialPrompt until historyLoading === false (prevent sending while we still don’t know history).

    2.4 Status machine: unify indicators

    2.4.1 Add status util (new file)

- apps/formcraft/app/dashboard/forms/[formId]/components/chat/status.ts

```ts
export type ChatUIStatus =
  | "idle"
  | "preparing"
  | "streaming"
  | "tool-running"
  | "ready"
  | "error";

export function computeChatStatus(params: {
  chatStatus: "idle" | "submitted" | "streaming" | "error" | string;
  lastAssistantParts?: any[];
  agentFailed?: boolean;
}): ChatUIStatus {
  if (params.agentFailed || params.chatStatus === "error") return "error";
  if (params.chatStatus === "streaming") return "streaming";
  if (params.chatStatus === "submitted") return "preparing";
  const parts = params.lastAssistantParts || [];
  const activeTool = parts.some((p: any) => {
    if (!p || typeof p !== "object") return false;
    const t = p.type;
    if (t === "tool-invocation") {
      const s = p.toolInvocation?.state;
      return s === "input-streaming" || s === "input-available";
    }
    return false;
  });
  if (activeTool) return "tool-running";
  return "ready";
}
```

2.4.2 Wire status to Conversation and Composer

- In ChatPanel.tsx:
  - const uiStatus = computeChatStatus({ chatStatus, lastAssistantParts, agentFailed: agentState?.status === "FAILED" });
  - Pass to Conversation: status={uiStatus === "streaming" ? "streaming" : uiStatus === "preparing" ? "submitted" : uiStatus === "error" ? "error" : "ready"}
  - Pass to Chat composer: status={uiStatus === "streaming" ? "streaming" : uiStatus === "preparing" ? "submitted" : uiStatus === "error" ? "error" : "ready"} and isSubmitting={uiStatus === "streaming" || uiStatus === "preparing" || uiStatus === "tool-running"}

    2.4.3 Remove duplicate footer “Generating…”

- apps/formcraft/app/dashboard/forms/[formId]/components/chat/conversation.tsx
  - Either remove the bottom streaming block entirely, or add a prop `showFooterStatus=false` and default to false.
  - Rely on PromptInputSubmit/Composer to show activity.

    2.4.4 Tool logs visibility

- In conversation.tsx:
  - Only show ToolLogs when state in {"input-streaming","input-available"} AND it’s the last assistant message. Hide otherwise.

    2.5 Persist tool outputs/results (server-side)

    2.5.1 Instrument tools in chat handler

- apps/formcraft/app/api/chat/handlers/form-creation.ts
  - Wrap createChatTools so every tool call is intercepted and recorded.
  - On onFinish, convert captured results to UIMessage v5 “tool-invocation” parts and persist them.

Implementation sketch:

```ts
type ToolResult = {
  toolName: string;
  args: any;
  result?: any;
  success: boolean;
  errorText?: string;
};

const toolResults: ToolResult[] = [];

const baseTools = createChatTools(toolContext) as Record<string, any>;

const tools = Object.fromEntries(
  Object.entries(baseTools).map(([toolName, toolFn]) => {
    if (typeof toolFn !== "function") return [toolName, toolFn];
    return [
      toolName,
      async (...args: any[]) => {
        try {
          const res = await (toolFn as any)(...args);
          toolResults.push({
            toolName,
            args: args?.[0],
            result: res,
            success: true,
          });
          return res;
        } catch (e: any) {
          toolResults.push({
            toolName,
            args: args?.[0],
            success: false,
            errorText: e?.message || String(e),
          });
          throw e;
        }
      },
    ];
  }),
) as any;

// later in onFinish:
const partsFromTools = toolResults.map((r) => ({
  type: "tool-invocation",
  toolInvocation: {
    state: r.success ? "result" : "error",
    toolName: r.toolName,
    args: r.args,
    result: r.result,
    success: r.success,
    ...(r.errorText ? { errorText: r.errorText } : {}),
  },
}));

await chatService.saveMessage(currentFormId, userId, {
  role: "assistant",
  content: text,
  parts: partsFromTools,
});
```

Notes:

- Keep content=text unchanged.
- Do NOT persist raw toolCalls (call descriptors); replaced with tool-invocation parts carrying results.

  2.6 Remove duplicate/dead code

  2.6.1 Remove duplicate ChatService

- Delete: apps/formcraft/app/dashboard/forms/[formId]/lib/chat/services/chat-service.ts
- Ensure all imports use: apps/formcraft/app/lib/chat/services/chat-service.ts
- Align writeUIAction shape to use data-ui_action consistently (optional; currently not used by client).

  2.6.2 Remove legacy chat components if unused

- Candidates:
  - apps/formcraft/app/dashboard/forms/[formId]/components/chat/MessageWithParts_legacy.tsx
  - apps/formcraft/app/dashboard/forms/[formId]/components/chat/chat-components/chat-input.tsx (replaced by chat.tsx Composer)
  - apps/formcraft/app/dashboard/forms/[formId]/components/chat/conversation_v3.tsx
  - apps/formcraft/app/dashboard/forms/[formId]/components/chat/chat-components/chat_v3.tsx
- Procedure:
  - rg -n "MessageWithParts_legacy|chat-input|conversation_v3|chat_v3" apps/formcraft
  - If no references, delete and run typecheck/build.

    2.6.3 Remove no-op bridge hook and usage

- File: apps/formcraft/app/hooks/useFormGenerationEventBridge.ts is a no-op.
- In ChatPanel.tsx remove import/use of memoizedBridgeEvent(event).
- If unused elsewhere, delete the hook.

  2.6.4 Clean dead variables/comments

- While editing, remove unused imports/variables; run lint and knip if available.

  2.7 Message parts normalization utility usage

- Use normalizePersistedParts for both history hydration and any future transforms.
- Add minimal type guards around p.type === "tool-invocation" shape:

```ts
export function isToolInvocationPart(
  p: any,
): p is { type: "tool-invocation"; toolInvocation: any } {
  return (
    p &&
    typeof p === "object" &&
    p.type === "tool-invocation" &&
    p.toolInvocation
  );
}
```

---

3. Testing and Verification

3.1 Duplicate calls suppression

- Load a brand-new form route with no existing form:
  - Network tab shows at most one request each (dev StrictMode still mounts twice but React Query dedupes):
    - GET /api/forms/:id (404 acceptable, once)
    - GET /api/chat?formId=:id (404 acceptable, once)
    - No short-id requests fired automatically.
- No console spam on 404.

  3.2 Suggestions flash

- On fresh load with no history and no initialPrompt:
  - Suggestions appear only after historyLoading=false and if no formReady.
- With initialPrompt present:
  - No suggestions; initial send waits until historyLoading=false; starts streaming cleanly.

    3.3 Loader/status

- During send:
  - Composer shows “submitted/streaming”; Conversation footer does NOT show duplicate “Generating…” row.
- Tool-running:
  - Tool cards show “Preparing/Running …” only for last assistant message; ToolLogs visible only while active.
- Right panel:
  - Always shimmer first; no dummy details → shimmer → real flicker.

    3.4 Tool persistence

- Send a message that triggers tools; onFinish persists assistant.message.parts with tool-invocation results.
- Reload page:
  - History shows completed tool cards with outputs or error badges.
  - No loss of invocation state.

    3.5 Regression

- Existing flows (saving/publishing forms, editing questions, switching tabs) continue to function.
- No unauthorized API calls (ownership checks intact).
- React Query cache behavior acceptable (no excessive refetch).

---

4. Branching, Commits, Rollout

4.1 Branch

- git checkout -b refactor/formcraft-chat-loading-persistence

  4.2 Commits (suggested)

- feat(formcraft): add query hooks and provider defaults
- refactor(formcraft): replace page.tsx fetch effects with useFormDataQuery; remove placeholder
- feat(chat): useChatHistoryQuery and parts normalization; gate suggestions and status
- feat(chat-api): persist tool results in assistant message.parts
- refactor(ui): unify status indicators; hide conversation footer status
- fix(share): agent-owned short_id; remove short-id hook and endpoint consumption
- chore: remove duplicate ChatService and legacy chat components
- chore: remove no-op event bridge; clean dead imports/vars
- test: add manual verification notes in docs

  4.3 Rollback

- Revert commits in reverse order; no schema or contract changes, safe rollback.

---

5. Clean-up Tasks (required)

- Delete: apps/formcraft/app/dashboard/forms/[formId]/lib/chat/services/chat-service.ts
- Delete any unused legacy chat components listed in 2.6.2 (after grep confirms no references)
- Remove useFormGenerationEventBridge.ts and imports/usages if unused
- Run:
  - pnpm -w lint
  - pnpm -w typecheck
  - pnpm -w build
  - rg -n "TODO|@ts-ignore|any" in changed files to remove stray types/comments

---

6. Notes and Constraints

- No server API changes visible to clients; messages.parts is already persisted in DB (verified by ChatService).
- Avoid introducing blocking dependencies; hooks are client-side and scoped to the form dashboard route.
- Keep imports at top level; minimize comments; delete code rather than commenting out (repo rules).
- AI Elements primitives already adopted; keep Conversation/PromptInput wrappers dumb; move gating/logic into ChatPanel and small utils.

---

7. Appendix: File Touch List

- New
  - apps/formcraft/app/dashboard/forms/[formId]/hooks/useFormDataQuery.ts
  - apps/formcraft/app/dashboard/forms/[formId]/hooks/useChatHistoryQuery.ts
  - apps/formcraft/app/dashboard/forms/[formId]/components/chat/parts.ts
  - apps/formcraft/app/dashboard/forms/[formId]/components/chat/status.ts

- Modified
  - apps/formcraft/app/ReactQueryClientProvider.tsx (defaults)
  - apps/formcraft/app/dashboard/forms/[formId]/page.tsx (remove placeholder and effects; use query)
  - apps/formcraft/app/dashboard/forms/[formId]/components/TabContentManager.tsx (drop short-id hook; pass store.short_id)
  - apps/formcraft/app/dashboard/forms/[formId]/components/FormTabContent.tsx (skeleton-first polish; gate FormPreviewWithDevices until short_id exists)
  - apps/formcraft/app/dashboard/forms/[formId]/components/NavigationBar.tsx (hide/disable Share tab until short_id exists)
  - apps/formcraft/app/dashboard/forms/[formId]/components/chat/ChatPanel.tsx (React Query hydration, suggestions gating, status)
  - apps/formcraft/app/dashboard/forms/[formId]/components/chat/conversation.tsx (footer status off; tool logs gating)
  - apps/formcraft/app/api/chat/handlers/form-creation.ts (tool instrumentation and persistence)

- Removed (post-grep confirm)
  - apps/formcraft/app/dashboard/forms/[formId]/lib/chat/services/chat-service.ts
  - apps/formcraft/app/dashboard/forms/[formId]/components/chat/MessageWithParts_legacy.tsx
  - apps/formcraft/app/dashboard/forms/[formId]/components/chat/chat-components/chat-input.tsx (if unused)
  - apps/formcraft/app/dashboard/forms/[formId]/components/chat/conversation_v3.tsx (if unused)
  - apps/formcraft/app/dashboard/forms/[formId]/components/chat/chat-components/chat_v3.tsx (if unused)
  - apps/formcraft/app/hooks/useFormGenerationEventBridge.ts (if unused)

---

8. Acceptance Criteria

- On new form route, only one 404 per endpoint maximum; no duplicate/forked requests.
- Suggestions do not flash; appear only when appropriate and never during auto-send.
- Single UX status surface; no overlapping “Generating...” messages.
- Right panel always shows shimmer first; no dummy info prior to shimmer; smooth transition to real content.
- Share tab remains hidden/disabled until short_id exists; becomes available immediately when short_id is set.
- Preview mounts only when short_id exists; before that, a skeleton/placeholder is shown.
- After tool calls, reload shows completed tool invocations with outputs or error badges.
- No broken flows; tests pass; lint/typecheck/build clean.
