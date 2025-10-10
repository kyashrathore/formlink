"use client";

import { Message as MessageContainer, MessageContent } from "@formlink/ui";

import { UIMessage as MessageType } from "@ai-sdk/react";
import { cn } from "@/lib/utils";
import { motion } from "motion/react";
import React from "react";

type MessageUserProps = {
  hasScrollAnchor?: boolean;
  message: MessageType;
  id: string;
};

function partsSignature(parts: any[] = []): string {
  return parts.map((p, i) => `${i}:${p?.type}`).join("|");
}

function MessageUserComponent({ hasScrollAnchor, message }: MessageUserProps) {
  return (
    <MessageContainer
      from="user"
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
          {(message as any)?.content ? (
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
            >
              {(message as any).content || ""}
            </MessageContent>
          ) : (
            // Handle parts if content is not available
            (message as any)?.parts?.map((part: any, index: number) => {
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
                  >
                    {part.text || ""}
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

function areMessageUserPropsEqual(
  prev: MessageUserProps,
  next: MessageUserProps,
) {
  if (prev.hasScrollAnchor !== next.hasScrollAnchor) return false;
  // Narrow comparisons to id/role/parts signature to avoid false positives
  const prevMsg = prev.message as any;
  const nextMsg = next.message as any;
  if (prevMsg?.id !== nextMsg?.id) return false;
  if (prevMsg?.role !== nextMsg?.role) return false;
  const prevSig = partsSignature(
    Array.isArray(prevMsg?.parts) ? prevMsg.parts : [],
  );
  const nextSig = partsSignature(
    Array.isArray(nextMsg?.parts) ? nextMsg.parts : [],
  );
  return prevSig === nextSig;
}

export const MessageUser = React.memo(
  MessageUserComponent,
  areMessageUserPropsEqual,
);
