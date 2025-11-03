"use client";
import * as React from "react";

const SLOT_REGEX =
  /::PresentQuestionInputComponent\s+qId=['"]([^'"<>]+)['"]::/i;

export type UIMessage = {
  id?: string | number;
  role: string;
  parts?: Array<any>;
};

export function useSlotBridge(opts: {
  messages: UIMessage[];
  onSlot: (qId: string) => void;
}): void {
  const { messages, onSlot } = opts;
  const signatureRef = React.useRef<string>("");

  React.useEffect(() => {
    const assistants = messages.filter((m) => m?.role === "assistant");
    if (assistants.length === 0) return;
    const last = assistants[assistants.length - 1];
    const parts = Array.isArray(last?.parts) ? last.parts : [];
    let slotId: string | null = null;
    for (const p of parts) {
      const text = typeof p?.text === "string" ? p.text : undefined;
      if (!text) continue;
      const m = text.match(SLOT_REGEX);
      if (m && m[1]) {
        slotId = m[1];
        break;
      }
    }
    if (!slotId) return;
    const sig = `${String(last?.id ?? assistants.length)}:${slotId}`;
    if (signatureRef.current === sig) return;
    signatureRef.current = sig;
    try {
      onSlot(slotId);
    } catch {}
  }, [messages, onSlot]);
}
