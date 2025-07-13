/**
 * Simple mapping functions to convert FormJunction schema types to UI generic types
 *
 * This file bridges the gap between FormJunction's specific schema and the generic UI components.
 * Each mapper function converts from FormJunction's schema to the UI's generic interfaces.
 */

import { Form, Question, Option } from "@formlink/schema";

import { UIForm, UIQuestion, UIOption, UIQuestionType } from "@formlink/ui";

// ============================================================================
// Option Mapping
// ============================================================================

function mapOptionToUI(option: Option): UIOption {
  return {
    label: option.label,
    value: option.value,
    description: (option as any).description, // Optional field
  };
}

function mapOptionsToUI(options: Option[]): UIOption[] {
  return options.map(mapOptionToUI);
}

// ============================================================================
// Question Mapping
// ============================================================================

export function mapQuestionToUI(question: Question): UIQuestion {
  const q = question as any; // Cast to any to handle schema type mismatches
  return {
    id: q.id,
    title: q.title,
    description: q.description,
    questionType: q.type as UIQuestionType,
    required: q.required || false,
    placeholder: q.settings?.placeholder,
    options: q.options ? mapOptionsToUI(q.options) : undefined,
    validations: q.validations || {},
    display: {
      placeholder: q.settings?.placeholder,
      helpText: q.description,
    },
    // Map type-specific configurations
    linearScaleConfig: q.settings?.steps
      ? {
          min: q.settings.start_at_zero ? 0 : 1,
          max: q.settings.steps,
          startLabel: q.settings.labels?.[0],
          endLabel: q.settings.labels?.[1],
        }
      : undefined,
    ratingConfig: q.settings?.steps
      ? {
          max: q.settings.steps,
        }
      : undefined,
  };
}

function mapQuestionsToUI(questions: Question[]): UIQuestion[] {
  return questions.map(mapQuestionToUI);
}

// ============================================================================
// Form Mapping
// ============================================================================

export function mapFormToUI(form: Form): UIForm {
  return {
    id: form.id,
    title: form.title,
    description: form.description,
    questions: mapQuestionsToUI(form.questions || []),
    version_id: form.version_id,
    settings: {
      allowAnonymous: !(form.settings as any)?.requireAuth,
      requireAuth: (form.settings as any)?.requireAuth || false,
      submitOnce: (form.settings as any)?.submitOnce || false,
    },
  };
}
