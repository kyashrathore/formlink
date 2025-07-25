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
