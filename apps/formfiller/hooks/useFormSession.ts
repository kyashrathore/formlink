import { Form } from "@formlink/schema";
import { useEffect, useState } from "react";
import type { UIMessage as MessageType } from "@ai-sdk/react";
import { useChatStore } from "../components/chat/store/useChatStore";
import type { QuestionResponse, FormWithVersions } from "../lib/types";

// Utility: get persisted submissionId safely even if hydration timing varies
function getPersistedSubmissionIdFallback(): string | null {
  try {
    const raw = localStorage.getItem("formfiller-chat-store");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.state?.submissionId ?? null;
  } catch {
    return null;
  }
}

type UseFormSessionArgs = {
  formId: string;
  formSchema: Form; // already available from page layer
  initialData?: Record<string, QuestionResponse>;
  isTestSubmission: boolean;
};

export function useFormSession({
  formId,
  formSchema,
  initialData,
  isTestSubmission,
}: UseFormSessionArgs) {
  const store = useChatStore();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      setIsLoading(true);

      // 1) Resolve persisted submissionId robustly
      const submissionId =
        store.submissionId ?? getPersistedSubmissionIdFallback();

      // 2) Initialize form in store (keeps existing logic & UUID generation)
      const v = formSchema as FormWithVersions;
      const versionToUse =
        v.current_published_version_id || v.current_draft_version_id || "";
      await store.initializeForm(
        formSchema,
        formId,
        versionToUse,
        true,
        initialData ?? {},
        isTestSubmission,
      );

      // 3) Fetch chat history if we have IDs
      let history: {
        messages: Array<{
          id?: string;
          role: string;
          parts?: Array<{ type: string; text?: string }>;
          content?: string;
          createdAt?: string | number | Date;
        }>;
        responses: Record<string, QuestionResponse>;
        submissionStatus?: string;
      } = { messages: [], responses: {}, submissionStatus: undefined };
      const sid =
        useChatStore.getState().submissionId ??
        store.submissionId ??
        submissionId;
      if (sid && formId) {
        try {
          const res = await fetch(
            `/api/forms/${formId}/chat-history?submissionId=${sid}`,
          );
          if (res.ok) {
            const data = await res.json();
            history.messages = (data?.messages ?? []).map(
              (
                m: {
                  id?: string;
                  role: string;
                  parts?: Array<{ type: string; text?: string }>;
                  content?: string;
                  createdAt?: string;
                },
                idx: number,
              ) => ({
                id: m.id ?? `${Date.now()}-${idx}`,
                role: m.role,
                parts:
                  m.parts ||
                  (m.content ? [{ text: m.content, type: "text" }] : []),
                createdAt: m.createdAt ? new Date(m.createdAt) : undefined,
              }),
            );
            history.responses = data?.responses ?? {};
            history.submissionStatus = data?.submissionStatus;
          }
        } catch {
          // proceed with empty history
        }
      }

      if (cancelled) return;

      // 4) Hydrate store from history to compute currentQuestionId and set ready state
      // hydrate expects compatible structures; pass as-is
      store.hydrateFromHistory(
        history.messages as unknown as MessageType[],
        history.responses,
        formSchema,
      );

      if (history.submissionStatus === "completed") {
        store.setFormDisplayState("completed");
      } else {
        // At this point, store.formDisplayState is 'chatting_ai_ready' if there's an unanswered question,
        // otherwise stays 'idle' and will be kicked off below.
      }

      setIsLoading(false);
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, [formId, formSchema, isTestSubmission]);

  return { isLoading };
}
