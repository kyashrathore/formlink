"use client";

import {
  Question,
  getLinearScaleConfig,
  getOptions,
  getQuestionTypeName,
  getRatingConfig,
  getTextFormat,
  isChoiceQuestion,
  isFileUploadQuestion,
  isLinearScaleQuestion,
  isRankingQuestion,
  isRatingQuestion,
  isTextQuestion,
} from "@formlink/schema";
import { UIResponseValue } from "../types/generic";
import { useFormMode } from "./context/FormModeContext";
import { UnifiedFormInput } from "./modes/unified/UnifiedFormInput";
import { FormInputType } from "./registry";

interface InputContainerProps {
  currentQuestion: Question;
  currentResponse: UIResponseValue;
  handleSelect: (questionId: string, value: UIResponseValue) => void;
  handleFileUpload?: (questionId: string, file: File) => Promise<void>;
  showNextButton?: boolean;
  disabled?: boolean;
  uploadedFile?: File | null;
  onFileSelect?: (file: File | null) => void;
  isUploading?: boolean;
  onNext?: () => void;
  questionNumber?: number;
  onValidationChange?: (
    errors: Array<{ type: string; message: string }>,
  ) => void;
}

/**
 * Temporary compatibility: normalize legacy question objects produced by older generators.
 * Converts shapes like:
 *  - { type: "question", questionType: "text", display: { inputType: "email" } }
 * into the new discriminated union:
 *  - { type: { name: "text", format: "email" } }
 */
function normalizeLegacyQuestion(raw: any): Question {
  // Already in new format
  if (
    raw?.type &&
    typeof raw.type === "object" &&
    typeof raw.type.name === "string"
  ) {
    return raw as Question;
  }

  // Legacy "type: 'question'" shape with "questionType"
  if (raw?.type === "question" && typeof raw?.questionType === "string") {
    const name = raw.questionType as string;
    const inputType = raw?.display?.inputType;

    const asChoiceOptions = Array.isArray(raw?.options) ? raw.options : [];

    switch (name) {
      case "text": {
        const allowed = [
          "text",
          "textarea",
          "email",
          "url",
          "tel",
          "number",
          "password",
          "country",
        ];
        const format = allowed.includes(inputType) ? inputType : "text";
        raw.type = { name: "text", format };
        break;
      }
      case "singleChoice": {
        const display = inputType === "dropdown" ? "dropdown" : "radio";
        raw.type = { name: "singleChoice", display, options: asChoiceOptions };
        break;
      }
      case "multipleChoice": {
        const display =
          inputType === "multiSelectDropdown"
            ? "multiSelectDropdown"
            : "checkbox";
        raw.type = {
          name: "multipleChoice",
          display,
          options: asChoiceOptions,
        };
        break;
      }
      case "date": {
        const format = inputType === "dateRange" ? "dateRange" : "date";
        raw.type = { name: "date", format };
        break;
      }
      case "rating": {
        const config = raw?.ratingConfig ?? { min: 1, max: 5, step: 1 };
        raw.type = { name: "rating", config };
        break;
      }
      case "linearScale": {
        const config = raw?.linearScaleConfig ?? { start: 1, end: 5, step: 1 };
        raw.type = { name: "linearScale", config };
        break;
      }
      case "likertScale": {
        let options: string[] = [];
        if (Array.isArray(raw?.options)) {
          options = raw.options
            .map((o: any) =>
              typeof o === "string" ? o : (o?.label ?? o?.value),
            )
            .filter(Boolean);
        }
        if (options.length === 0) {
          options = [
            "Strongly Disagree",
            "Disagree",
            "Neutral",
            "Agree",
            "Strongly Agree",
          ];
        }
        raw.type = { name: "likertScale", options };
        break;
      }
      case "address": {
        raw.type = { name: "address" };
        break;
      }
      case "ranking": {
        raw.type = { name: "ranking", options: asChoiceOptions };
        break;
      }
      case "fileUpload": {
        raw.type = { name: "fileUpload" };
        break;
      }
      default: {
        raw.type = { name: "text", format: "text" };
      }
    }
  }

  return raw as Question;
}

// Map Question schema to UnifiedFormInput props
function mapQuestionToUnifiedProps(
  question: Question,
  currentResponse: UIResponseValue,
  handleSelect: (questionId: string, value: UIResponseValue) => void,
  onNext?: () => void,
  onValidationChange?: (
    errors: Array<{ type: string; message: string }>,
  ) => void,
) {
  const q = normalizeLegacyQuestion(question as any);
  const questionType = getQuestionTypeName(q);

  // Map questionType to FormInputType
  let type: FormInputType;
  switch (questionType) {
    case "text": {
      if (!isTextQuestion(q)) {
        throw new Error(`Expected text question for ${question.id}`);
      }
      const inputType = getTextFormat(q);
      if (inputType === "tel") type = "tel";
      else if (inputType === "textarea") type = "textarea";
      else if (inputType === "star") type = "rating";
      else type = inputType as FormInputType;
      break;
    }
    case "singleChoice":
      type = "select";
      break;
    case "multipleChoice":
      type = "multipleChoice";
      break;
    case "address":
      type = "address";
      break;
    case "rating":
      type = "rating";
      break;
    case "linearScale":
      type = "linear-scale";
      break;
    case "date":
      type = "date";
      break;
    case "fileUpload":
      type = "fileUpload";
      break;
    case "ranking":
      type = "ranking";
      break;
    case "likertScale":
      type = "likert-scale";
      break;
    default:
      type = "text";
  }

  // Defensive: never treat plain text format as number
  if (questionType === "text") {
    const rawFormat = (q as any)?.type?.format;
    if (rawFormat !== "number" && type === "number") {
      type = "text";
    }
  }

  // Convert currentResponse to appropriate format and handle null values
  let value = currentResponse;
  if (
    type === "date" &&
    typeof currentResponse === "string" &&
    currentResponse
  ) {
    value = currentResponse; // Keep as string for UIResponseValue compatibility
  }

  // Ensure inputs never receive null values - convert to appropriate defaults
  if (
    (type === "text" ||
      type === "email" ||
      type === "url" ||
      type === "tel" ||
      type === "password" ||
      type === "textarea" ||
      type === "number") &&
    value === null
  ) {
    value = "";
  }

  // Ranking expects an array, handle JSON strings and null values
  if (type === "ranking") {
    if (value === null) {
      value = [];
    } else if (typeof value === "string" && value) {
      try {
        value = JSON.parse(value);
      } catch {
        value = [];
      }
    } else if (!Array.isArray(value)) {
      value = [];
    }
  }

  // MultiSelect expects an array, not null
  if ((type === "multiselect" || type === "multipleChoice") && value === null) {
    value = [];
  }

  // Let rating, linear-scale, and likert-scale components handle null values naturally
  // Components should handle null gracefully without immediate validation errors

  // Date components expect empty string, not null (additional handling)
  if (type === "date" && value === null) {
    value = "";
  }

  // Address expects an object, not null
  if (type === "address" && value === null) {
    value = {
      street1: "",
      street2: "",
      city: "",
      stateProvince: "",
      postalCode: "",
      country: "",
    };
  }

  // Base props
  const baseProps = {
    type,
    value,
    onChange: (newValue: unknown) => {
      const castValue = newValue as UIResponseValue;
      // Ranking values need to be stringified back to JSON
      if (type === "ranking") {
        handleSelect(question.id, JSON.stringify(castValue));
      } else {
        handleSelect(question.id, castValue);
      }
    },
    onSubmit: onNext as (() => void) | undefined,
    disabled: false,
    required: Boolean(question.validations?.required),
    placeholder: (question as any).placeholder,
    // Wire validation constraints through to primitives
    minLength: (question as any).validations?.minLength?.value,
    maxLength: (question as any).validations?.maxLength?.value,
    pattern: (question as any).validations?.pattern?.value,
    onValidationChange: onValidationChange,
  };

  // Type-specific props
  if (type === "select" || type === "multipleChoice" || type === "ranking") {
    if (isChoiceQuestion(q) || isRankingQuestion(q)) {
      (baseProps as Record<string, unknown>).options = getOptions(q);
    } else {
      (baseProps as Record<string, unknown>).options = [];
    }
  }

  if (type === "rating") {
    if (isRatingQuestion(q)) {
      const config = getRatingConfig(q);
      (baseProps as Record<string, unknown>).max = config.max;
    } else {
      (baseProps as Record<string, unknown>).max = 5;
    }
  }

  if (type === "linear-scale") {
    if (isLinearScaleQuestion(q)) {
      const linearConfig = getLinearScaleConfig(q);
      (baseProps as Record<string, unknown>).config = {
        start: linearConfig.start,
        end: linearConfig.end,
        step: linearConfig.step || 1,
        startLabel: linearConfig.startLabel,
        endLabel: linearConfig.endLabel,
      };
    } else {
      (baseProps as Record<string, unknown>).config = {
        start: 1,
        end: 10,
        step: 1,
      };
    }
  }

  if (type === "fileUpload") {
    if (isFileUploadQuestion(q)) {
      // File upload questions don't have config in current schema, using defaults
      (baseProps as Record<string, unknown>).accept = undefined;
      (baseProps as Record<string, unknown>).maxSize = 5 * 1024 * 1024; // 5MB default
    } else {
      (baseProps as Record<string, unknown>).accept = undefined;
      (baseProps as Record<string, unknown>).maxSize = 5 * 1024 * 1024;
    }
  }

  return baseProps;
}

export function InputContainer(props: InputContainerProps) {
  const { mode } = useFormMode();
  const { currentQuestion, currentResponse, handleSelect, onNext } = props;

  // Map to unified props
  const unifiedProps = mapQuestionToUnifiedProps(
    currentQuestion,
    currentResponse,
    handleSelect,
    onNext,
    props.onValidationChange,
  );
  const { handleFileUpload, uploadedFile, onFileSelect, isUploading } = props;

  // Extract file upload props to pass through

  return (
    <UnifiedFormInput
      mode={mode as "chat" | "typeform"}
      {...unifiedProps}
      onFileUpload={handleFileUpload}
      uploadedFile={uploadedFile}
      onFileSelect={onFileSelect}
      isUploading={isUploading}
      questionId={currentQuestion.id}
    />
  );
}

export default InputContainer;
