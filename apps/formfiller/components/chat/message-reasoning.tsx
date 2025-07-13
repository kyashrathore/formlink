"use client";

import { useState } from "react";
import { CircleNotch } from "@phosphor-icons/react/CircleNotch";
import { CaretDown } from "@phosphor-icons/react/CaretDown";
import { MessageContent } from "@formlink/ui";
interface MessageReasoningProps {
  isLoading: boolean;
  reasoning: string;
}

export function MessageReasoning({
  isLoading,
  reasoning,
}: MessageReasoningProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className="flex flex-col">
      {isLoading ? (
        <div className="flex flex-row gap-2 items-center">
          <div className="font-medium">Reasoning</div>
          <div className="animate-spin">
            <CircleNotch size={16} />
          </div>
        </div>
      ) : (
        <div className="flex flex-row gap-2 items-center">
          <div className="font-medium">Reasoned for a few seconds</div>
          <button
            data-testid="message-reasoning-toggle"
            type="button"
            className="cursor-pointer"
            onClick={() => {
              setIsExpanded(!isExpanded);
            }}
          >
            <CaretDown
              size={16}
              className={isExpanded ? "transform rotate-180" : ""}
            />
          </button>
        </div>
      )}

      {isExpanded && (
        <div
          data-testid="message-reasoning"
          className="pl-4 text-zinc-600 dark:text-zinc-400 border-l flex flex-col gap-4 mt-2 mb-1"
        >
          <MessageContent markdown={true}>{reasoning}</MessageContent>
        </div>
      )}
    </div>
  );
}
