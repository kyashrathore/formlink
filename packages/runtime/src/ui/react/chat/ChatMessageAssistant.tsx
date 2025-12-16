"use client";
import type { Question } from "@formlink/schema";
import * as React from "react";
import { useAiElements } from "../primitives/ai-elements-context";
import { ChatQuestionWrapper } from "./ChatQuestionWrapper";
import { remarkSlots } from "./remark-slots-streamdown";
const FALLBACK_SLOT_RE =
  /::PresentQuestionInputComponent\s+qId=["']([^"']+)["']::/;

export type UIMessage = {
  id?: string | number;
  role: string;
  parts?: Array<any>;
};

export interface ChatMessageAssistantProps {
  message: UIMessage;
  isLast?: boolean;
  status?: string;
  currentQuestionId?: string | null;
  form: { questions?: Question[] };
  values?: Record<string, unknown>;
  onChange?: (qId: string, value: unknown) => void;
  onSubmitSelection?: (
    questionId: string,
    value: unknown,
    displayText: string,
  ) => void | Promise<void>;
  onFileUpload?: (questionId: string, file: File) => Promise<void>;
  /**
   * Control rendering of inline slot controls inside assistant messages.
   * - boolean: true (default) renders all slots; false renders none.
   * - function: called with the Question; return true to render, false to suppress.
   */
  renderSlots?: boolean | ((q: Question) => boolean);
}

export function ChatMessageAssistant({
  message,
  isLast,
  status,
  currentQuestionId,
  form,
  values,
  onChange,
  onSubmitSelection,
  onFileUpload,
  renderSlots = true,
}: ChatMessageAssistantProps) {
  const { Response, Reasoning, ReasoningTrigger, ReasoningContent } =
    useAiElements();
  // ai-elements provided by host via AiElementsProvider
  const parts = Array.isArray(message?.parts) ? message.parts : [];
  const findQuestion = React.useCallback(
    (qId: string): Question | null => {
      const list = form?.questions ?? [];
      return (list.find((q: any) => q?.id === qId) as Question) ?? null;
    },
    [form?.questions],
  );

  const components = React.useMemo(() => {
    return {
      PresentQuestionInputComponent: ({ qId }: { qId: string }) => {
        const qid = String(qId ?? "");
        if (!isLast) return null;
        const q = qid ? findQuestion(qid) : null;
        if (!q) return null;
        const allow =
          typeof renderSlots === "function"
            ? renderSlots(q)
            : renderSlots !== false;
        if (!allow) return null;
        if (currentQuestionId !== qid) return null;
        const val = values
          ? ((values as Record<string, unknown>)[qid] ?? null)
          : null;
        return (
          <div className="mt-3">
            <ChatQuestionWrapper
              question={q}
              value={val}
              onChange={(v) => onChange?.(qid, v)}
              onSubmitSelection={(
                qid2: string,
                value2: unknown,
                display: string,
              ) => onSubmitSelection?.(qid2, value2, display)}
              onFileUpload={onFileUpload}
            />
          </div>
        );
      },
    } as any;
  }, [
    isLast,
    findQuestion,
    currentQuestionId,
    values,
    onChange,
    onSubmitSelection,
    onFileUpload,
    renderSlots,
  ]);

  return (
    <div className="w-full max-w-3xl">
      {parts.map((part, index) => {
        if (part?.type === "reasoning") {
          const reasoning = part.text || part.reasoning || "";
          if (!reasoning && !part.delta) return null;

          if (Reasoning && ReasoningTrigger && ReasoningContent) {
            return (
              <Reasoning
                key={`reasoning-${index}`}
                isStreaming={status === "streaming"}
              >
                <ReasoningTrigger />
                <ReasoningContent>{reasoning || part.delta}</ReasoningContent>
              </Reasoning>
            );
          }

          // Render reasoning as a collapsible detail fallback
          return (
            <details
              key={`reasoning-${index}`}
              className="mb-2 text-xs text-muted-foreground/80 group"
            >
              <summary className="cursor-pointer list-none flex items-center gap-1 hover:text-foreground transition-colors select-none font-medium">
                <span className="opacity-70 group-open:opacity-100 transition-opacity">
                  Thinking Process
                </span>
                <span className="text-[10px] opacity-50 group-open:hidden ml-1">
                  (Click to expand)
                </span>
              </summary>
              <div className="mt-1 pl-3 border-l-2 border-primary/20 italic whitespace-pre-wrap">
                {reasoning || part.delta}
              </div>
            </details>
          );
        }

        if (part?.type !== "text") return null;
        const text: string = part.text ?? "";
        const m = text.match(FALLBACK_SLOT_RE);
        if (m) {
          const start = m.index ?? 0;
          const end = start + m[0].length;
          const before = text.slice(0, start);
          const after = text.slice(end);
          const qid = String(m[1] ?? "");
          if (!qid) return <Response key={`t-${index}`}>{text}</Response>;
          if (!isLast) {
            const combined = `${before}${after}`.trim();
            return combined ? (
              <Response key={`t-${index}`}>{combined}</Response>
            ) : null;
          }
          const q = findQuestion(qid);
          if (!q) {
            return (
              <Response key={`t-${index}`}>{`${before}${after}`}</Response>
            );
          }
          const allow =
            typeof renderSlots === "function"
              ? renderSlots(q)
              : renderSlots !== false;
          if (!allow) {
            const combined = `${before}${after}`.trim();
            return combined ? (
              <Response key={`t-${index}`}>{combined}</Response>
            ) : null;
          }
          const val = values
            ? ((values as Record<string, unknown>)[qid] ?? null)
            : null;
          return (
            <div key={`slot-${index}`} className="mt-2">
              {before.trim() ? <Response>{before}</Response> : null}
              {currentQuestionId === qid ? (
                <div className="mt-3">
                  <ChatQuestionWrapper
                    question={q}
                    value={val}
                    onChange={(v) => onChange?.(qid, v)}
                    onSubmitSelection={(
                      qid2: string,
                      value2: unknown,
                      display: string,
                    ) => onSubmitSelection?.(qid2, value2, display)}
                    onFileUpload={onFileUpload}
                  />
                </div>
              ) : null}
              {/* Strictly ignore any text after the slot to prevent monologue leakage */}
            </div>
          );
        }
        return (
          <Response
            key={`t-${index}`}
            remarkPlugins={[remarkSlots]}
            components={components}
            parseIncompleteMarkdown={true}
          >
            {text}
          </Response>
        );
      })}
    </div>
  );
}
