import { Form } from "@formlink/schema";
import { useEffect, useState } from "react";
import { useChatStore } from "../components/chat/store/useChatStore";
import type { QuestionResponse } from "../lib/types";

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
      const versionToUse =
        (formSchema as any).current_published_version_id ||
        (formSchema as any).current_draft_version_id ||
        "";
      await store.initializeForm(
        formSchema,
        formId,
        versionToUse,
        true,
        initialData ?? {},
        isTestSubmission,
      );

      // 3) Fetch chat history if we have IDs
      let history = {
        messages: [],
        responses: {},
        submissionStatus: undefined as string | undefined,
      };
      const sid =
        (typeof (useChatStore as any).getState === "function"
          ? useChatStore.getState().submissionId
          : store.submissionId) ?? submissionId;
      if (sid && formId) {
        try {
          const res = await fetch(
            `/api/forms/${formId}/chat-history?submissionId=${sid}`,
          );
          if (res.ok) {
            const data = await res.json();
            history.messages = (data?.messages ?? []).map((m: any) => ({
              id: m.id,
              role: m.role,
              parts:
                m.parts ||
                (m.content ? [{ text: m.content, type: "text" }] : []),
              createdAt: m.createdAt ? new Date(m.createdAt) : undefined,
            }));
            history.responses = data?.responses ?? {};
            history.submissionStatus = data?.submissionStatus;
          }
        } catch {
          // proceed with empty history
        }
      }

      if (cancelled) return;

      // 4) Hydrate store from history to compute currentQuestionId and set ready state
      store.hydrateFromHistory(
        history.messages as any,
        history.responses as any,
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
