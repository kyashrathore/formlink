"use client";

import React from "react";
import { UIQuestion, UIResponseValue } from "../types/generic";
import { useFormMode } from "./context/FormModeContext";
import { UnifiedFormInput } from "./modes/unified/UnifiedFormInput";
import { FormInputType } from "./registry";

interface InputContainerProps {
  currentQuestion: UIQuestion;
  currentResponse: UIResponseValue;
  handleSelect: (
    questionId: string,
    value: UIResponseValue
  ) => void;
  handleFileUpload?: (questionId: string, file: File) => Promise<void>;
  showNextButton?: boolean;
  disabled?: boolean;
  uploadedFile?: File | null;
  onFileSelect?: (file: File | null) => void;
  isUploading?: boolean;
  onNext?: () => void;
  questionNumber?: number;
}

// Map Question schema to UnifiedFormInput props
function mapQuestionToUnifiedProps(
  question: UIQuestion,
  currentResponse: UIResponseValue,
  handleSelect: (questionId: string, value: UIResponseValue) => void,
  onNext?: () => void
) {
  const questionType = question.questionType;
  
  // Map questionType to FormInputType
  let type: FormInputType;
  switch (questionType) {
    case "text": {
      const inputType = question.display?.inputType || "text";
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

  // Convert currentResponse to appropriate format and handle null values
  let value = currentResponse;
  if (type === "date" && typeof currentResponse === "string" && currentResponse) {
    value = currentResponse; // Keep as string for UIResponseValue compatibility
  }
  
  // Ensure inputs never receive null values - convert to appropriate defaults
  if ((type === "text" || type === "email" || type === "url" || type === "tel" || type === "password" || type === "textarea") && value === null) {
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
  
  // Base props
  const baseProps = {
    type,
    value,
    onChange: (newValue: UIResponseValue) => {
      // Ranking values need to be stringified back to JSON
      if (type === "ranking") {
        handleSelect(question.id, JSON.stringify(newValue));
      } else {
        handleSelect(question.id, newValue);
      }
    },
    onSubmit: onNext as (() => void) | undefined,
    disabled: false,
    required: Boolean(question.validations?.required?.value || question.required),
    placeholder: question.placeholder || question.display?.placeholder,
  };

  // Type-specific props
  if (type === "select" || type === "multipleChoice" || type === "ranking") {
    (baseProps as Record<string, unknown>).options = question.options || [];
  }
  
  if (type === "rating") {
    (baseProps as Record<string, unknown>).max = question.ratingConfig?.max || 5;
  }
  
  if (type === "linear-scale") {
    const linearConfig = question.linearScaleConfig;
    (baseProps as Record<string, unknown>).config = {
      start: linearConfig?.min || linearConfig?.start || 1,
      end: linearConfig?.max || linearConfig?.end || 5,
      step: linearConfig?.step || 1,
      startLabel: linearConfig?.startLabel,
      endLabel: linearConfig?.endLabel,
    };
  }
  
  if (type === "fileUpload") {
    (baseProps as Record<string, unknown>).accept = question.validations?.fileTypes;
    (baseProps as Record<string, unknown>).maxSize = 5 * 1024 * 1024; // 5MB default
  }

  return baseProps;
}

export function InputContainer(props: InputContainerProps) {
  const { mode } = useFormMode();
  const { 
    currentQuestion, 
    currentResponse, 
    handleSelect, 
    onNext
  } = props;
  
  
  // Map to unified props
  const unifiedProps = mapQuestionToUnifiedProps(
    currentQuestion,
    currentResponse,
    handleSelect,
    onNext
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