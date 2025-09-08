"use client";

import type { Meta, StoryObj } from "@storybook/react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Conversation,
  ConversationContent,
  Message,
  MessageAvatar,
  MessageContent,
  PromptInput,
  PromptInputTextarea,
  PromptInputSubmit,
  UnifiedLikert,
  UnifiedMultiSelect,
  UnifiedLinearScale,
  UnifiedRating,
  UnifiedCountrySelect,
  UnifiedPhoneInput,
  UnifiedDatePicker,
  UnifiedAddressInput,
  UnifiedFileUpload,
  UnifiedRanking,
} from "@formlink/ui";

const meta: Meta = {
  title: "Form/Chat Dummy Flow",
} as Meta;

// Temporarily disable due to TypeScript conflicts
export default {
  ...meta,
  title: "Form/Chat Dummy Flow (Disabled)",
  parameters: {
    ...meta.parameters,
    docs: { disable: true },
  },
};
type Story = StoryObj;

type StepType =
  | { kind: "text"; id: string; title: string; description?: string }
  | {
      kind: "single";
      id: string;
      title: string;
      description?: string;
      options: { value: string; label: string }[];
    }
  | {
      kind: "multi";
      id: string;
      title: string;
      description?: string;
      options: { value: string; label: string }[];
    }
  | {
      kind: "linear";
      id: string;
      title: string;
      description?: string;
      config: {
        start: number;
        end: number;
        step?: number;
        startLabel?: string;
        endLabel?: string;
      };
    }
  | {
      kind: "rating";
      id: string;
      title: string;
      description?: string;
      max?: number;
    }
  | {
      kind: "likert";
      id: string;
      title: string;
      description?: string;
      options: string[];
    }
  | { kind: "country"; id: string; title: string; description?: string }
  | { kind: "phone"; id: string; title: string; description?: string }
  | { kind: "date"; id: string; title: string; description?: string }
  | { kind: "address"; id: string; title: string; description?: string }
  | { kind: "file"; id: string; title: string; description?: string }
  | { kind: "ranking"; id: string; title: string; description?: string };

const steps: StepType[] = [
  {
    kind: "text",
    id: "name",
    title: "What is your name?",
    description: "Type your answer in the input below and press Send",
  },
  { kind: "email", id: "email" } as any, // captured via text input
  {
    kind: "single",
    id: "color",
    title: "Pick a primary color",
    description: "Choose one option that you prefer",
    options: [
      { value: "red", label: "Red" },
      { value: "green", label: "Green" },
      { value: "blue", label: "Blue" },
    ],
  },
  {
    kind: "multi",
    id: "toppings",
    title: "Select your pizza toppings",
    description: "You can choose multiple and continue",
    options: [
      { value: "pepperoni", label: "Pepperoni" },
      { value: "mushrooms", label: "Mushrooms" },
      { value: "onions", label: "Onions" },
      { value: "olives", label: "Olives" },
    ],
  },
  {
    kind: "linear",
    id: "spice",
    title: "How spicy do you like it?",
    description: "1 is mild, 5 is very spicy",
    config: {
      start: 1,
      end: 5,
      step: 1,
      startLabel: "Mild",
      endLabel: "Very spicy",
    },
  },
  {
    kind: "rating",
    id: "stars",
    title: "Rate your overall excitement",
    description: "Give us some stars!",
    max: 5,
  },
  {
    kind: "likert",
    id: "likert",
    title: "I prefer chat experiences that are...",
    options: ["Minimal", "Balanced", "Playful"],
  },
  { kind: "country", id: "country", title: "Select your country" },
  { kind: "phone", id: "phone", title: "What is your phone number?" },
  { kind: "date", id: "date", title: "Pick a convenient date" },
  { kind: "address", id: "address", title: "Enter your address" },
  { kind: "ranking", id: "ranking", title: "Rank your priorities" },
  { kind: "file", id: "file", title: "Upload a file" },
];

export const Flow: Story = {
  render: () => {
    const [current, setCurrent] = useState(0);
    const [answers, setAnswers] = useState<Record<string, any>>({});
    const [inputValue, setInputValue] = useState("");
    const storageKey = "sb_chat_dummy_flow_v1";
    const themeKey = "sb_theme_preference";
    const [theme, setTheme] = useState<"light" | "dark">(
      () =>
        (typeof window !== "undefined" &&
          (localStorage.getItem(themeKey) as any)) ||
        "light",
    );

    const currentStep = steps[current];

    const advance = useCallback(
      (value: any) => {
        if (!currentStep) return;
        setAnswers((prev) => ({ ...prev, [currentStep.id]: value }));
        setCurrent((i) => Math.min(i + 1, steps.length));
      },
      [currentStep],
    );

    const formatAnswer = useCallback((step: StepType, value: any) => {
      switch (step.kind) {
        case "single": {
          const opt = step.options.find((o) => o.value === value);
          return opt?.label || String(value);
        }
        case "multi": {
          const labels = (value as string[]).map(
            (v) => step.options.find((o) => o.value === v)?.label || v,
          );
          return labels.join(", ");
        }
        case "linear":
          return String(value);
        case "rating":
          return `${value} / ${step.max || 5}`;
        default:
          return String(value);
      }
    }, []);

    const completed = current >= steps.length;

    // Load persisted state
    useEffect(() => {
      try {
        const raw = localStorage.getItem(storageKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === "object") {
            if (typeof parsed.current === "number") setCurrent(parsed.current);
            if (parsed.answers && typeof parsed.answers === "object")
              setAnswers(parsed.answers);
          }
        }
      } catch {}
    }, []);

    // Persist state
    useEffect(() => {
      try {
        localStorage.setItem(storageKey, JSON.stringify({ current, answers }));
      } catch {}
    }, [current, answers]);

    // Theme apply
    useEffect(() => {
      try {
        localStorage.setItem(themeKey, theme);
      } catch {}
      if (typeof document !== "undefined") {
        const root = document.documentElement;
        if (theme === "dark") root.classList.add("dark");
        else root.classList.remove("dark");
      }
    }, [theme]);

    const history = useMemo(() => {
      return steps.slice(0, Math.min(current, steps.length)).map((s) => ({
        step: s,
        value: answers[s.id],
      }));
    }, [current, answers]);

    return (
      <div className="w-full h-[740px] border rounded-lg grid grid-rows-[auto_1fr_auto] overflow-hidden bg-background">
        {/* Header controls */}
        <div className="flex items-center justify-between gap-3 px-4 py-2 border-b bg-card">
          <div className="text-sm text-muted-foreground">Dummy Chat Flow</div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className={`px-2 py-1 rounded border ${theme === "light" ? "bg-accent" : ""}`}
              onClick={() => setTheme("light")}
            >
              Light
            </button>
            <button
              type="button"
              className={`px-2 py-1 rounded border ${theme === "dark" ? "bg-accent" : ""}`}
              onClick={() => setTheme("dark")}
            >
              Dark
            </button>
            <button
              type="button"
              className="ml-3 px-2 py-1 rounded border"
              onClick={() => {
                setCurrent(0);
                setAnswers({});
                setInputValue("");
                try {
                  localStorage.removeItem(storageKey);
                } catch {}
              }}
            >
              Reset
            </button>
          </div>
        </div>
        <Conversation className="bg-background">
          <ConversationContent className="max-w-3xl mx-auto w-full">
            {/* Past messages */}
            {history.map(({ step, value }, idx) => (
              <React.Fragment key={step.id}>
                <Message from="assistant">
                  <MessageAvatar src="/assistant.png" name="AI" />
                  <MessageContent>
                    <div className="prose prose-sm dark:prose-invert">
                      <p className="m-0 font-medium">{step.title}</p>
                      {step.description && (
                        <p className="mt-1 text-muted-foreground">
                          {step.description}
                        </p>
                      )}
                    </div>
                  </MessageContent>
                </Message>
                <Message from="user">
                  <MessageAvatar src="/user.png" name="You" />
                  <MessageContent>{formatAnswer(step, value)}</MessageContent>
                </Message>
              </React.Fragment>
            ))}

            {/* Current step */}
            {!completed && currentStep && (
              <Message from="assistant">
                <MessageAvatar src="/assistant.png" name="AI" />
                <MessageContent>
                  <div className="prose prose-sm dark:prose-invert">
                    <p className="m-0 font-medium">{currentStep.title}</p>
                    {currentStep.description && (
                      <p className="mt-1 text-muted-foreground">
                        {currentStep.description}
                      </p>
                    )}
                  </div>
                  <div className="mt-4">
                    {currentStep.kind === "text" && (
                      <div className="text-muted-foreground text-sm">
                        Use the input at the bottom to answer.
                      </div>
                    )}
                    {currentStep.kind === ("email" as any) && (
                      <div className="text-muted-foreground text-sm">
                        Enter your email below and press Send.
                      </div>
                    )}
                    {currentStep.kind === "single" && (
                      <UnifiedMultiSelect
                        mode="chat"
                        options={currentStep.options}
                        value={
                          answers[currentStep.id]
                            ? [answers[currentStep.id]]
                            : []
                        }
                        maxSelections={1}
                        onChange={(vals) => advance(vals[0] || null)}
                      />
                    )}
                    {currentStep.kind === "multi" && (
                      <UnifiedMultiSelect
                        mode="chat"
                        options={currentStep.options}
                        value={answers[currentStep.id] || []}
                        onChange={(vals) =>
                          setAnswers((p) => ({ ...p, [currentStep.id]: vals }))
                        }
                        onSubmit={() => advance(answers[currentStep.id] || [])}
                      />
                    )}
                    {currentStep.kind === "linear" && (
                      <UnifiedLinearScale
                        mode="chat"
                        value={answers[currentStep.id] || null}
                        onChange={(v) => advance(v)}
                        onSubmit={() => {}}
                        config={currentStep.config}
                      />
                    )}
                    {currentStep.kind === "rating" && (
                      <UnifiedRating
                        mode="chat"
                        value={answers[currentStep.id] || 0}
                        max={currentStep.max || 5}
                        onChange={(v) =>
                          setAnswers((p) => ({ ...p, [currentStep.id]: v }))
                        }
                        onSubmit={() => advance(answers[currentStep.id] || 0)}
                      />
                    )}
                    {currentStep.kind === "likert" && (
                      <UnifiedLikert
                        mode="chat"
                        options={currentStep.options}
                        value={answers[currentStep.id] || null}
                        onChange={(v) => advance(v)}
                      />
                    )}
                    {currentStep.kind === "country" && (
                      <UnifiedCountrySelect
                        mode="chat"
                        value={answers[currentStep.id] || null}
                        onChange={(v) => advance(v)}
                      />
                    )}
                    {currentStep.kind === "phone" && (
                      <UnifiedPhoneInput
                        mode="chat"
                        value={answers[currentStep.id] || ""}
                        onChange={(v) =>
                          setAnswers((p) => ({ ...p, [currentStep.id]: v }))
                        }
                        onSubmit={() => advance(answers[currentStep.id] || "")}
                        showCountrySelector
                        showFlag
                      />
                    )}
                    {currentStep.kind === "date" && (
                      <UnifiedDatePicker
                        mode="chat"
                        value={answers[currentStep.id] || null}
                        onChange={(d) =>
                          setAnswers((p) => ({ ...p, [currentStep.id]: d }))
                        }
                        onSubmit={() =>
                          advance(answers[currentStep.id] || null)
                        }
                      />
                    )}
                    {currentStep.kind === "address" && (
                      <UnifiedAddressInput
                        mode="chat"
                        value={answers[currentStep.id] || null}
                        onChange={(v) =>
                          setAnswers((p) => ({ ...p, [currentStep.id]: v }))
                        }
                        onSubmit={() =>
                          advance(answers[currentStep.id] || null)
                        }
                      />
                    )}
                    {currentStep.kind === "ranking" && (
                      <UnifiedRanking
                        mode="chat"
                        options={[
                          { value: "a", label: "Speed" },
                          { value: "b", label: "Accuracy" },
                          { value: "c", label: "Simplicity" },
                        ]}
                        value={answers[currentStep.id] || []}
                        onChange={(v) =>
                          setAnswers((p) => ({ ...p, [currentStep.id]: v }))
                        }
                        onSubmit={() => advance(answers[currentStep.id] || [])}
                      />
                    )}
                    {currentStep.kind === "file" && (
                      <UnifiedFileUpload
                        mode="chat"
                        value={[]}
                        onChange={(f) =>
                          setAnswers((p) => ({ ...p, [currentStep.id]: f }))
                        }
                        onFileUpload={async () => {}}
                        onSubmit={() =>
                          advance(answers[currentStep.id] || null)
                        }
                      />
                    )}
                  </div>
                </MessageContent>
              </Message>
            )}

            {/* Completion */}
            {completed && (
              <Message from="assistant">
                <MessageAvatar src="/assistant.png" name="AI" />
                <MessageContent>
                  <div className="prose prose-sm dark:prose-invert">
                    <h3 className="m-0">Thanks! You're all set. 🎉</h3>
                    <p className="mt-2">This concludes the dummy flow.</p>
                  </div>
                </MessageContent>
              </Message>
            )}
          </ConversationContent>
        </Conversation>

        {/* Bottom input */}
        <div className="border-t bg-card">
          <PromptInput
            className="max-w-3xl mx-auto w-full flex items-end gap-2 p-3"
            onSubmit={(e: any) => {
              e.preventDefault();
              if (
                (currentStep?.kind === "text" ||
                  (currentStep as any) === "email") &&
                inputValue.trim()
              ) {
                advance(inputValue.trim());
                setInputValue("");
              }
            }}
          >
            <PromptInputTextarea
              placeholder={
                currentStep?.kind === "text"
                  ? "Type your answer and press Send…"
                  : "This step uses the controls above…"
              }
              disabled={currentStep?.kind !== "text"}
              value={inputValue}
              onChange={(e: any) => setInputValue(e.target.value)}
            />
            <PromptInputSubmit disabled={currentStep?.kind !== "text"}>
              Send
            </PromptInputSubmit>
          </PromptInput>
        </div>
      </div>
    );
  },
};
