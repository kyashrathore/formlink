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
  const questionType = (question.type as any).name;
  const baseQuestion = {
    id: question.id,
    title: question.title,
    description: question.description,
    questionType: questionType as UIQuestionType,
    required: (question.validations?.required?.value as boolean) || false,
    validations: question.validations || {},
    display: {
      helpText: question.description,
    },
  };

  // Handle choice questions with options
  if (
    questionType === "multipleChoice" ||
    questionType === "singleChoice" ||
    questionType === "ranking"
  ) {
    const typeWithOptions = question.type as any;
    return {
      ...baseQuestion,
      options: typeWithOptions?.options
        ? mapOptionsToUI(typeWithOptions.options)
        : undefined,
    };
  }

  // Handle rating questions
  if (questionType === "rating") {
    const ratingType = question.type as any;
    return {
      ...baseQuestion,
      ratingConfig: ratingType.config,
    };
  }

  // Handle linear scale questions
  if (questionType === "linearScale") {
    const scaleType = question.type as any;
    return {
      ...baseQuestion,
      linearScaleConfig: {
        min: scaleType.config.start,
        max: scaleType.config.end,
        startLabel: scaleType.config.startLabel,
        endLabel: scaleType.config.endLabel,
      },
    };
  }

  // Handle likert scale questions
  if (questionType === "likertScale") {
    const likertType = question.type as any;
    return {
      ...baseQuestion,
      options: likertType.options
        ? likertType.options.map((opt: string, index: number) => ({
            label: opt,
            value: String(index),
          }))
        : undefined,
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

// Helper function to map UI question type to new schema type
function mapUIQuestionTypeToSchemaType(
  questionType: UIQuestion["questionType"],
): any {
  switch (questionType) {
    case "text":
      return { name: "text" as const, format: "text" as const };
    case "email":
      return { name: "text" as const, format: "email" as const };
    case "url":
      return { name: "text" as const, format: "url" as const };
    case "tel":
      return { name: "text" as const, format: "tel" as const };
    case "password":
      return { name: "text" as const, format: "password" as const };
    case "textarea":
      return { name: "text" as const, format: "textarea" as const };
    case "number":
      return { name: "text" as const, format: "number" as const };
    case "multipleChoice":
      return {
        name: "multipleChoice" as const,
        display: "checkbox" as const,
        options: [],
      };
    case "singleChoice":
      return {
        name: "singleChoice" as const,
        display: "radio" as const,
        options: [],
      };
    case "ranking":
      return { name: "ranking" as const, options: [] };
    case "rating":
      return { name: "rating" as const, config: { min: 1, max: 5, step: 1 } };
    case "linearScale":
      return {
        name: "linearScale" as const,
        config: { start: 1, end: 10, step: 1 },
      };
    case "likertScale":
      return { name: "likertScale" as const, options: [] };
    case "date":
      return { name: "date" as const, format: "date" as const };
    case "address":
      return { name: "address" as const };
    case "fileUpload":
      return { name: "fileUpload" as const };
    default:
      return { name: "text" as const, format: "text" as const };
  }
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

  // Get the schema type based on UI question type
  let schemaType = mapUIQuestionTypeToSchemaType(uiQuestion.questionType);

  // Override with specific options if available
  if (
    uiQuestion.options &&
    (schemaType.name === "multipleChoice" ||
      schemaType.name === "singleChoice" ||
      schemaType.name === "ranking")
  ) {
    schemaType = {
      ...schemaType,
      options: uiQuestion.options.map((opt) => ({
        label: opt.label,
        value: opt.value,
      })),
    };
  }

  // Override with specific rating config if available
  if (uiQuestion.ratingConfig && schemaType.name === "rating") {
    schemaType = {
      ...schemaType,
      config: {
        max: uiQuestion.ratingConfig.max || 5,
        min: (uiQuestion.ratingConfig as any).min || 1,
        step: 1,
      },
    };
  }

  // Override with specific linear scale config if available
  if (uiQuestion.linearScaleConfig && schemaType.name === "linearScale") {
    schemaType = {
      ...schemaType,
      config: {
        start:
          uiQuestion.linearScaleConfig.min ??
          uiQuestion.linearScaleConfig.start ??
          1,
        end:
          uiQuestion.linearScaleConfig.max ??
          uiQuestion.linearScaleConfig.end ??
          10,
        step: 1,
        startLabel: uiQuestion.linearScaleConfig.startLabel,
        endLabel: uiQuestion.linearScaleConfig.endLabel,
      },
    };
  }

  // Override with likert scale options if available
  if (uiQuestion.options && schemaType.name === "likertScale") {
    schemaType = {
      ...schemaType,
      options: uiQuestion.options.map((opt) => opt.value),
    };
  }

  // Common base properties for all question types
  return {
    id: uiQuestion.id,
    questionNo: 1, // Default value - this should be set by the parent form
    title: uiQuestion.title,
    description: uiQuestion.description,
    type: schemaType,
    validations: convertedValidations,
    submissionBehavior: "manualAnswer" as const,
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
