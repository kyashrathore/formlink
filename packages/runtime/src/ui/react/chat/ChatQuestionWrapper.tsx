"use client";
import * as React from "react";
import type { Question } from "@formlink/schema";
import { InlineMultiSelect } from "../InlineMultiSelect";
import { InlineSelect } from "../InlineSelect";
import { UnifiedCountrySelect } from "../UnifiedCountrySelect";
import { UnifiedDatePicker } from "../UnifiedDatePicker";
import { UnifiedDropdownMultiSelect } from "../UnifiedDropdownMultiSelect";
import { UnifiedDropdownSelect } from "../UnifiedDropdownSelect";
import { UnifiedFileUpload } from "../UnifiedFileUpload";
import { UnifiedPhoneInput } from "../UnifiedPhoneInput";
import { TypeFormTextInput } from "../typeform/TypeFormTextInput";
import { formatResponseForDisplay } from "./formatResponse";

export interface ChatQuestionWrapperProps {
  question: Question;
  value: unknown;
  onChange: (value: unknown) => void;
  onSubmitSelection: (
    questionId: string,
    value: unknown,
    displayText: string,
  ) => void;
  onFileUpload?: (questionId: string, file: File) => Promise<void>;
}

export function ChatQuestionWrapper({
  question,
  value,
  onChange,
  onSubmitSelection,
  onFileUpload,
}: ChatQuestionWrapperProps) {
  const name = (question.type as any)?.name as Question["type"]["name"];

  if (name === "text") {
    const fmt = (question.type as any)?.format as string | undefined;
    if (fmt === "date") {
      return (
        <UnifiedDatePicker
          mode="typeform"
          value={(value ?? null) as any}
          onChange={(v) => onSubmitSelection(question.id, v, String(v ?? ""))}
          onSubmit={() => {}}
        />
      );
    }
    if (fmt === "country") {
      return (
        <UnifiedCountrySelect
          mode="typeform"
          options={[]}
          value={(value ?? null) as any}
          onChange={(v) => onSubmitSelection(question.id, v, String(v ?? ""))}
          onSubmit={() => {}}
        />
      );
    }
    if (fmt === "tel") {
      const val = typeof value === "string" ? value : "";
      return (
        <UnifiedPhoneInput
          mode="typeform"
          value={val}
          onChange={onChange as (v: string | null) => void}
          onSubmit={() => {
            const v = (val ?? "") as string;
            onSubmitSelection(question.id, v, v);
          }}
        />
      );
    }
    if (fmt === "textarea") {
      const val = typeof value === "string" ? value : "";
      return (
        <div className="w-full max-w-2xl space-y-2">
          <textarea
            className={[
              "w-full min-h-28 px-0 py-3 text-2xl md:text-3xl font-light",
              "bg-transparent border-0 border-b-2 border-border/30",
              "focus:outline-none focus:border-b-primary transition-colors duration-200",
              "placeholder:text-muted-foreground/50",
            ].join(" ")}
            value={val}
            placeholder="Type your answer…"
            onChange={(e) => onChange((e.target as any).value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !(e as any).shiftKey) {
                e.preventDefault();
                const v = val ?? "";
                onSubmitSelection(question.id, v, v);
              }
            }}
            aria-label={question.title}
          />
          <div className="text-xs text-muted-foreground">
            Shift+Enter for a new line
          </div>
        </div>
      );
    }
    const inputType =
      fmt && ["email", "url", "password", "number"].includes(fmt)
        ? (fmt as any)
        : "text";
    const val = typeof value === "string" ? value : "";
    return (
      <TypeFormTextInput
        type={inputType}
        value={val}
        onChange={(v) => onChange(v)}
        onSubmit={() => onSubmitSelection(question.id, val, val)}
        placeholder="Type your answer…"
      />
    );
  }

  if (name === "singleChoice") {
    const raw = (question.type as any)?.options as Array<{
      value: string;
      label: string;
    }>;
    const options = (raw ?? []).map((o) => ({
      value: o.value,
      label: o.label,
    }));
    const val = (value ?? null) as string | null;
    if (options.length > 0 && options.length < 6) {
      return (
        <InlineSelect
          options={options}
          value={val}
          onChange={(v) =>
            onSubmitSelection(
              question.id,
              v,
              options.find((o) => o.value === v)?.label ?? String(v),
            )
          }
          onSubmit={() => {}}
          autoFocus
          showKeyboardHints
        />
      );
    }
    return (
      <UnifiedDropdownSelect
        mode="typeform"
        options={options}
        value={val}
        onChange={(v) =>
          onSubmitSelection(
            question.id,
            v,
            options.find((o) => o.value === v)?.label ?? String(v),
          )
        }
        onSubmit={() => {}}
        placeholder="Select an option…"
      />
    );
  }

  if (name === "multipleChoice") {
    const raw = (question.type as any)?.options as Array<{
      value: string;
      label: string;
    }>;
    const options = (raw ?? []).map((o) => ({
      value: o.value,
      label: o.label,
    }));
    const stored = value;
    const val = Array.isArray(stored)
      ? (stored as string[])
      : typeof stored === "string" && stored.length > 0
        ? stored
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : [];
    const handleSubmitMulti = (arr: string[]) => {
      const disp = formatResponseForDisplay(question, arr);
      onSubmitSelection(question.id, arr, disp);
    };
    if (options.length > 0 && options.length < 6) {
      return (
        <InlineMultiSelect
          options={options}
          value={val}
          onChange={(arr) => onChange(arr)}
          onSubmit={() =>
            handleSubmitMulti((Array.isArray(value) ? value : []) as string[])
          }
        />
      );
    }
    return (
      <UnifiedDropdownMultiSelect
        mode="typeform"
        options={options}
        value={val}
        onChange={(arr) => onChange(arr)}
        onSubmit={() =>
          handleSubmitMulti((Array.isArray(value) ? value : []) as string[])
        }
        placeholder="Select one or more…"
      />
    );
  }

  if (name === "fileUpload") {
    return (
      <UnifiedFileUpload
        mode="typeform"
        questionId={question.id}
        onFileUpload={(qid: string, f: File) =>
          onFileUpload ? onFileUpload(qid, f) : Promise.resolve()
        }
      />
    );
  }

  return null;
}
