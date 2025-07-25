"use client";

import { Message as MessageContainer, MessageContent } from "@formlink/ui";

import { Message as MessageType } from "@ai-sdk/react";
import { cn } from "@/lib/utils";
import { motion } from "motion/react";

type MessageUserProps = {
  hasScrollAnchor?: boolean;
  message: MessageType;
  id: string;
};

export function MessageUser({ hasScrollAnchor, message }: MessageUserProps) {
  return (
    <MessageContainer
      className={cn(
        "flex w-full max-w-3xl justify-end px-3 py-0.5 sm:px-4 md:px-6",
        hasScrollAnchor && "min-h-scroll-anchor",
      )}
    >
      <motion.div
        className="group relative max-w-[90%] sm:max-w-[85%] md:max-w-[70%]"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      >
        <div className="flex flex-col gap-2">
          {message?.content ? (
            // Handle content as a simple string
            <MessageContent
              className="bg-primary/10 dark:bg-primary/20 
                         rounded-2xl px-4 py-1 shadow-sm
                         transition-all duration-200
                         prose prose-sm dark:prose-invert max-w-none
                         prose-p:my-1 prose-headings:mt-3 prose-headings:mb-2
                         prose-strong:font-semibold
                         prose-code:px-1 prose-code:py-0.5 prose-code:rounded-md
                         prose-code:bg-background prose-code:text-sm
                         prose-pre:my-2 prose-pre:p-3
                         prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5"
              markdown={true}
            >
              {message.content}
            </MessageContent>
          ) : (
            // Handle parts if content is not available
            message?.parts?.map((part, index) => {
              const { type } = part;
              const key = `part-${index}`;

              if (type === "text") {
                return (
                  <MessageContent
                    key={key}
                    className="bg-primary/10 dark:bg-primary/20 
                               rounded-2xl px-4 py-1 shadow-sm
                               transition-all duration-200
                               prose prose-sm dark:prose-invert max-w-none
                               prose-p:my-1 prose-headings:mt-3 prose-headings:mb-2
                               prose-strong:font-semibold
                               prose-code:px-1 prose-code:py-0.5 prose-code:rounded-md
                               prose-code:bg-background prose-code:text-sm
                               prose-pre:my-2 prose-pre:p-3
                               prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5"
                    markdown={true}
                  >
                    {part.text}
                  </MessageContent>
                );
              }

              return null;
            })
          )}
        </div>
      </motion.div>
    </MessageContainer>
  );
}
