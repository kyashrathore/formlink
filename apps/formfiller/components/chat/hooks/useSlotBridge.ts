"use client";

import { useEffect, useMemo, useRef } from "react";
import type { UIMessage as MessageType } from "@ai-sdk/react";
import { useChatStore } from "../store/useChatStore";
import { debugLog } from "../utils/debug";

const SLOT_REGEX = /::PresentQuestionInputComponent\s+qId=["']([^"']+)["']::/i;

type UseSlotBridgeOptions = {
  messages: MessageType[];
};

function extractSlotId(message: MessageType): string | null {
  const parts = Array.isArray(message?.parts) ? message.parts : [];
  for (const part of parts) {
    if (part?.type === "text" && typeof part.text === "string") {
      const match = part.text.match(SLOT_REGEX);
      if (match && match[1]) {
        return match[1];
      }
    }
  }
  return null;
}

export function useSlotBridge({ messages }: UseSlotBridgeOptions) {
  const setCurrentQuestionId = useChatStore(
    (state) => state.setCurrentQuestionId,
  );
  const setPresentedMessageId = useChatStore(
    (state) => state.setPresentedQuestionMessageId,
  );

  const processedMessageIds = useRef<Set<string>>(new Set());
  const assistantMessages = useMemo(
    () => messages.filter((m) => m.role === "assistant"),
    [messages],
  );

  useEffect(() => {
    if (assistantMessages.length === 0) {
      processedMessageIds.current.clear();
      return;
    }

    const lastAssistant = assistantMessages.at(-1);
    if (!lastAssistant) return;
    const rawId = lastAssistant?.id ? String(lastAssistant.id) : "";
    const slotId = extractSlotId(lastAssistant);
    if (!slotId) return;
    const signature = rawId || `${slotId}-last`;
    if (processedMessageIds.current.has(signature)) return;
    processedMessageIds.current.add(signature);
    debugLog("slot-bridge", {
      rawId,
      signature,
      slotId,
      partsCount: Array.isArray(lastAssistant.parts)
        ? lastAssistant.parts.length
        : 0,
    });
    setCurrentQuestionId(slotId);
    setPresentedMessageId(rawId || signature);
  }, [assistantMessages, setCurrentQuestionId, setPresentedMessageId]);
}
