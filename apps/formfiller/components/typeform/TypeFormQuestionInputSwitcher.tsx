"use client";

import type { QuestionResponse } from "@/lib/types";
import { Question } from "@formlink/schema";
import {
  TypeFormTextInput,
  UnifiedFileUpload,
  UnifiedDropdownSelect,
  UnifiedDropdownMultiSelect,
  UnifiedCountrySelect,
  UnifiedMultiSelect,
  UnifiedRating,
  UnifiedSignature,
} from "@formlink/ui";
import TypeFormAddress from "./TypeFormAddress";
import { UnifiedLikert } from "@formlink/ui";
import TypeFormRanking from "./TypeFormRanking";
import { UnifiedPhoneInput } from "@formlink/ui";
// Use unified phone input with libphonenumber-js formatting/validation
// Temporarily avoid specialized phone/country inputs; use text input variants
import { TypeFormLinearScale } from "./TypeFormLinearScale";
import TypeFormDate from "./TypeFormDate";
import { getPlaceholder } from "./utils/placeholders";

// Local coercers (keep minimal and predictable)
function toStringVal(v: QuestionResponse): string | null {
  if (v == null) return null;
  if (typeof v === "string") return v;
  return String(v);
}
function toStringArray(v: QuestionResponse): string[] {
  if (Array.isArray(v)) {
    return v.filter((x) => typeof x === "string") as string[];
  }
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      if (Array.isArray(parsed)) {
        return parsed.filter((x) => typeof x === "string") as string[];
      }
    } catch {
      // not JSON; ignore
    }
  }
  return [];
}
function toNumberVal(v: QuestionResponse): number | null {
  if (v == null) return null;
  if (typeof v === "number") return v;
  const n = Number(v as any);
  return Number.isFinite(n) ? n : null;
}
function parseISODate(v: QuestionResponse): Date | null {
  if (typeof v !== "string" || !v) return null;
  // Expecting "YYYY-MM-DD"
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v.trim());
  if (!match) return null;
  const [, ys, ms, ds] = match;
  if (!ys || !ms || !ds) return null;
  const year = parseInt(ys, 10);
  const month = parseInt(ms, 10) - 1;
  const day = parseInt(ds, 10);
  const d = new Date(year, month, day);
  return Number.isFinite(d.getTime()) ? d : null;
}

export interface TypeFormQuestionInputSwitcherProps {
  question: Question;
  response: QuestionResponse;
  onAnswer: (value: QuestionResponse) => void;
  onFileUpload?: (questionId: string, file: File) => Promise<void>;
  uploadedFile?: File | null;
  onFileSelect?: (file: File | null) => void;
  onNext?: () => void;
  ariaDescribedBy?: string;
  countryISO2?: string | null;
  isInvalid?: boolean;
}

/**
 * TypeFormQuestionInputSwitcher
 * - Single place that maps (type, format, display) -> Typeform mode component
 * - Only Phase 0 scope: text formats, choice displays, rating, linear, likert; basic date/file/address/ranking via unified.
 * - country/tel specialized components will come later; for now use TypeFormTextInput with correct input type for tel.
 */
export default function TypeFormQuestionInputSwitcher(
  props: TypeFormQuestionInputSwitcherProps,
) {
  const {
    question,
    response,
    onAnswer,
    onFileUpload,
    uploadedFile,
    onFileSelect,
    onNext,
    ariaDescribedBy,
    countryISO2,
    isInvalid,
  } = props;

  const typeObj = question.type as unknown as {
    name?: string;
    format?: string;
    display?: string;
    options?: Array<{ value: string; label: string }>;
    config?: Record<string, unknown>;
  };
  const t = typeObj.name ?? "";

  // Text questions with formats
  if (t === "text") {
    const f = typeObj.format;
    const val = toStringVal(response);

    // Get the appropriate placeholder
    const placeholder = getPlaceholder(
      "text",
      f,
      (question as { placeholder?: string }).placeholder,
    );

    // Phase 1 specialized components for tel and country
    if (f === "tel") {
      return (
        <UnifiedPhoneInput
          mode="typeform"
          value={val || ""}
          onChange={(v: string | null) => onAnswer(v)}
          onSubmit={onNext}
          required={Boolean(question.validations?.required?.value)}
          showCountrySelector
          showFlag
        />
      );
    }

    if (f === "country") {
      return (
        <UnifiedCountrySelect
          mode="typeform"
          value={val}
          onChange={(v: string | null) => onAnswer(v)}
          onSubmit={onNext}
          required={Boolean(question.validations?.required?.value)}
          className="w-full max-w-2xl"
          density="comfy"
        />
      );
    }

    // All other text formats use TypeFormTextInput
    return (
      <TypeFormTextInput
        value={val}
        onChange={(v: string) => onAnswer(v)}
        onSubmit={onNext}
        type={f === "textarea" ? "text" : f || "text"}
        placeholder={placeholder}
        required={Boolean(question.validations?.required?.value)}
        maxLength={question.validations?.maxLength?.value as number | undefined}
        minLength={question.validations?.minLength?.value as number | undefined}
        pattern={question.validations?.pattern?.value as string | undefined}
        ariaLabel={question.title}
        onValidate={undefined}
      />
    );
  }

  // Choice questions
  if (t === "singleChoice") {
    const options = typeObj.options || [];
    const val = toStringVal(response);
    return (
      <div
        className="relative z-10 pointer-events-auto"
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        <UnifiedDropdownSelect
          mode="typeform"
          options={options}
          value={val}
          onChange={(v: string | null) => onAnswer(v ?? "")}
          onSubmit={onNext}
          className="w-full max-w-2xl"
          autoOpenOnMountIfEmpty
        />
      </div>
    );
  }
  if (t === "multipleChoice") {
    const options = typeObj.options || [];
    const valArr = toStringArray(response);
    return (
      <div
        className="relative z-10 pointer-events-auto"
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        <UnifiedDropdownMultiSelect
          mode="typeform"
          options={options}
          value={valArr}
          onChange={(arr: string[]) => onAnswer(arr)}
          onSubmit={onNext}
          className="w-full max-w-2xl"
        />
      </div>
    );
  }

  // Rating
  if (t === "rating") {
    const cfg = (typeObj.config as Record<string, unknown>) || {};
    const val = toNumberVal(response);
    return (
      <UnifiedRating
        mode="typeform"
        value={val || 0}
        onChange={(n: number) => onAnswer(n)}
        onSubmit={onNext}
        density="comfy"
        max={(cfg.max as number | undefined) ?? 5}
        className=""
        showKeyboardHints
      />
    );
  }

  // Linear scale
  if (t === "linearScale") {
    const cfg = (typeObj.config as Record<string, unknown>) || {};
    const val = toNumberVal(response);
    return (
      <TypeFormLinearScale
        value={val}
        onChange={(n: number) => onAnswer(n)}
        onSubmit={onNext}
        config={{
          start: (cfg.start as number | undefined) ?? 1,
          end: (cfg.end as number | undefined) ?? 5,
          step: (cfg.step as number | undefined) ?? 1,
          startLabel: cfg.startLabel as string | undefined,
          endLabel: cfg.endLabel as string | undefined,
        }}
        required={Boolean(question.validations?.required?.value)}
        ariaLabel={question.title}
        ariaDescribedBy={ariaDescribedBy}
        showKeyboardHints
      />
    );
  }

  // Likert (labels, not numbers)
  if (t === "likertScale") {
    const opts: string[] = (typeObj.options || []).map((o) => o.label);
    const val = toStringVal(response);
    return (
      <div
        className="relative z-10 pointer-events-auto"
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        <UnifiedLikert
          mode="typeform"
          options={opts}
          value={val}
          onChange={(s: string | null) => onAnswer(s || "")}
          onSubmit={onNext}
          density="comfy"
          showKeyboardHints
          debug
        />
      </div>
    );
  }

  // Date (Phase 1: TypeFormDate wrapper for single and range)
  if (t === "date") {
    const format = typeObj.format as "date" | "dateRange" | undefined;
    return (
      <TypeFormDate
        value={toStringVal(response)}
        onChange={(s: string) => onAnswer(s)}
        onSubmit={onNext}
        range={format === "dateRange"}
        required={Boolean(question.validations?.required?.value)}
        ariaLabel={question.title}
        ariaDescribedBy={ariaDescribedBy}
      />
    );
  }

  // File upload (use UnifiedFileUpload with Typeform mode)
  if (t === "fileUpload") {
    const v = question.validations || {};
    return (
      <UnifiedFileUpload
        mode="typeform"
        value={null}
        onChange={(file: File | File[] | null) => {
          const first = Array.isArray(file) ? (file[0] ?? null) : file;
          onAnswer(first);
        }}
        onFileUpload={(files) =>
          onFileUpload
            ? onFileUpload(question.id, files[0]!)
            : Promise.resolve()
        }
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
    const valRaw = (response ?? null) as unknown;
    const toAddress = (
      v: QuestionResponse,
    ): {
      street1?: string;
      street2?: string;
      city?: string;
      stateProvince?: string;
      postalCode?: string;
      country?: string;
    } | null => {
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
          const vv = obj[k];
          if (typeof vv === "string") {
            out[k] = vv;
            hasAny = true;
          }
        }
        return hasAny ? (out as any) : null;
      }
      return null;
    };
    const val = toAddress(valRaw as any);
    return (
      <div
        className="relative z-10 pointer-events-auto w-full max-w-2xl"
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        <TypeFormAddress
          value={val}
          onCompleteChange={(addr) => onAnswer(addr)}
          onSubmit={onNext}
          required={Boolean(question.validations?.required?.value)}
        />
      </div>
    );
  }

  // Ranking
  if (t === "ranking") {
    const options = typeObj.options || [];
    const val = toStringArray(response);
    return (
      <div
        className="relative z-10 pointer-events-auto"
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        <TypeFormRanking
          options={options}
          value={val}
          onChange={(arrOrJson: any) => onAnswer(arrOrJson as any)}
          onSubmit={onNext}
          originalWasString={typeof (response as any) === "string"}
        />
      </div>
    );
  }

  // Signature
  if (t === "signature") {
    return (
      <UnifiedSignature
        mode="typeform"
        value={toStringVal(response) || ""}
        onChange={(signature: string | null) => onAnswer(signature)}
        onSubmit={onNext}
      />
    );
  }

  // Fallback to text
  return (
    <TypeFormTextInput
      value={toStringVal(response)}
      onChange={(v: string) => onAnswer(v)}
      onSubmit={onNext}
      type="text"
      placeholder={String(
        (question as { placeholder?: string }).placeholder ?? "",
      )}
      required={Boolean(question.validations?.required?.value)}
      maxLength={question.validations?.maxLength?.value as number | undefined}
      minLength={question.validations?.minLength?.value as number | undefined}
      pattern={question.validations?.pattern?.value as string | undefined}
      ariaLabel={question.title}
      onValidate={undefined}
    />
  );
}
