import React from "react";
import { UIMessage as MessageType } from "@ai-sdk/react";
import { Message, MessageContent, Response } from "@formlink/ui/ai-elements";
import { cn } from "@formlink/ui/lib/utils";
import { useQuestionRenderer } from "./hooks/useQuestionRenderer";
import { QuestionWrapper } from "./QuestionWrapper";
import { remarkSlots } from "./remark-slots-streamdown";

type MessageAssistantProps = {
  message: MessageType;
  isLast?: boolean;
  hasScrollAnchor?: boolean;
  handleFileUpload?: (questionId: string, file: File) => Promise<void>;
  onSubmitSelection?: (
    questionId: string,
    value: any,
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
          ?.filter((part: any) => part.type !== "reasoning")
          ?.map((part: any, index: number) => {
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
                      p: ({ children, ...props }: any) => {
                        // Check if paragraph contains form components that should not be wrapped in <p>
                        const hasFormComponent = React.Children.toArray(
                          children,
                        ).some(
                          (child: any) =>
                            child?.type?.displayName === "QuestionWrapper" ||
                            child?.props?.qId !== undefined ||
                            (typeof child === "object" &&
                              child?.props &&
                              "qId" in child.props),
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
