"use client";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
  Loader,
  Message,
  MessageAvatar,
  MessageContent,
  PromptInput,
  PromptInputButton,
  PromptInputModelSelect,
  PromptInputModelSelectContent,
  PromptInputModelSelectItem,
  PromptInputModelSelectTrigger,
  PromptInputModelSelectValue,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  Response,
  Suggestion,
  Suggestions,
} from "@formlink/ui/ai-elements";
import type { Meta, StoryObj } from "@storybook/nextjs";
import { GlobeIcon, MicIcon } from "lucide-react";
import * as React from "react";

type Story = StoryObj;

const meta: Meta = {
  title: "Chat/AI Elements — Polished",
} as Meta;
export default meta;

type Msg = {
  id: string;
  role: "user" | "assistant";
  text: string;
  avatar?: string;
  name?: string;
  sources?: Array<{ href: string; title: string }>;
};

const initial: Msg[] = [
  {
    id: "u1",
    role: "user",
    text: "Can you explain how to use React hooks effectively?",
    avatar: "https://github.com/haydenbleasel.png",
    name: "Hayden Bleasel",
  },
  {
    id: "a1",
    role: "assistant",
    text: "React hooks are a powerful feature that let you use state and other React features without writing classes. Here are some tips…",
    avatar: "https://github.com/openai.png",
    name: "Assistant",
  },
];

export const PolishedChat: Story = {
  render: () => <Demo />,
};

function Demo() {
  const [messages, setMessages] = React.useState<Msg[]>(initial);
  const [input, setInput] = React.useState("");
  const [status, setStatus] = React.useState<
    "ready" | "submitted" | "streaming"
  >("ready");
  const [model, setModel] = React.useState("gpt-4");
  const [useWebSearch, setUseWebSearch] = React.useState(false);
  const [useMic, setUseMic] = React.useState(false);

  const suggestions = [
    "What are the latest trends in AI?",
    "Explain quantum computing",
    "Best practices for React development",
  ];

  function addUserMessage(text: string) {
    const msg: Msg = {
      id: `u-${Date.now()}`,
      role: "user",
      text,
      avatar: "https://github.com/haydenbleasel.png",
      name: "You",
    };
    setMessages((m) => [...m, msg]);
  }

  function streamAssistant(text: string) {
    const id = `a-${Date.now()}`;
    const base: Msg = {
      id,
      role: "assistant",
      text: "",
      avatar: "https://github.com/openai.png",
      name: "Assistant",
    };
    setMessages((m) => [...m, base]);
    setStatus("streaming");
    const words = text.split(" ");
    let i = 0;
    const tick = () => {
      setMessages((m) =>
        m.map((x) =>
          x.id === id ? { ...x, text: words.slice(0, i).join(" ") } : x,
        ),
      );
      i += Math.max(1, Math.round(Math.random() * 3));
      if (i <= words.length) requestAnimationFrame(tick);
      else setStatus("ready");
    };
    requestAnimationFrame(tick);
  }

  function handleSubmit(
    message?: { text?: string; files?: Array<any> },
    e?: React.FormEvent<HTMLFormElement>,
  ) {
    e?.preventDefault?.();
    const text = (message?.text ?? input).trim();
    if (!text) return;
    setStatus("submitted");
    addUserMessage(text);
    setInput("");
    setTimeout(() => {
      streamAssistant(
        "Here’s a concise guide: useState for local state, useEffect for syncing with external systems, useMemo for heavy derived values, and useCallback for stable function refs.",
      );
    }, 300);
  }

  return (
    <div className="flex flex-col h-[90vh]">
      <Conversation className="flex-1 bg-background/60">
        <ConversationContent>
          {messages.map((m) => (
            <Message key={m.id} from={m.role}>
              <MessageContent
                className={[
                  // Polished bubbles — subtle gradient + border + shadow
                  "border shadow-sm",
                  m.role === "assistant"
                    ? "bg-muted/70 border-border/60"
                    : "bg-primary/10 border-primary/30",
                ].join(" ")}
              >
                <Response>{m.text}</Response>
              </MessageContent>
              <MessageAvatar src={m.avatar || ""} name={m.name} />
            </Message>
          ))}
          {status === "streaming" && (
            <Message from="assistant">
              <MessageContent className="bg-muted/40 border border-border/50">
                <div className="inline-flex items-center gap-2 text-sm">
                  <Loader size={16} />
                  <span>Thinking…</span>
                </div>
              </MessageContent>
              <MessageAvatar
                src="https://github.com/openai.png"
                name="Assistant"
              />
            </Message>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="shrink-0 border-t bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-3xl mx-auto py-3 px-4">
          <Suggestions className="mb-2">
            {suggestions.map((s) => (
              <Suggestion
                key={s}
                suggestion={s}
                onClick={() => {
                  setInput(s);
                  handleSubmit();
                }}
              />
            ))}
          </Suggestions>
          <PromptInput onSubmit={handleSubmit}>
            <PromptInputTextarea
              value={input}
              onChange={(e) => setInput((e as any).target.value)}
              placeholder="Ask anything…"
            />
            <PromptInputTools>
              <PromptInputButton
                onClick={() => setUseMic((v) => !v)}
                variant={useMic ? "default" : "ghost"}
              >
                <MicIcon size={16} />
                <span className="sr-only">Mic</span>
              </PromptInputButton>
              <PromptInputButton
                onClick={() => setUseWebSearch((v) => !v)}
                variant={useWebSearch ? "default" : "ghost"}
              >
                <GlobeIcon size={16} />
                <span>Search</span>
              </PromptInputButton>
              <PromptInputModelSelect value={model} onValueChange={setModel}>
                <PromptInputModelSelectTrigger>
                  <PromptInputModelSelectValue />
                </PromptInputModelSelectTrigger>
                <PromptInputModelSelectContent>
                  {["gpt-4", "gpt-3.5-turbo", "deepseek-r1"].map((m) => (
                    <PromptInputModelSelectItem key={m} value={m}>
                      {m}
                    </PromptInputModelSelectItem>
                  ))}
                </PromptInputModelSelectContent>
              </PromptInputModelSelect>
            </PromptInputTools>
            <PromptInputSubmit
              disabled={!input || status === "streaming"}
              status={status}
            />
          </PromptInput>
        </div>
      </div>
    </div>
  );
}
