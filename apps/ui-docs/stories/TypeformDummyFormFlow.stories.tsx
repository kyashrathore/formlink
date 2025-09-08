"use client";

import type { Meta, StoryObj } from "@storybook/react";
import React, { useEffect, useMemo, useState } from "react";
import { TypeformTemplate } from "./components/TypeformTemplate";
import {
  TypeFormTextInput,
  UnifiedLinearScale,
  UnifiedRating,
  UnifiedMultiSelect,
  UnifiedDatePicker,
  UnifiedLikert,
  Button,
  UnifiedCountrySelect,
  UnifiedPhoneInput,
  UnifiedAddressInput,
  UnifiedFileUpload,
  UnifiedRanking,
} from "@formlink/ui";

const meta: Meta = {
  title: "Form/Typeform Dummy Flow",
} as Meta;

// Temporarily disable due to TypeScript conflicts
export default {
  ...meta,
  title: "Form/Typeform Dummy Flow (Disabled)",
  parameters: {
    ...meta.parameters,
    docs: { disable: true },
  },
};
type Story = StoryObj;

type StepType =
  | {
      kind: "text";
      id: string;
      title: string;
      description?: string;
      placeholder?: string;
    }
  | {
      kind: "textarea";
      id: string;
      title: string;
      description?: string;
      placeholder?: string;
    }
  | { kind: "email"; id: string; title: string; description?: string }
  | { kind: "url"; id: string; title: string; description?: string }
  | { kind: "password"; id: string; title: string; description?: string }
  | { kind: "number"; id: string; title: string; description?: string }
  | { kind: "tel"; id: string; title: string; description?: string }
  | { kind: "country"; id: string; title: string; description?: string }
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
  | { kind: "date"; id: string; title: string; description?: string }
  | { kind: "address"; id: string; title: string; description?: string }
  | { kind: "file"; id: string; title: string; description?: string }
  | { kind: "ranking"; id: string; title: string; description?: string };

const steps: StepType[] = [
  {
    kind: "text",
    id: "fullName",
    title: "What is your full name?",
    placeholder: "Type your name...",
  },
  { kind: "textarea", id: "bio", title: "Tell us a bit about you" },
  { kind: "email", id: "email", title: "Your email address" },
  { kind: "url", id: "website", title: "Your website URL" },
  { kind: "password", id: "password", title: "Create a password" },
  { kind: "number", id: "age", title: "Your age" },
  { kind: "tel", id: "phone", title: "Your phone number" },
  { kind: "country", id: "country", title: "Select your country" },
  {
    kind: "single",
    id: "role",
    title: "Select your role",
    options: [
      { value: "designer", label: "Designer" },
      { value: "engineer", label: "Engineer" },
      { value: "pm", label: "Product Manager" },
    ],
  },
  {
    kind: "multi",
    id: "tools",
    title: "Which tools do you use?",
    description: "Pick any that apply",
    options: [
      { value: "figma", label: "Figma" },
      { value: "react", label: "React" },
      { value: "nextjs", label: "Next.js" },
      { value: "tailwind", label: "Tailwind" },
    ],
  },
  {
    kind: "linear",
    id: "experience",
    title: "Years of experience",
    description: "1 = just starting, 10 = expert",
    config: {
      start: 1,
      end: 10,
      step: 1,
      startLabel: "New",
      endLabel: "Expert",
    },
  },
  {
    kind: "rating",
    id: "satisfaction",
    title: "How satisfied are you with your workflow?",
    max: 5,
  },
  {
    kind: "likert",
    id: "preference",
    title: "I prefer form experiences that are...",
    options: ["Minimal", "Balanced", "Playful"],
  },
  {
    kind: "date",
    id: "startDate",
    title: "When did you start in your current role?",
  },
  { kind: "address", id: "address", title: "Your address" },
  { kind: "ranking", id: "ranking", title: "Rank the following" },
  { kind: "file", id: "resume", title: "Upload your resume" },
];

export const Flow: Story = {
  render: () => {
    const [current, setCurrent] = useState(0);
    const [answers, setAnswers] = useState<Record<string, any>>({});
    const [theme, setTheme] = useState<"light" | "dark">(
      () =>
        (typeof window !== "undefined" &&
          (localStorage.getItem("sb_theme_preference") as any)) ||
        "light",
    );
    const storageKey = "sb_typeform_dummy_flow_v1";

    const currentStep = steps[current];
    const atEnd = current >= steps.length;

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

    useEffect(() => {
      try {
        localStorage.setItem(storageKey, JSON.stringify({ current, answers }));
      } catch {}
    }, [current, answers]);

    useEffect(() => {
      try {
        localStorage.setItem("sb_theme_preference", theme);
      } catch {}
      if (typeof document !== "undefined") {
        const root = document.documentElement;
        if (theme === "dark") root.classList.add("dark");
        else root.classList.remove("dark");
      }
    }, [theme]);

    const canContinue = useMemo(() => {
      if (!currentStep) return false;
      const val = answers[currentStep.id];
      switch (currentStep.kind) {
        case "text":
        case "textarea":
        case "likert":
        case "email":
        case "url":
        case "password":
          return Boolean(val && String(val).trim() !== "");
        case "single":
          return Array.isArray(val) ? val.length === 1 : Boolean(val);
        case "multi":
          return Array.isArray(val) && val.length > 0;
        case "linear":
        case "rating":
          return typeof val === "number" && !Number.isNaN(val);
        case "date":
          return val instanceof Date;
        case "tel":
          return Boolean(val && String(val).trim().length >= 4);
        case "country":
          return Boolean(val && String(val).trim() !== "");
        case "address":
          return (
            val &&
            typeof val === "object" &&
            Object.values(val as any).some((v) => v && String(v).trim() !== "")
          );
        case "ranking":
          return Array.isArray(val) && val.length > 0;
        case "file":
          return Boolean(val);
        default:
          return false;
      }
    }, [currentStep, answers]);

    const goNext = () => setCurrent((i) => Math.min(i + 1, steps.length));
    const goReset = () => {
      setCurrent(0);
      setAnswers({});
      try {
        localStorage.removeItem(storageKey);
      } catch {}
    };

    return (
      <div className="space-y-3">
        {/* Header controls */}
        <div className="flex items-center justify-between gap-3 px-2 py-1">
          <div className="text-sm text-muted-foreground">
            Dummy Typeform Flow
          </div>
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
              onClick={goReset}
            >
              Reset
            </button>
          </div>
        </div>

        <TypeformTemplate
          title={atEnd ? "All done!" : currentStep?.title || ""}
          description={
            atEnd
              ? "Thanks for completing this dummy flow."
              : currentStep?.description
          }
        >
          {!atEnd && currentStep && (
            <div className="space-y-6">
              {currentStep.kind === "text" && (
                <TypeFormTextInput
                  value={(answers[currentStep.id] as string) || ""}
                  onChange={(v) =>
                    setAnswers((p) => ({ ...p, [currentStep.id]: v }))
                  }
                  onSubmit={() => canContinue && goNext()}
                  placeholder={currentStep.placeholder || "Type your answer..."}
                />
              )}
              {currentStep.kind === "textarea" && (
                <TypeFormTextInput
                  value={(answers[currentStep.id] as string) || ""}
                  onChange={(v) =>
                    setAnswers((p) => ({ ...p, [currentStep.id]: v }))
                  }
                  onSubmit={() => canContinue && goNext()}
                  placeholder={currentStep.placeholder || "Type your answer..."}
                  type="text"
                />
              )}
              {currentStep.kind === "email" && (
                <TypeFormTextInput
                  value={(answers[currentStep.id] as string) || ""}
                  onChange={(v) =>
                    setAnswers((p) => ({ ...p, [currentStep.id]: v }))
                  }
                  onSubmit={() => canContinue && goNext()}
                  placeholder="name@example.com"
                  type="email"
                />
              )}
              {currentStep.kind === "url" && (
                <TypeFormTextInput
                  value={(answers[currentStep.id] as string) || ""}
                  onChange={(v) =>
                    setAnswers((p) => ({ ...p, [currentStep.id]: v }))
                  }
                  onSubmit={() => canContinue && goNext()}
                  placeholder="https://example.com"
                  type="url"
                />
              )}
              {currentStep.kind === "password" && (
                <TypeFormTextInput
                  value={(answers[currentStep.id] as string) || ""}
                  onChange={(v) =>
                    setAnswers((p) => ({ ...p, [currentStep.id]: v }))
                  }
                  onSubmit={() => canContinue && goNext()}
                  placeholder="Create a password"
                  type="password"
                />
              )}
              {currentStep.kind === "number" && (
                <TypeFormTextInput
                  value={(answers[currentStep.id] as string) || ""}
                  onChange={(v) =>
                    setAnswers((p) => ({ ...p, [currentStep.id]: v }))
                  }
                  onSubmit={() => canContinue && goNext()}
                  placeholder="0"
                  type="number"
                />
              )}
              {currentStep.kind === "tel" && (
                <UnifiedPhoneInput
                  mode="typeform"
                  value={(answers[currentStep.id] as string) || ""}
                  onChange={(v) =>
                    setAnswers((p) => ({ ...p, [currentStep.id]: v }))
                  }
                  onSubmit={() => canContinue && goNext()}
                  showCountrySelector
                  showFlag
                />
              )}
              {currentStep.kind === "country" && (
                <UnifiedCountrySelect
                  mode="typeform"
                  value={(answers[currentStep.id] as string) || null}
                  onChange={(v) =>
                    setAnswers((p) => ({ ...p, [currentStep.id]: v }))
                  }
                  showKeyboardHints
                />
              )}
              {currentStep.kind === "single" && (
                <UnifiedMultiSelect
                  mode="typeform"
                  options={currentStep.options}
                  value={(answers[currentStep.id] as string[]) || []}
                  onChange={(vals) =>
                    setAnswers((p) => ({
                      ...p,
                      [currentStep.id]: vals.slice(-1),
                    }))
                  }
                  maxSelections={1}
                />
              )}
              {currentStep.kind === "multi" && (
                <UnifiedMultiSelect
                  mode="typeform"
                  options={currentStep.options}
                  value={(answers[currentStep.id] as string[]) || []}
                  onChange={(vals) =>
                    setAnswers((p) => ({ ...p, [currentStep.id]: vals }))
                  }
                />
              )}
              {currentStep.kind === "linear" && (
                <UnifiedLinearScale
                  mode="typeform"
                  value={(answers[currentStep.id] as number) || null}
                  onChange={(v) =>
                    setAnswers((p) => ({ ...p, [currentStep.id]: v }))
                  }
                  config={currentStep.config}
                />
              )}
              {currentStep.kind === "rating" && (
                <UnifiedRating
                  mode="typeform"
                  value={(answers[currentStep.id] as number) || 0}
                  onChange={(v) =>
                    setAnswers((p) => ({ ...p, [currentStep.id]: v }))
                  }
                  max={currentStep.max || 5}
                />
              )}
              {currentStep.kind === "likert" && (
                <UnifiedLikert
                  mode="typeform"
                  options={currentStep.options}
                  value={(answers[currentStep.id] as string) || null}
                  onChange={(v) =>
                    setAnswers((p) => ({ ...p, [currentStep.id]: v }))
                  }
                  onSubmit={() => canContinue && goNext()}
                />
              )}
              {currentStep.kind === "date" && (
                <UnifiedDatePicker
                  mode="typeform"
                  value={(answers[currentStep.id] as Date) || null}
                  onChange={(d) =>
                    setAnswers((p) => ({ ...p, [currentStep.id]: d }))
                  }
                />
              )}
              {currentStep.kind === "address" && (
                <UnifiedAddressInput
                  mode="typeform"
                  value={(answers[currentStep.id] as any) || null}
                  onChange={(v) =>
                    setAnswers((p) => ({ ...p, [currentStep.id]: v }))
                  }
                />
              )}
              {currentStep.kind === "ranking" && (
                <UnifiedRanking
                  mode="typeform"
                  options={[
                    { value: "speed", label: "Speed" },
                    { value: "accuracy", label: "Accuracy" },
                    { value: "design", label: "Design" },
                  ]}
                  value={(answers[currentStep.id] as string[]) || []}
                  onChange={(v) =>
                    setAnswers((p) => ({ ...p, [currentStep.id]: v }))
                  }
                />
              )}
              {currentStep.kind === "file" && (
                <UnifiedFileUpload
                  mode="typeform"
                  value={undefined}
                  onChange={(f) =>
                    setAnswers((p) => ({ ...p, [currentStep.id]: f }))
                  }
                  questionId="file"
                  onFileUpload={async () => {}}
                />
              )}

              <div className="pt-4">
                <Button type="button" onClick={goNext} disabled={!canContinue}>
                  Continue
                </Button>
              </div>
            </div>
          )}
        </TypeformTemplate>
      </div>
    );
  },
};
