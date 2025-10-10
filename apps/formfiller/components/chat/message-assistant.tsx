import type { MessagePart } from "@/lib/types";
import { UIMessage as MessageType } from "@ai-sdk/react";
import { Message, MessageContent, Response } from "@formlink/ui/ai-elements";
import { cn } from "@formlink/ui/lib/utils";
import React from "react";
import { shallow } from "zustand/shallow";
import { QuestionWrapper } from "./QuestionWrapper";
import { remarkSlots } from "./remark-slots-streamdown";
import { useChatStore } from "./store/useChatStore";
import { debugLog } from "./utils/debug";

type MessageAssistantProps = {
  message: MessageType;
  isLast?: boolean;
  hasScrollAnchor?: boolean;
  handleFileUpload?: (questionId: string, file: File) => Promise<void>;
  onSubmitSelection?: (
    questionId: string,
    value: unknown,
    displayText: string,
  ) => Promise<void>;
};

function partsSignature(
  parts: MessagePart[] = [],
  includeText = false,
): string {
  return parts
    .map((part, index) => {
      const t = (part as any)?.type;
      if (includeText && t === "text") {
        const text = (part as any)?.text ?? "";
        return `${index}:${t}:${text}`;
      }
      return `${index}:${t}`;
    })
    .join("|");
}

const MessageAssistantComponent = ({
  message,
  isLast,
  hasScrollAnchor,
  handleFileUpload,
  onSubmitSelection,
}: MessageAssistantProps) => {
  const { id: messageId, parts } = message || {};

  const { presentedQuestionMessageId } = useChatStore(
    (state) => ({
      presentedQuestionMessageId: state.presentedQuestionMessageId,
    }),
    shallow,
  );
  // Log once per message id to avoid noisy output during streaming
  const loggedMsgIdsRef = React.useRef<Set<string>>(new Set());

  if (messageId && !loggedMsgIdsRef.current.has(String(messageId))) {
    debugLog("MessageAssistant mount", {
      messageId,
      isLast,
      presentedQuestionMessageId,
      partTypes: Array.isArray(parts) ? parts.map((p: any) => p?.type) : [],
    });
    loggedMsgIdsRef.current.add(String(messageId));
  }
  const SLOT_RE = /::PresentQuestionInputComponent\s+qId=["']([^"']+)["']::/;
  // Build markdown components once per message; this keeps hook order stable.
  const components = React.useMemo(() => {
    return {
      p: ({
        children,
        ...props
      }: React.HTMLAttributes<HTMLParagraphElement>) => {
        const hasFormComponent = React.Children.toArray(children).some(
          (child) =>
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (child as any)?.type?.displayName === "QuestionWrapper" ||
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (child as any)?.type?.name === "QuestionWrapper" ||
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (child as any)?.props?.qId !== undefined,
        );
        if (hasFormComponent) {
          return <div {...props}>{children}</div>;
        }
        return <p {...props}>{children}</p>;
      },
      PresentQuestionInputComponent: ({ qId }: { qId: string | number }) => (
        <QuestionWrapper
          questionId={String(qId)}
          messageId={messageId}
          isLast={isLast}
          variant="assistant"
          handleFileUpload={handleFileUpload}
          onSubmitSelection={onSubmitSelection}
        />
      ),
    } as any;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    messageId,
    isLast,
    presentedQuestionMessageId,
    handleFileUpload,
    onSubmitSelection,
  ]);

  return (
    <Message
      from="assistant"
      className={cn(
        "w-full max-w-3xl",
        hasScrollAnchor && "min-h-scroll-anchor",
      )}
    >
      <MessageContent className="bg-transparent">
        {parts
          ?.filter((part) =>
            typeof part === "object" && part !== null && "type" in part
              ? (part as { type: string }).type !== "reasoning"
              : false,
          )
          ?.map((part, index: number) => {
            const { type } = part;
            const key = `part-${index}`;

            if (type === "text") {
              const text = part.text || "";
              const m = text.match(SLOT_RE);
              if (m && m[1]) {
                const qid = m[1];
                const start = m.index ?? 0;
                const end = start + m[0].length;
                const before = text.slice(0, start);
                const after = text.slice(end);
                const beforeTrim = before.trim();
                const afterTrim = after.trim();

                // For non-last assistant messages, collapse to combined text and skip input.
                if (!isLast) {
                  const combined = `${before}${after}`.trim();
                  return combined ? (
                    <Response
                      key={key}
                      remarkPlugins={[remarkSlots]}
                      parseIncompleteMarkdown={false}
                      components={components}
                    >
                      {combined}
                    </Response>
                  ) : null;
                }

                if (afterTrim) {
                  // Prompt contract says: no text after slot; ignore if present.
                  debugLog("slot.non_compliant_after_text", {
                    messageId,
                    afterLength: afterTrim.length,
                  });
                }

                return (
                  <div key={key}>
                    {beforeTrim ? (
                      <Response
                        remarkPlugins={[remarkSlots]}
                        parseIncompleteMarkdown={false}
                        components={components}
                      >
                        {before}
                      </Response>
                    ) : null}
                    <QuestionWrapper
                      questionId={String(qid)}
                      messageId={messageId}
                      isLast={isLast}
                      variant="assistant"
                      handleFileUpload={handleFileUpload}
                      onSubmitSelection={onSubmitSelection}
                    />
                  </div>
                );
              }

              return (
                <Response
                  key={key}
                  remarkPlugins={[remarkSlots]}
                  parseIncompleteMarkdown={false}
                  components={components}
                >
                  {text}
                </Response>
              );
            }

            return null;
          })}
      </MessageContent>
    </Message>
  );
};

function areMessageAssistantPropsEqual(
  prev: MessageAssistantProps,
  next: MessageAssistantProps,
): boolean {
  if (prev.isLast !== next.isLast) return false;
  if (prev.hasScrollAnchor !== next.hasScrollAnchor) return false;
  if (prev.handleFileUpload !== next.handleFileUpload) return false;
  if (prev.onSubmitSelection !== next.onSubmitSelection) return false;
  if (prev.message.id !== next.message.id) return false;
  if (prev.message.role !== next.message.role) return false;
  // Only the last assistant message should update on text changes.
  const prevSig = partsSignature(
    (prev.message.parts as MessagePart[]) || [],
    Boolean(prev.isLast),
  );
  const nextSig = partsSignature(
    (next.message.parts as MessagePart[]) || [],
    Boolean(next.isLast),
  );
  return prevSig === nextSig;
}

export const MessageAssistant = React.memo(
  MessageAssistantComponent,
  areMessageAssistantPropsEqual,
);
