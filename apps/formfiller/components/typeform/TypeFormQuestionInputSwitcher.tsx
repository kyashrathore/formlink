"use client";

import type { QuestionResponse } from "@/lib/types";
import { Question } from "@formlink/schema";
import {
  TypeFormTextInput,
  UnifiedDatePicker,
  UnifiedFileUpload,
  UnifiedLinearScale,
  UnifiedMultiSelect,
  UnifiedRating,
} from "@formlink/ui";
import TypeFormAddress from "./TypeFormAddress";
import TypeFormLikert from "./TypeFormLikert";
import TypeFormRanking from "./TypeFormRanking";
import TypeFormSingleSelect from "./TypeFormSingleSelect";

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
  } = props;

  const t = question.type.name as string;

  // Text questions with formats
  if (t === "text") {
    const f = (question.type as any).format as string | undefined;
    const val = toStringVal(response);

    // Temporary Phase 0 mapping:
    // - tel: proper input type
    // - country: fallback to text; will be replaced with CountrySelect in Phase 1
    return (
      <TypeFormTextInput
        value={val}
        onChange={(v: string) => onAnswer(v)}
        onSubmit={onNext}
        type={f === "textarea" ? "text" : f || "text"}
        placeholder={String((question as any).placeholder ?? "")}
        required={Boolean((question as any).validations?.required?.value)}
        maxLength={(question as any).validations?.maxLength?.value}
        minLength={(question as any).validations?.minLength?.value}
        pattern={(question as any).validations?.pattern?.value}
        ariaLabel={question.title}
        onValidate={undefined}
      />
    );
  }

  // Choice questions
  if (t === "singleChoice") {
    const options =
      ((question.type as any).options as Array<{
        value: string;
        label: string;
      }>) || [];
    const val = toStringVal(response);
    return (
      <div
        className="relative z-10 pointer-events-auto"
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        <TypeFormSingleSelect
          options={options}
          value={val}
          onChange={(v: string) => onAnswer(v)}
          onSubmit={onNext}
          required={Boolean((question as any).validations?.required?.value)}
        />
      </div>
    );
  }
  if (t === "multipleChoice") {
    const options =
      ((question.type as any).options as Array<{
        value: string;
        label: string;
      }>) || [];
    const valArr = toStringArray(response);
    return (
      <div
        className="relative z-10 pointer-events-auto"
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        <UnifiedMultiSelect
          mode="typeform"
          options={options}
          value={valArr}
          onChange={(arr: string[]) => onAnswer(arr)}
          onSubmit={onNext}
        />
      </div>
    );
  }

  // Rating
  if (t === "rating") {
    const cfg = (question.type as any).config || {};
    const val = toNumberVal(response);
    return (
      <UnifiedRating
        mode="typeform"
        value={val || 0}
        onChange={(n: number) => onAnswer(n as any)}
        onSubmit={onNext}
        max={cfg.max ?? 5}
        className=""
        showKeyboardHints
      />
    );
  }

  // Linear scale
  if (t === "linearScale") {
    const cfg = (question.type as any).config || {};
    const val = toNumberVal(response);
    return (
      <UnifiedLinearScale
        mode="typeform"
        value={val}
        onChange={(n: number | null) => onAnswer(n as any)}
        onSubmit={onNext}
        config={{
          start: cfg.start ?? 1,
          end: cfg.end ?? 5,
          step: cfg.step ?? 1,
          startLabel: cfg.startLabel,
          endLabel: cfg.endLabel,
        }}
        showKeyboardHints
      />
    );
  }

  // Likert (labels, not numbers)
  if (t === "likertScale") {
    const opts: string[] = (question.type as any).options || [];
    const val = toStringVal(response);
    return (
      <TypeFormLikert
        options={opts}
        value={val}
        onChange={(s: string) => onAnswer(s)}
        onSubmit={onNext}
        showKeyboardHints
      />
    );
  }

  // Date (Phase 0: single date via UnifiedDatePicker; dateRange deferred to Phase 1)
  if (t === "date") {
    const format = (question.type as any).format as "date" | "dateRange";
    if (format === "dateRange") {
      // Temporary fallback: simple text input; will be replaced by TypeFormDate(range) in Phase 1
      return (
        <TypeFormTextInput
          value={toStringVal(response)}
          onChange={(v: string) => onAnswer(v)}
          onSubmit={onNext}
          type="text"
          placeholder="YYYY-MM-DD to YYYY-MM-DD"
          required={Boolean((question as any).validations?.required?.value)}
          maxLength={undefined}
          minLength={undefined}
          pattern={undefined}
          ariaLabel={question.title}
          onValidate={undefined}
        />
      );
    }
    const dateVal = parseISODate(response);
    return (
      <UnifiedDatePicker
        mode="typeform"
        value={dateVal}
        onChange={(d: Date | null) =>
          onAnswer(d ? d.toISOString().slice(0, 10) : "")
        }
        onSubmit={onNext}
        className=""
        minDate={undefined as unknown as Date}
        maxDate={undefined as unknown as Date}
      />
    );
  }

  // File upload (use UnifiedFileUpload with Typeform mode)
  if (t === "fileUpload") {
    const v = (question as any).validations || {};
    return (
      <UnifiedFileUpload
        mode="typeform"
        value={null}
        onChange={(file: File | File[] | null) => onAnswer(file as any)}
        onFileUpload={onFileUpload as any}
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
      <div
        className="relative z-10 pointer-events-auto"
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        <TypeFormAddress
          value={val}
          onCompleteChange={(addr: any) => onAnswer(addr as any)}
          onSubmit={onNext}
          required={Boolean((question as any).validations?.required?.value)}
        />
      </div>
    );
  }

  // Ranking
  if (t === "ranking") {
    const options =
      ((question.type as any).options as Array<{
        value: string;
        label: string;
      }>) || [];
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

  // Fallback to text
  return (
    <TypeFormTextInput
      value={toStringVal(response)}
      onChange={(v: string) => onAnswer(v)}
      onSubmit={onNext}
      type="text"
      placeholder={String((question as any).placeholder ?? "")}
      required={Boolean((question as any).validations?.required?.value)}
      maxLength={(question as any).validations?.maxLength?.value}
      minLength={(question as any).validations?.minLength?.value}
      pattern={(question as any).validations?.pattern?.value}
      ariaLabel={question.title}
      onValidate={undefined}
    />
  );
}
