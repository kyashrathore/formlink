/**
 * Example: Chat Form — Gather Product Pain Points
 * Purpose: A complete ai-sdk chat shell demonstrating a full conversational experience.
 * API/props: Exports `PainPointsChatExample`.
 * State: `useChatRuntime` manages messages and status; UI reacts to status changes.
 * Niceties: Shows loading indicators and includes the user input prompt.
 */

import React from "react";
import { useChatRuntime, ResponseWrapper } from "@formlink/runtime/chat";
import { AnimatePresence, motion } from "motion/react";
import {
  Conversation as AIConversation,
  ConversationContent,
  Message,
  MessageContent,
} from "@formlink/ui/ai-elements";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputSubmit,
} from "@formlink/ui/ai-elements";

// Minimal schema sketch for chat; backend is authoritative.
const form: any = {
  id: "pain_points_chat",
  title: "Tell us your pain points",
  questions: [
    {
      id: "q1_topic",
      kind: "text",
      label: "What hurts most in your workflow?",
      required: true,
    },
    { id: "q2_detail", kind: "text", label: "Give a concrete recent example" },
    {
      id: "q3_impact",
      kind: "linearScale",
      label: "Impact (1–5)",
      config: { start: 1, end: 5, step: 1 },
    },
  ],
};

export function PainPointsChatExample() {
  const [input, setInput] = React.useState("");
  const { status, messages, start, sendSelection, sendMessage } =
    useChatRuntime({ api: "/api/ai/chat-assist", form });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    sendMessage(input);
    setInput("");
  };

  if (status === "idle") {
    return (
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">{form.title}</h1>
        <button
          onClick={start}
          className="px-5 py-2 bg-blue-600 text-white rounded-lg font-semibold"
        >
          Start Conversation
        </button>
      </div>
    );
  }

  if (status === "completed") {
    return (
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Thank You!</h1>
        <p>Your feedback has been recorded.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full max-w-3xl mx-auto">
      <AIConversation className="relative flex-1 w-full overflow-y-auto">
        <ConversationContent className="flex w-full flex-col items-center">
          {messages.map((m, i) => (
            <Message key={m.id} from={m.role}>
              <MessageContent>
                {m.role === "assistant" ? (
                  <ResponseWrapper
                    message={m}
                    isLast={i === messages.length - 1}
                    form={form}
                    onSubmitSelection={sendSelection}
                  />
                ) : (
                  <span className="whitespace-pre-wrap">{m.content}</span>
                )}
              </MessageContent>
            </Message>
          ))}
        </ConversationContent>
      </AIConversation>

      <AnimatePresence>
        <motion.div
          key="prompt-input"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
        >
          <div className="relative order-2 px-2 pb-3 sm:pb-4 md:order-1">
            <PromptInput
              className="border-input bg-popover relative z-10 overflow-hidden border p-0 pb-2 shadow-xs backdrop-blur-xl"
              onSubmit={handleSubmit}
            >
              <PromptInputTextarea
                placeholder="Your answer..."
                className="mt-2 ml-2 min-h-[44px] text-base leading-[1.3] sm:text-base md:text-base !bg-popover"
                value={input}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                  setInput(e.target.value)
                }
              />
              <div className="absolute bottom-2 right-2">
                <PromptInputSubmit
                  className="h-9 w-9 cursor-pointer rounded-full transition-all duration-300 ease-out"
                  disabled={!input.trim() || status === "streaming"}
                  status={status}
                  aria-label="Send answer"
                />
              </div>
            </PromptInput>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
