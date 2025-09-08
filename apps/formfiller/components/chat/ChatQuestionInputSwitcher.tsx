"use client";

import React from "react";
import type { QuestionResponse } from "@/lib/types";
import { Question } from "@formlink/schema";
import {
  UnifiedFileUpload,
  UnifiedLinearScale,
  UnifiedRating,
  UnifiedRanking,
} from "@formlink/ui";
import { UnifiedLikert } from "@formlink/ui";
import { UnifiedPhoneInput } from "@formlink/ui";
import { UnifiedCountrySelect } from "@formlink/ui";
import { UnifiedMultiSelect } from "@formlink/ui";
import {
  UnifiedDropdownSelect,
  UnifiedDropdownMultiSelect,
} from "@formlink/ui";
import { UnifiedAddressInput } from "@formlink/ui";
import { UnifiedDatePicker } from "@formlink/ui";

function toStringVal(v: QuestionResponse): string | null {
  if (v == null) return null;
  if (typeof v === "string") return v;
  return String(v);
}
function toStringArray(v: QuestionResponse): string[] {
  if (Array.isArray(v))
    return v.filter((x) => typeof x === "string") as string[];
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      if (Array.isArray(parsed)) {
        return parsed.filter((x) => typeof x === "string") as string[];
      }
    } catch {}
  }
  return [];
}
function toNumberVal(v: QuestionResponse): number | null {
  if (v == null) return null;
  if (typeof v === "number") return v;
  const n = Number(v as any);
  return Number.isFinite(n) ? n : null;
}
function parseISODateString(s: string | null | undefined): Date | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const [, ys, ms, ds] = m;
  if (!ys || !ms || !ds) return null;
  const d = new Date(parseInt(ys, 10), parseInt(ms, 10) - 1, parseInt(ds, 10));
  return Number.isFinite(d.getTime()) ? d : null;
}
function formatISODate(d: Date | null): string | null {
  if (!d) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export interface ChatQuestionInputSwitcherProps {
  question: Question;
  response: QuestionResponse;
  onAnswer: (value: QuestionResponse) => void;
  onNext?: () => void;
  onPreviewSelection?: (ms: number) => void;
  onFileUpload?: (questionId: string, file: File) => Promise<void>;
  uploadedFile?: File | null;
  onFileSelect?: (file: File | null) => void;
}

export default function ChatQuestionInputSwitcher(
  props: ChatQuestionInputSwitcherProps,
) {
  const {
    question,
    response,
    onAnswer,
    onNext,
    onPreviewSelection,
    onFileUpload,
    uploadedFile,
    onFileSelect,
  } = props;

  const t = (question.type as any).name as string;
  const ADVANCE_DELAY = 250;

  // Text and variants
  if (t === "text") {
    const format = (question.type as any).format as string | undefined;

    if (format === "tel") {
      return (
        <UnifiedPhoneInput
          mode="chat"
          value={toStringVal(response) || ""}
          onChange={(v) => onAnswer(v)}
          onSubmit={onNext}
          required={Boolean((question as any).validations?.required?.value)}
          showCountrySelector
          showFlag
        />
      );
    }

    if (format === "country") {
      return (
        <UnifiedCountrySelect
          mode="chat"
          value={toStringVal(response)}
          onChange={(v) => onAnswer(v)}
          onSubmit={onNext}
          required={Boolean((question as any).validations?.required?.value)}
          className="w-full max-w-2xl"
          showKeyboardHints
          density="spacious"
        />
      );
    }

    // Generic text/email/url/password/number/textarea are handled by chat input; render nothing
    // We intentionally return null via ChatTextInput in UI package, but no inline control is needed here
    return null;
  }

  // Single choice
  if (t === "singleChoice") {
    const typeObj = question.type as any;
    const options =
      (typeObj.options as Array<{ value: string; label: string }>) || [];
    const display: "radio" | "dropdown" = typeObj.display || "radio";
    if (display === "dropdown") {
      return (
        <UnifiedDropdownSelect
          mode="chat"
          options={options}
          value={toStringVal(response)}
          onChange={(v) => {
            onPreviewSelection?.(ADVANCE_DELAY);
            onAnswer(v as any);
          }}
          onSubmit={() => {
            if (onNext) setTimeout(onNext, ADVANCE_DELAY);
          }}
        />
      );
    }
    return (
      <UnifiedMultiSelect
        mode="chat"
        options={options}
        value={toStringVal(response) ? [toStringVal(response)!] : []}
        maxSelections={1}
        onChange={(vals) => {
          const v = Array.isArray(vals) && vals.length > 0 ? vals[0] : "";
          onPreviewSelection?.(ADVANCE_DELAY);
          if (v) onAnswer(v);
          if (onNext) setTimeout(onNext, ADVANCE_DELAY);
        }}
      />
    );
  }

  // Multiple choice
  if (t === "multipleChoice") {
    const typeObj = question.type as any;
    const options =
      (typeObj.options as Array<{ value: string; label: string }>) || [];
    const display: "checkbox" | "multiSelectDropdown" =
      typeObj.display || "checkbox";
    if (display === "multiSelectDropdown") {
      return (
        <UnifiedDropdownMultiSelect
          mode="chat"
          options={options}
          value={toStringArray(response)}
          onChange={(arr) => onAnswer(arr)}
          onSubmit={onNext}
        />
      );
    }
    return (
      <UnifiedMultiSelect
        mode="chat"
        options={options}
        value={toStringArray(response)}
        onChange={(arr) => onAnswer(arr)}
        onSubmit={onNext}
      />
    );
  }

  // Rating
  if (t === "rating") {
    const cfg = (question.type as any).config || {};
    return (
      <UnifiedRating
        mode="chat"
        value={toNumberVal(response) || 0}
        onChange={(n: number | null) => {
          onPreviewSelection?.(ADVANCE_DELAY);
          onAnswer(n as any);
        }}
        onSubmit={() => {
          if (onNext) setTimeout(onNext, ADVANCE_DELAY);
        }}
        max={cfg.max ?? 5}
      />
    );
  }

  // Linear scale
  if (t === "linearScale") {
    const cfg = (question.type as any).config || {};
    return (
      <UnifiedLinearScale
        mode="chat"
        value={toNumberVal(response)}
        onChange={(n: number | null) => {
          onPreviewSelection?.(ADVANCE_DELAY);
          onAnswer(n as any);
          if (onNext) setTimeout(onNext, ADVANCE_DELAY);
        }}
        onSubmit={() => {
          if (onNext) setTimeout(onNext, ADVANCE_DELAY);
        }}
        config={{
          start: cfg.start ?? 1,
          end: cfg.end ?? 5,
          step: cfg.step ?? 1,
          startLabel: cfg.startLabel,
          endLabel: cfg.endLabel,
        }}
      />
    );
  }

  // Likert scale
  if (t === "likertScale") {
    const opts: string[] = (question.type as any).options || [];
    return (
      <UnifiedLikert
        mode="chat"
        options={opts}
        value={toStringVal(response)}
        onChange={(s) => {
          onPreviewSelection?.(ADVANCE_DELAY);
          onAnswer(s);
          if (onNext) setTimeout(onNext, ADVANCE_DELAY);
        }}
      />
    );
  }

  // Date (single only for chat; if dateRange appears, treat as single for now)
  if (t === "date") {
    const val = toStringVal(response);
    const dateObj = parseISODateString(val || undefined);
    return (
      <UnifiedDatePicker
        mode="chat"
        value={dateObj}
        onChange={(d) => {
          const iso = formatISODate(d);
          onPreviewSelection?.(ADVANCE_DELAY);
          onAnswer(iso);
          if (d && onNext) setTimeout(onNext, ADVANCE_DELAY);
        }}
        onSubmit={() => {
          if (onNext) setTimeout(onNext, ADVANCE_DELAY);
        }}
      />
    );
  }

  // File upload
  if (t === "fileUpload") {
    const v = (question as any).validations || {};
    return (
      <UnifiedFileUpload
        mode="chat"
        value={null}
        onChange={(file: File | File[] | null) => onAnswer(file as any)}
        // Avoid double upload; rely on onFileSelect to trigger upload once
        onFileUpload={undefined as any}
        onSubmit={onNext}
        questionId={question.id}
        uploadedFile={uploadedFile || null}
        onFileSelect={(files: File[] | undefined) =>
          onFileSelect?.(files?.[0] || null)
        }
        allowedFileTypes={v.allowedTypes?.value}
        maxFiles={v.maxFiles?.value ?? 1}
        maxSize={v.maxSize?.value}
      />
    );
  }

  // Address
  if (t === "address") {
    const val = (response ?? null) as any;
    return (
      <UnifiedAddressInput
        mode="chat"
        value={val}
        onChange={(addr) => onAnswer(addr as any)}
        onSubmit={onNext}
        required={Boolean((question as any).validations?.required?.value)}
      />
    );
  }

  // Ranking
  if (t === "ranking") {
    const options =
      ((question.type as any).options as Array<{
        value: string;
        label: string;
      }>) || [];
    const valArr = toStringArray(response);
    return (
      <UnifiedRanking
        mode="chat"
        options={options}
        value={valArr}
        onChange={(arr) => onAnswer(arr)}
        onSubmit={onNext}
      />
    );
  }

  return null;
}
