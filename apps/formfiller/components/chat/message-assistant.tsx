import { Message, MessageContent } from "@formlink/ui";
import { cn } from "@formlink/ui/lib/utils";
import { Message as MessageType } from "@ai-sdk/react";
import { MessageReasoning } from "./message-reasoning";
import { useQuestionRenderer } from "./hooks/useQuestionRenderer";
import type { MessagePart } from "@/lib/types";
import { motion } from "motion/react";

type MessageAssistantProps = {
  message: MessageType;
  isLast?: boolean;
  hasScrollAnchor?: boolean;
  handleFileUpload?: (questionId: string, file: File) => Promise<void>;
};

export function MessageAssistant({
  message,
  isLast,
  hasScrollAnchor,
  handleFileUpload,
}: MessageAssistantProps) {
  const { id: messageId, parts } = message || {};
  const { components } = useQuestionRenderer(
    messageId,
    isLast,
    "assistant",
    handleFileUpload,
  );

  return (
    <Message
      className={cn(
        "group flex w-full max-w-3xl items-start gap-4 px-3 py-0.5 sm:px-4 md:px-6",
        hasScrollAnchor && "min-h-scroll-anchor",
      )}
    >
      <motion.div
        className={cn(
          "flex max-w-[90%] sm:max-w-[85%] md:max-w-[70%] flex-col gap-2",
          isLast && "pb-8",
        )}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      >
        {message?.content ? (
          // Handle content as a simple string
          <MessageContent
            className="bg-transparent prose prose-sm dark:prose-invert max-w-none
                       prose-p:my-1.5 prose-headings:mt-4 prose-headings:mb-3
                       prose-strong:font-semibold prose-strong:text-foreground
                       prose-code:px-1 prose-code:py-0.5 prose-code:rounded-md
                       prose-code:text-sm
                       prose-pre:my-3 prose-pre:p-4
                       prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5
                       prose-blockquote:border-l-2 prose-blockquote:border-muted-foreground/20
                       prose-blockquote:pl-4 prose-blockquote:italic"
            markdown={true}
            components={components}
          >
            {message.content}
          </MessageContent>
        ) : (
          // Handle parts if content is not available
          parts?.map((part: MessagePart, index: number) => {
            const { type } = part;
            const key = `part-${index}`;

            if (type === "text") {
              return (
                <MessageContent
                  key={key}
                  className="bg-transparent prose prose-sm dark:prose-invert max-w-none
                           prose-p:my-1.5 prose-headings:mt-4 prose-headings:mb-3
                           prose-strong:font-semibold prose-strong:text-foreground
                           prose-code:px-1 prose-code:py-0.5 prose-code:rounded-md
                           prose-code:text-sm
                           prose-pre:my-3 prose-pre:p-4
                           prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5
                           prose-blockquote:border-l-2 prose-blockquote:border-muted-foreground/20
                           prose-blockquote:pl-4 prose-blockquote:italic"
                  markdown={true}
                  components={components}
                >
                  {part.text}
                </MessageContent>
              );
            }

            if (type === "reasoning") {
              return (
                <MessageReasoning
                  key={key}
                  isLoading={!!isLast}
                  reasoning={part.reasoning}
                />
              );
            }

            return null;
          })
        )}
      </motion.div>
    </Message>
  );
}
