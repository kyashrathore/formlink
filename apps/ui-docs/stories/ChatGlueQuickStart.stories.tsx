"use client";
import * as React from "react";
import type { Meta, StoryObj } from "@storybook/nextjs";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
  PromptInput,
  PromptInputTextarea,
  PromptInputSubmit,
} from "@formlink/ui/ai-elements";
import {
  useSlotBridge,
  useSubmitSelection,
  useFileUploadSubmission,
  useToolDispatcher,
} from "@formlink/runtime/ui/react";

type Story = StoryObj;

const meta: Meta = {
  title: "Chat/Glue Quickstart",
} as Meta;
export default meta;

type UIMessage = { id?: string; role: string; parts?: Array<any> };

function MockTransport() {
  const [messages, setMessages] = React.useState<UIMessage[]>([]);
  const [input, setInput] = React.useState("");
  const [status, setStatus] = React.useState<
    "ready" | "streaming" | "submitted"
  >("ready");
  const [currentQuestionId, setCurrentQuestionId] = React.useState<
    string | null
  >("q1");

  const sendMessage = React.useCallback(
    async (msg: { text: string }, opts?: { body?: Record<string, any> }) => {
      setStatus("submitted");
      setMessages((prev) => [
        ...prev,
        { role: "user", parts: [{ type: "text", text: msg.text }] },
      ]);
      const just = opts?.body?.justSavedAnswer;
      // mock assistant that emits a slot and a tool-saveAnswer part when selection submitted
      setTimeout(() => {
        const parts: any[] = [];
        if (just?.questionId) {
          parts.push({
            type: "tool-saveAnswer",
            output: {
              saved: true,
              questionId: just.questionId,
              value: just.value,
              nextQuestionId: "q2",
            },
          });
        }
        parts.push({
          type: "text",
          text: `Got it.::PresentQuestionInputComponent qId='${just?.questionId ? "q2" : (currentQuestionId ?? "q1")}'::`,
        });
        setMessages((prev) => [...prev, { role: "assistant", parts }]);
        setStatus("ready");
      }, 300);
    },
    [currentQuestionId],
  );

  // Slot bridge: parse last assistant and set currentQuestionId
  useSlotBridge({ messages, onSlot: setCurrentQuestionId });

  const toolDispatcher = useToolDispatcher({
    onApplyResult: (tool, result) => {
      if (tool === "saveAnswer" && result?.nextQuestionId)
        setCurrentQuestionId(result.nextQuestionId);
    },
  });

  React.useEffect(() => {
    const last = messages[messages.length - 1];
    if (last?.role === "assistant") toolDispatcher.apply(last);
  }, [messages]);

  const { submitSelection } = useSubmitSelection({
    sendMessage,
    currentQuestionId,
  });
  const { handleFileUpload } = useFileUploadSubmission({
    uploadApi: "/api/upload",
    submitSelection,
  });

  return (
    <div className="max-w-3xl mx-auto p-6">
      <p className="text-sm text-muted-foreground mb-3">
        This story uses a mocked transport to demonstrate the runtime chat glue
        primitives with ai-elements.
      </p>
      <Conversation className="border rounded-md h-[60vh]">
        <ConversationContent>
          {messages.map((m, i) => (
            <div key={i} className="w-full text-sm p-2">
              <div className="font-medium">{m.role}</div>
              {m.parts?.map((p: any, j: number) => (
                <pre key={j} className="whitespace-pre-wrap text-xs opacity-80">
                  {JSON.stringify(p)}
                </pre>
              ))}
            </div>
          ))}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="mt-3 text-sm">
        Current slot qId: <code>{currentQuestionId ?? "(none)"}</code>
      </div>

      <div className="mt-4">
        <div className="flex gap-2">
          <button
            className="px-3 py-1.5 rounded border"
            onClick={() =>
              submitSelection(currentQuestionId ?? "q1", "A", "Selected A")
            }
          >
            Select A
          </button>
          <button
            className="px-3 py-1.5 rounded border"
            onClick={() =>
              submitSelection(currentQuestionId ?? "q1", "B", "Selected B")
            }
          >
            Select B
          </button>
          <button
            className="px-3 py-1.5 rounded border"
            onClick={() =>
              handleFileUpload(
                currentQuestionId ?? "q1",
                new File(["hello"], "hello.txt"),
              )
            }
          >
            Mock Upload
          </button>
        </div>
      </div>

      <PromptInput
        onSubmit={({ text }: any) =>
          sendMessage(
            { text },
            { body: { submissionBehavior: "manualAnswer", currentQuestionId } },
          )
        }
        className="mt-4"
      >
        <PromptInputTextarea
          value={input}
          onChange={(e) => setInput((e as any).target.value)}
        />
        <PromptInputSubmit status={status} disabled={!input} />
      </PromptInput>
    </div>
  );
}

export const Quickstart: Story = {
  render: () => <MockTransport />,
};
