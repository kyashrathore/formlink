"use client";

import type { QuestionResponse } from "@/lib/types";
import { Question } from "@formlink/schema";
import {
  UnifiedAddressInput,
  UnifiedCountrySelect,
  UnifiedDatePicker,
  UnifiedDropdownMultiSelect,
  UnifiedDropdownSelect,
  UnifiedFileUpload,
  UnifiedLikert,
  UnifiedLinearScale,
  UnifiedMultiSelect,
  UnifiedPhoneInput,
  UnifiedRanking,
  UnifiedRating,
  UnifiedSignature,
} from "@formlink/ui";
import { debugLog } from "./utils/debug";

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
  const n = Number(v as unknown as string | number);
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

// Coerce arbitrary value to AddressData-like shape or null
function toAddress(v: QuestionResponse): {
  street1?: string;
  street2?: string;
  city?: string;
  stateProvince?: string;
  postalCode?: string;
  country?: string;
} | null {
  if (v && typeof v === "object" && !Array.isArray(v)) {
    const obj = v as Record<string, unknown>;
    const out: Record<string, string> = {};
    const keys = [
      "street1",
      "street2",
      "city",
      "stateProvince",
      "postalCode",
      "country",
    ] as const;
    let hasAny = false;
    for (const k of keys) {
      const val = obj[k];
      if (typeof val === "string") {
        out[k] = val;
        hasAny = true;
      }
    }
    return hasAny ? (out as any) : null;
  }
  return null;
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
    uploadedFile,
    onFileSelect,
  } = props;
  const typeObj = question.type as unknown as {
    name?: string;
    format?: string;
    display?: string;
    options?: Array<{ value: string; label: string }>;
    config?: Record<string, unknown>;
  };
  const t = typeObj.name ?? "";
  const ADVANCE_DELAY = 250;

  // Render content based on question type
  // Wrapped in a function but always returned in a stable container div
  const renderInput = () => {
    // Text and variants
    if (t === "text") {
      const format = typeObj.format;

      if (format === "tel") {
        return (
          <UnifiedPhoneInput
            mode="chat"
            value={toStringVal(response) || ""}
            onChange={(v: string | null) => onAnswer(v)}
            onSubmit={onNext}
            required={Boolean(question.validations?.required?.value)}
            showCountrySelector
            showFlag
            ariaLabel="Phone number input"
            ariaDescribedBy=""
            country="US"
            defaultCountry="US"
            onCountryChange={() => {}}
          />
        );
      }

      if (format === "country") {
        return (
          <UnifiedCountrySelect
            mode="chat"
            value={toStringVal(response)}
            onChange={(v: string | null) => onAnswer(v)}
            onSubmit={onNext}
            required={Boolean(question.validations?.required?.value)}
            className="w-full max-w-2xl"
            showKeyboardHints
            density="spacious"
            ariaLabel="Country select"
            ariaDescribedBy=""
            triggerClassName=""
          />
        );
      }

      // Generic text/email/url/password/number/textarea are handled by chat input; render nothing
      // We intentionally return null via ChatTextInput in UI package, but no inline control is needed here
      return null;
    }

    // Single choice
    if (t === "singleChoice") {
      const options = typeObj.options || [];
      const display: "radio" | "dropdown" =
        (typeObj.display as "radio" | "dropdown") || "radio";
      debugLog("Render singleChoice", {
        qid: question.id,
        display,
        optionCount: options.length,
        response,
      });
      if (display === "dropdown") {
        return (
          <UnifiedDropdownSelect
            mode="chat"
            options={options}
            value={toStringVal(response)}
            onChange={(v: string | null) => {
              onPreviewSelection?.(ADVANCE_DELAY);
              onAnswer(v);
            }}
            onSubmit={() => {
              if (onNext) setTimeout(onNext, ADVANCE_DELAY);
            }}
            className=""
          />
        );
      }
      return (
        <UnifiedMultiSelect
          mode="chat"
          options={options}
          value={toStringVal(response) ? [toStringVal(response)!] : []}
          maxSelections={1}
          onChange={(vals: string[]) => {
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
      const options = typeObj.options || [];
      const display: "checkbox" | "multiSelectDropdown" =
        (typeObj.display as "checkbox" | "multiSelectDropdown") || "checkbox";
      if (display === "multiSelectDropdown") {
        return (
          <UnifiedDropdownMultiSelect
            mode="chat"
            options={options}
            value={toStringArray(response)}
            onChange={(arr: string[]) => onAnswer(arr)}
            onSubmit={onNext}
            className=""
          />
        );
      }
      return (
        <UnifiedMultiSelect
          mode="chat"
          options={options}
          value={toStringArray(response)}
          onChange={(arr: string[]) => onAnswer(arr)}
          onSubmit={onNext}
          showKeyboardHints
        />
      );
    }

    // Rating
    if (t === "rating") {
      const cfg = (typeObj.config as Record<string, unknown>) || {};
      return (
        <UnifiedRating
          mode="chat"
          value={toNumberVal(response) || 0}
          onChange={(n: number | null) => {
            onPreviewSelection?.(ADVANCE_DELAY);
            onAnswer(n);
          }}
          onSubmit={() => {
            if (onNext) setTimeout(onNext, ADVANCE_DELAY);
          }}
          max={(cfg.max as number | undefined) ?? 5}
        />
      );
    }

    // Linear scale
    if (t === "linearScale") {
      const cfg = (typeObj.config as Record<string, unknown>) || {};
      return (
        <UnifiedLinearScale
          mode="chat"
          value={toNumberVal(response)}
          onChange={(n: number | null) => {
            onPreviewSelection?.(ADVANCE_DELAY);
            onAnswer(n);
            if (onNext) setTimeout(onNext, ADVANCE_DELAY);
          }}
          onSubmit={() => {
            if (onNext) setTimeout(onNext, ADVANCE_DELAY);
          }}
          config={{
            start: (cfg.start as number | undefined) ?? 1,
            end: (cfg.end as number | undefined) ?? 5,
            step: (cfg.step as number | undefined) ?? 1,
            startLabel: cfg.startLabel as string | undefined,
            endLabel: cfg.endLabel as string | undefined,
          }}
        />
      );
    }

    // Likert scale
    if (t === "likertScale") {
      const opts: string[] = (typeObj.options || []).map((o) => o.label);
      return (
        <UnifiedLikert
          mode="chat"
          options={opts}
          value={toStringVal(response)}
          onChange={(s: string | null) => {
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
          onChange={(d: Date | null) => {
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
      const v = question.validations || {};
      return (
        <UnifiedFileUpload
          mode="chat"
          value={null}
          onChange={(file: File | File[] | null) => {
            const first = Array.isArray(file) ? (file[0] ?? null) : file;
            onAnswer(first);
          }}
          // Avoid double upload; rely on onFileSelect to trigger upload once
          onFileUpload={undefined}
          onSubmit={onNext}
          questionId={question.id}
          uploadedFile={uploadedFile || null}
          onFileSelect={(files: File[] | undefined) =>
            onFileSelect?.(files?.[0] || null)
          }
          allowedFileTypes={v.allowedTypes?.value as string[] | undefined}
          maxFiles={(v.maxFiles?.value as number | undefined) ?? 1}
          maxSize={v.maxSize?.value as number | undefined}
        />
      );
    }

    // Address
    if (t === "address") {
      const val = toAddress(response);
      return (
        <UnifiedAddressInput
          mode="chat"
          value={val}
          onChange={(addr) => onAnswer(addr)}
          onSubmit={onNext}
          required={Boolean(question.validations?.required?.value)}
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
          onChange={(arr: string[]) => onAnswer(arr)}
          onSubmit={onNext}
        />
      );
    }

    // Signature
    if (t === "signature") {
      return (
        <UnifiedSignature
          mode="chat"
          value={toStringVal(response) || ""}
          onChange={(signature: string | null) => onAnswer(signature)}
          onSubmit={onNext}
        />
      );
    }

    return null;
  };

  return <div>{renderInput()}</div>;
}
