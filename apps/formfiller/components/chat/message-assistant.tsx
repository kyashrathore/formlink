import React from "react";
import { UIMessage as MessageType } from "@ai-sdk/react";
import { Message, MessageContent, Response } from "@formlink/ui/ai-elements";
import { cn } from "@formlink/ui/lib/utils";
import { useQuestionRenderer } from "./hooks/useQuestionRenderer";
import { QuestionWrapper } from "./QuestionWrapper";
import { remarkSlots } from "./remark-slots-streamdown";
import type { MessagePart } from "@/lib/types";

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

export function MessageAssistant({
  message,
  isLast,
  hasScrollAnchor,
  handleFileUpload,
  onSubmitSelection,
}: MessageAssistantProps) {
  const { id: messageId, parts } = message || {};
  const { components } = useQuestionRenderer(
    messageId,
    isLast,
    "assistant",
    handleFileUpload,
    onSubmitSelection,
  );

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
              return (
                <Response
                  key={key}
                  remarkPlugins={[remarkSlots]}
                  parseIncompleteMarkdown={false}
                  components={
                    {
                      ...components,
                      p: ({
                        children,
                        ...props
                      }: React.HTMLAttributes<HTMLParagraphElement>) => {
                        // Check if paragraph contains form components that should not be wrapped in <p>
                        const hasFormComponent = React.Children.toArray(
                          children,
                        ).some(
                          (child) =>
                            // Heuristic markers
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            (child as any)?.type?.displayName ===
                              "QuestionWrapper" ||
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            (child as any)?.props?.qId !== undefined,
                        );

                        if (hasFormComponent) {
                          return <div {...props}>{children}</div>;
                        }
                        return <p {...props}>{children}</p>;
                      },
                      PresentQuestionInputComponent: ({
                        qId,
                      }: {
                        qId: string | number;
                      }) => (
                        <QuestionWrapper
                          questionId={String(qId)}
                          messageId={messageId}
                          isLast={isLast}
                          variant="assistant"
                          handleFileUpload={handleFileUpload}
                          onSubmitSelection={onSubmitSelection}
                        />
                      ),
                    } as any
                  }
                >
                  {part.text || ""}
                </Response>
              );
            }

            return null;
          })}
      </MessageContent>
    </Message>
  );
}
