/**
 * Simple mapping functions to convert FormJunction schema types to UI generic types
 *
 * This file bridges the gap between FormJunction's specific schema and the generic UI components.
 * Each mapper function converts from FormJunction's schema to the UI's generic interfaces.
 */

import { Form, Question, Option } from "@formlink/schema";

import { UIForm, UIQuestion, UIOption, UIQuestionType } from "@formlink/ui";

// Extended Option interface for UI mapping
interface ExtendedOption extends Option {
  description?: string;
}

// Extended Settings interface for UI mapping
interface ExtendedSettings {
  requireAuth?: boolean;
  submitOnce?: boolean;
  [key: string]: unknown;
}

// ============================================================================
// Option Mapping
// ============================================================================

function mapOptionToUI(option: Option): UIOption {
  const extendedOption = option as ExtendedOption;
  return {
    label: option.label,
    value: option.value,
    description: extendedOption.description, // Optional field
  };
}

function mapOptionsToUI(options: Option[]): UIOption[] {
  return options.map(mapOptionToUI);
}

// ============================================================================
// Question Mapping
// ============================================================================

export function mapQuestionToUI(question: Question): UIQuestion {
  const baseQuestion = {
    id: question.id,
    title: question.title,
    description: question.description,
    questionType: question.questionType as UIQuestionType,
    required: (question.validations?.required?.value as boolean) || false,
    validations: question.validations || {},
    display: {
      helpText: question.description,
    },
  };

  // Handle choice questions with options
  if (
    question.questionType === "multipleChoice" ||
    question.questionType === "singleChoice" ||
    question.questionType === "ranking"
  ) {
    const choiceQuestion = question as typeof question & { options: Option[] };
    return {
      ...baseQuestion,
      options: choiceQuestion.options
        ? mapOptionsToUI(choiceQuestion.options)
        : undefined,
    };
  }

  // Handle rating questions
  if (question.questionType === "rating") {
    const ratingQuestion = question as typeof question & {
      ratingConfig: { max: number; min?: number };
    };
    return {
      ...baseQuestion,
      ratingConfig: ratingQuestion.ratingConfig,
    };
  }

  // Handle linear scale questions
  if (question.questionType === "linearScale") {
    const scaleQuestion = question as typeof question & {
      linearScaleConfig: {
        start: number;
        end: number;
        startLabel?: string;
        endLabel?: string;
      };
    };
    return {
      ...baseQuestion,
      linearScaleConfig: {
        min: scaleQuestion.linearScaleConfig.start,
        max: scaleQuestion.linearScaleConfig.end,
        startLabel: scaleQuestion.linearScaleConfig.startLabel,
        endLabel: scaleQuestion.linearScaleConfig.endLabel,
      },
    };
  }

  // Default case for simple questions
  return baseQuestion;
}

function mapQuestionsToUI(questions: Question[]): UIQuestion[] {
  return questions.map(mapQuestionToUI);
}

// ============================================================================
// Reverse Mapping - UI to Schema
// ============================================================================

// Helper function to map questionType to inputType
function getInputTypeForQuestionType(
  questionType: UIQuestion["questionType"],
): string {
  const mapping: Record<UIQuestion["questionType"], string> = {
    text: "text",
    email: "email",
    url: "url",
    tel: "tel",
    password: "password",
    textarea: "textarea",
    number: "number",
    multipleChoice: "checkbox",
    singleChoice: "radio",
    ranking: "rankOrder",
    rating: "star",
    linearScale: "linearScale",
    likertScale: "likertScale",
    date: "date",
    address: "addressBlock",
    fileUpload: "file",
  };
  return mapping[questionType] || "text";
}

export function mapUIToQuestion(uiQuestion: UIQuestion): Question {
  // Convert UI validations to schema format
  const convertedValidations: any = {};

  if (uiQuestion.required) {
    convertedValidations.required = { value: true };
  }

  if (uiQuestion.validations?.minLength) {
    convertedValidations.minLength = {
      value:
        typeof uiQuestion.validations.minLength.value === "number"
          ? uiQuestion.validations.minLength.value
          : parseInt(String(uiQuestion.validations.minLength.value), 10) || 0,
      message: uiQuestion.validations.minLength.message,
    };
  }

  if (uiQuestion.validations?.maxLength) {
    convertedValidations.maxLength = {
      value:
        typeof uiQuestion.validations.maxLength.value === "number"
          ? uiQuestion.validations.maxLength.value
          : parseInt(String(uiQuestion.validations.maxLength.value), 10) || 0,
      message: uiQuestion.validations.maxLength.message,
    };
  }

  if (uiQuestion.validations?.pattern) {
    convertedValidations.pattern = {
      value: String(uiQuestion.validations.pattern.value),
      message: uiQuestion.validations.pattern.message,
    };
  }

  // Common base properties for all question types
  const baseProps = {
    type: "question" as const,
    id: uiQuestion.id,
    questionNo: 1, // Default value - this should be set by the parent form
    title: uiQuestion.title,
    description: uiQuestion.description,
    validations: convertedValidations,
    display: {
      inputType: getInputTypeForQuestionType(uiQuestion.questionType) as any,
      showTitle: true,
      showDescription: !!uiQuestion.description,
    },
    submissionBehavior: "manualAnswer" as const,
  };

  // Handle choice questions with options
  if (
    uiQuestion.questionType === "multipleChoice" ||
    uiQuestion.questionType === "singleChoice"
  ) {
    return {
      ...baseProps,
      questionType: uiQuestion.questionType,
      options:
        uiQuestion.options?.map((opt) => ({
          label: opt.label,
          value: opt.value,
        })) || [],
    } as Question;
  }

  // Handle ranking questions
  if (uiQuestion.questionType === "ranking") {
    return {
      ...baseProps,
      questionType: "ranking",
      options:
        uiQuestion.options?.map((opt) => ({
          label: opt.label,
          value: opt.value,
        })) || [],
    } as Question;
  }

  // Handle rating questions
  if (uiQuestion.questionType === "rating") {
    return {
      ...baseProps,
      questionType: "rating",
      ratingConfig: {
        max: uiQuestion.ratingConfig?.max || 5,
        min: 1, // Default minimum value
        step: 1, // Default step value
        minLabel: undefined,
        maxLabel: undefined,
      },
    } as Question;
  }

  // Handle linear scale questions
  if (uiQuestion.questionType === "linearScale") {
    return {
      ...baseProps,
      questionType: "linearScale",
      linearScaleConfig: {
        start:
          uiQuestion.linearScaleConfig?.min ??
          uiQuestion.linearScaleConfig?.start ??
          1,
        end:
          uiQuestion.linearScaleConfig?.max ??
          uiQuestion.linearScaleConfig?.end ??
          10,
        startLabel: uiQuestion.linearScaleConfig?.startLabel,
        endLabel: uiQuestion.linearScaleConfig?.endLabel,
      },
    } as Question;
  }

  // Handle likert scale questions
  if (uiQuestion.questionType === "likertScale") {
    return {
      ...baseProps,
      questionType: "likertScale",
      options: uiQuestion.options?.map((opt) => opt.value) || [],
    } as Question;
  }

  // Handle basic questions (text, date, address, fileUpload)
  // Map UI question types to schema question types
  let schemaQuestionType: "text" | "date" | "address" | "fileUpload";
  switch (uiQuestion.questionType) {
    case "text":
    case "email":
    case "url":
    case "tel":
    case "password":
    case "textarea":
    case "number":
      schemaQuestionType = "text";
      break;
    case "date":
      schemaQuestionType = "date";
      break;
    case "address":
      schemaQuestionType = "address";
      break;
    case "fileUpload":
      schemaQuestionType = "fileUpload";
      break;
    default:
      schemaQuestionType = "text";
  }

  return {
    ...baseProps,
    questionType: schemaQuestionType,
  } as Question;
}

// ============================================================================
// Form Mapping
// ============================================================================

export function mapFormToUI(form: Form): UIForm {
  const extendedSettings = (form.settings || {}) as ExtendedSettings;
  return {
    id: form.id,
    title: form.title,
    description: form.description,
    questions: mapQuestionsToUI(form.questions || []),
    version_id: form.version_id,
    settings: {
      allowAnonymous: !extendedSettings.requireAuth,
      requireAuth: extendedSettings.requireAuth || false,
      submitOnce: extendedSettings.submitOnce || false,
    },
  };
}
