"use client";

import type { QuestionResponse } from "@/lib/types";
import type { Question } from "@formlink/schema";
import {
  getLinearScaleConfig,
  getOptions,
  getRatingConfig,
  isAddressQuestion,
  isChoiceQuestion,
  isDateQuestion,
  isFileUploadQuestion,
  isLikertScaleQuestion,
  isLinearScaleQuestion,
  isRankingQuestion,
  isRatingQuestion,
  isTextQuestion,
} from "@formlink/schema";
import {
  Checkbox,
  Input,
  Label,
  RadioGroup,
  RadioGroupItem,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@formlink/ui";
import AddressInput from "./AddressInput";
import DatePickerWrapper from "./DatePickerWrapper";
import RankingInput from "./RankingInput";
import RatingSlider from "./RatingSlider";
import FileUploadInput from "./FileUploadInput";
import { getPlaceholder } from "@/components/typeform/utils/placeholders";

interface QuestionInputSwitcherProps {
  question: Question;
  value: QuestionResponse;
  onChange: (value: QuestionResponse) => void;
  onFileUpload?: (file: File) => Promise<string | null>;
  fieldProps?: {
    name: string;
    onBlur: () => void;
    disabled?: boolean;
  };
}

export default function QuestionInputSwitcher({
  question,
  value,
  onChange,
  onFileUpload,
  fieldProps,
}: QuestionInputSwitcherProps) {
  // Text Question (including number, tel, and country formats)
  if (isTextQuestion(question)) {
    const format = question.type.format;
    const isLongText = format === "textarea";
    const isNumber = format === "number";
    const isTel = format === "tel";
    const isCountry = format === "country";
    const placeholder = getPlaceholder(
      question.type.name,
      question.type.format,
      (question as any).placeholder,
    );

    // Phone number: simple shadcn input
    if (isTel) {
      return (
        <Input
          type="tel"
          placeholder={"Enter phone number..."}
          value={(value as string) || ""}
          onChange={(e) => onChange(e.target.value)}
          className="w-full"
          {...fieldProps}
        />
      );
    }

    // Country: simple text input (ISO-2 or name per backend convention)
    if (isCountry) {
      return (
        <Input
          type="text"
          placeholder={"Enter country"}
          value={(value as string) || ""}
          onChange={(e) => onChange(e.target.value)}
          className="w-full"
          {...fieldProps}
        />
      );
    }

    if (isLongText) {
      return (
        <Textarea
          placeholder={placeholder}
          value={(value as string) || ""}
          onChange={(e) => onChange(e.target.value)}
          {...fieldProps}
          className="min-h-[120px] w-full"
        />
      );
    }

    if (isNumber) {
      return (
        <Input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          placeholder={placeholder || "Enter a number..."}
          value={(value as string | number) || ""}
          onChange={(e) => {
            const val = e.target.value;
            // Only allow numeric characters, optional decimal point, and optional minus sign
            const sanitized = val.replace(/[^0-9.-]/g, "");

            // Ensure only one decimal point
            const parts = sanitized.split(".");
            const formatted =
              parts.length > 2
                ? parts[0] + "." + parts.slice(1).join("")
                : sanitized;

            // Ensure minus sign is only at the beginning
            const minusCount = (formatted.match(/-/g) || []).length;
            const cleanedValue =
              minusCount > 1
                ? formatted.replace(/-/g, "").replace(/^/, "-")
                : minusCount === 1 && !formatted.startsWith("-")
                  ? formatted.replace(/-/g, "")
                  : formatted;

            // Convert to number if valid, otherwise keep as string
            const numVal =
              cleanedValue === "" ||
              cleanedValue === "-" ||
              cleanedValue === "." ||
              cleanedValue === "-."
                ? cleanedValue
                : isNaN(Number(cleanedValue))
                  ? value // Keep previous value if invalid
                  : Number(cleanedValue);

            onChange(numVal);
          }}
          onKeyDown={(e) => {
            // Allow backspace, delete, tab, escape, enter, arrows
            const allowedKeys = [
              "Backspace",
              "Delete",
              "Tab",
              "Escape",
              "Enter",
              "ArrowLeft",
              "ArrowRight",
              "ArrowUp",
              "ArrowDown",
              "Home",
              "End",
            ];
            if (allowedKeys.includes(e.key)) {
              return;
            }

            // Allow Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
            if (
              (e.key === "a" ||
                e.key === "c" ||
                e.key === "v" ||
                e.key === "x") &&
              (e.ctrlKey || e.metaKey)
            ) {
              return;
            }

            const currentValue = (e.target as HTMLInputElement).value;
            const selectionStart =
              (e.target as HTMLInputElement).selectionStart || 0;

            // Allow minus only at the beginning
            if (e.key === "-") {
              if (selectionStart !== 0 || currentValue.includes("-")) {
                e.preventDefault();
              }
              return;
            }

            // Allow only one decimal point
            if (e.key === ".") {
              if (currentValue.includes(".")) {
                e.preventDefault();
              }
              return;
            }

            // Only allow numeric keys
            if (!/^[0-9]$/.test(e.key)) {
              e.preventDefault();
            }
          }}
          className="w-full"
          {...fieldProps}
        />
      );
    }

    return (
      <Input
        type="text"
        placeholder={placeholder}
        value={(value as string) || ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full"
        {...fieldProps}
      />
    );
  }

  // Single Choice Question
  if (isChoiceQuestion(question) && question.type.name === "singleChoice") {
    const options = getOptions(question);
    const displayStyle = question.type.display || "dropdown";

    if (displayStyle === "dropdown") {
      return (
        <Select
          value={(value as string) || ""}
          onValueChange={onChange}
          disabled={fieldProps?.disabled}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select an option..." />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    // Radio buttons
    return (
      <RadioGroup
        value={(value as string) || ""}
        onValueChange={onChange}
        disabled={fieldProps?.disabled}
        className="space-y-2"
      >
        {options.map((option) => (
          <div key={option.value} className="flex items-center space-x-2">
            <RadioGroupItem
              value={option.value}
              id={`${question.id}-${option.value}`}
            />
            <Label
              htmlFor={`${question.id}-${option.value}`}
              className="font-normal"
            >
              {option.label}
            </Label>
          </div>
        ))}
      </RadioGroup>
    );
  }

  // Multiple Choice Question
  if (isChoiceQuestion(question) && question.type.name === "multipleChoice") {
    const options = getOptions(question);
    const selectedValues = (value as string[]) || [];

    return (
      <div className="space-y-3">
        {options.map((option) => (
          <div key={option.value} className="flex items-center space-x-2">
            <Checkbox
              id={`${question.id}-${option.value}`}
              checked={selectedValues.includes(option.value)}
              onCheckedChange={(checked) => {
                if (checked) {
                  onChange([...selectedValues, option.value]);
                } else {
                  onChange(selectedValues.filter((v) => v !== option.value));
                }
              }}
              disabled={fieldProps?.disabled}
            />
            <Label
              htmlFor={`${question.id}-${option.value}`}
              className="font-normal"
            >
              {option.label}
            </Label>
          </div>
        ))}
      </div>
    );
  }

  // Rating Question
  if (isRatingQuestion(question)) {
    const config = getRatingConfig(question);

    return (
      <RatingSlider
        min={config.min}
        max={config.max}
        step={config.step}
        minLabel={config.minLabel}
        maxLabel={config.maxLabel}
        value={(value as number) || config.min}
        onChange={onChange}
        disabled={fieldProps?.disabled}
        iconType="star"
      />
    );
  }

  // Linear Scale Question
  if (isLinearScaleQuestion(question)) {
    const config = getLinearScaleConfig(question);

    return (
      <RatingSlider
        min={config.start}
        max={config.end}
        step={config.step}
        minLabel={config.startLabel}
        maxLabel={config.endLabel}
        value={(value as number) || config.start}
        onChange={onChange}
        disabled={fieldProps?.disabled}
        iconType="numeric"
      />
    );
  }

  // Likert Scale Question
  if (isLikertScaleQuestion(question)) {
    const options = question.type.options || [];

    return (
      <RadioGroup
        value={(value as string) || ""}
        onValueChange={onChange}
        disabled={fieldProps?.disabled}
        className="flex flex-wrap gap-6 justify-start"
      >
        {options.map((option, index) => (
          <div key={index} className="flex flex-col items-start">
            <RadioGroupItem value={option} id={`${question.id}-${index}`} />
            <Label
              htmlFor={`${question.id}-${index}`}
              className="mt-2 text-sm font-normal text-left"
            >
              {option}
            </Label>
          </div>
        ))}
      </RadioGroup>
    );
  }

  // Date Question
  if (isDateQuestion(question)) {
    return (
      <DatePickerWrapper
        value={(value as string) || ""}
        onChange={onChange}
        dateFormat="MM/DD/YYYY"
        disabled={fieldProps?.disabled}
      />
    );
  }

  // File Upload Question
  if (isFileUploadQuestion(question)) {
    // Ensure value is properly typed - could be File, object with url, null, or undefined
    let fileValue: { url: string; name: string; size: number } | null = null;

    if (value && typeof value === "object") {
      if ("url" in value && "name" in value && "size" in value) {
        fileValue = value as { url: string; name: string; size: number };
      }
    }

    return (
      <FileUploadInput
        value={fileValue}
        onChange={onChange}
        onFileUpload={onFileUpload}
        disabled={fieldProps?.disabled}
        accept="*"
        maxSize={10 * 1024 * 1024} // 10MB max
      />
    );
  }

  // Address Question
  if (isAddressQuestion(question)) {
    return (
      <AddressInput
        value={value}
        onChange={onChange}
        fields={[
          "street1",
          "street2",
          "city",
          "stateProvince",
          "postalCode",
          "country",
        ]}
        disabled={fieldProps?.disabled}
      />
    );
  }

  // Ranking Question
  if (isRankingQuestion(question)) {
    const options = getOptions(question);

    // Normalize value to an array for RankingInput (store may keep JSON string)
    let normalized: string[] = [];
    if (Array.isArray(value)) {
      normalized = value as string[];
    } else if (typeof value === "string" && value) {
      try {
        const parsed = JSON.parse(value as string);
        normalized = Array.isArray(parsed) ? (parsed as string[]) : [];
      } catch {
        normalized = [];
      }
    }

    return (
      <RankingInput
        options={options}
        value={normalized}
        onChange={(newVal: string[]) => onChange(newVal)}
        maxSelections={undefined}
        disabled={fieldProps?.disabled}
      />
    );
  }

  // Fallback for unknown question types
  return (
    <div className="p-4 border border-dashed border-gray-300 rounded-lg text-center text-gray-500">
      <p>Unsupported question type: {question.type.name}</p>
      <p className="text-xs mt-1">Question ID: {question.id}</p>
    </div>
  );
}
