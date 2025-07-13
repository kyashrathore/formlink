/**
 * Simple mapping functions to convert FormJunction schema types to UI generic types
 * 
 * This file bridges the gap between FormJunction's specific schema and the generic UI components.
 * Each mapper function converts from FormJunction's schema to the UI's generic interfaces.
 */

import { 
  Form, 
  Question, 
  AddressData, 
  Option 
} from "@formlink/schema";

import {
  UIForm,
  UIQuestion,
  UIAddressData,
  UIOption,
  UIQuestionType,
  UIResponseValue
} from "@formlink/ui";

// ============================================================================
// Option Mapping
// ============================================================================

export function mapOptionToUI(option: Option): UIOption {
  return {
    label: option.label,
    value: option.value,
    description: (option as any).description, // Optional field
  };
}

export function mapOptionsToUI(options: Option[]): UIOption[] {
  return options.map(mapOptionToUI);
}

// ============================================================================
// Address Mapping
// ============================================================================

export function mapAddressToUI(address: AddressData): UIAddressData {
  return {
    street1: address.street1 || "",
    street2: address.street2 || "",
    city: address.city || "",
    stateProvince: address.stateProvince || "",
    postalCode: address.postalCode || "",
    country: address.country || "",
  };
}

export function mapUIToAddress(uiAddress: UIAddressData): AddressData {
  return {
    street1: uiAddress.street1,
    street2: uiAddress.street2,
    city: uiAddress.city,
    stateProvince: uiAddress.stateProvince,
    postalCode: uiAddress.postalCode,
    country: uiAddress.country,
  };
}

// ============================================================================
// Question Type Mapping
// ============================================================================

function mapQuestionTypeToUI(questionType: string): UIQuestionType {
  // Direct mapping for most types
  switch (questionType) {
    case "text":
    case "email":
    case "url":
    case "tel":
    case "password":
    case "textarea":
    case "number":
    case "date":
    case "singleChoice":
    case "multipleChoice":
    case "address":
    case "rating":
    case "linearScale":
    case "likertScale":
    case "fileUpload":
    case "ranking":
      return questionType as UIQuestionType;
    default:
      console.warn(`Unknown question type: ${questionType}, defaulting to 'text'`);
      return "text";
  }
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
    questionType: mapQuestionTypeToUI(q.questionType),
    options: q.options ? mapOptionsToUI(q.options) : undefined,
    validations: q.validations ? {
      required: q.validations.required ? {
        value: q.validations.required.value,
        message: q.validations.required.message,
      } : undefined,
      minLength: q.validations.minLength ? {
        value: q.validations.minLength.value,
        message: q.validations.minLength.message,
      } : undefined,
      maxLength: q.validations.maxLength ? {
        value: q.validations.maxLength.value,
        message: q.validations.maxLength.message,
      } : undefined,
      pattern: q.validations.pattern ? {
        value: q.validations.pattern.value,
        message: q.validations.pattern.message,
      } : undefined,
      fileTypes: q.validations.fileTypes,
      maxFileSize: q.validations.maxFileSize,
    } : undefined,
    display: q.display ? {
      inputType: q.display.inputType,
      placeholder: q.display.placeholder,
      helpText: q.display.helpText,
    } : undefined,
    required: q.required || false,
    placeholder: q.placeholder || "",
    
    // Type-specific configurations
    linearScaleConfig: q.linearScaleConfig ? {
      min: q.linearScaleConfig.min,
      max: q.linearScaleConfig.max,
      start: q.linearScaleConfig.start,
      end: q.linearScaleConfig.end,
      step: q.linearScaleConfig.step,
      startLabel: q.linearScaleConfig.startLabel,
      endLabel: q.linearScaleConfig.endLabel,
    } : undefined,
    ratingConfig: q.ratingConfig ? {
      max: q.ratingConfig.max,
      icon: q.ratingConfig.icon,
    } : undefined,
    likertScaleConfig: q.likertScaleConfig ? {
      statements: q.likertScaleConfig.statements,
      scale: mapOptionsToUI(q.likertScaleConfig.scale),
    } : undefined,
    
    // Conditional logic (basic structure)
    conditionalLogic: q.conditionalLogic ? {
      field: q.conditionalLogic.field,
      value: q.conditionalLogic.value,
      operator: q.conditionalLogic.operator,
    } : undefined,
  };
}

export function mapQuestionsToUI(questions: Question[]): UIQuestion[] {
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
    settings: form.settings ? {
      allowAnonymous: (form.settings as any).allowAnonymous as boolean,
      requireAuth: (form.settings as any).requireAuth as boolean,
      submitOnce: (form.settings as any).submitOnce as boolean,
    } : undefined,
  };
}

// ============================================================================
// Response Value Mapping
// ============================================================================

export function mapResponseToUI(value: any): UIResponseValue {
  // Handle different response types
  if (value === null || value === undefined) {
    return null;
  }
  
  // AddressData
  if (value && typeof value === "object" && value.street1) {
    return mapAddressToUI(value as AddressData);
  }
  
  // File (already correct type)
  if (value instanceof File) {
    return value;
  }
  
  // Array of strings
  if (Array.isArray(value)) {
    return value as string[];
  }
  
  // String or number
  if (typeof value === "string" || typeof value === "number") {
    return value;
  }
  
  // Fallback to string representation
  return String(value);
}

export function mapUIToResponse(uiValue: UIResponseValue): any {
  // Handle different UI response types back to schema types
  if (uiValue === null || uiValue === undefined) {
    return null;
  }
  
  // UIAddressData -> AddressData
  if (uiValue && typeof uiValue === "object" && "street1" in uiValue) {
    return mapUIToAddress(uiValue as UIAddressData);
  }
  
  // File, string[], string, number - pass through
  return uiValue;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Helper to create a handler that automatically maps UI responses back to schema format
 */
export function createMappedHandler(
  originalHandler: (questionId: string, value: any) => void
) {
  return (questionId: string, uiValue: UIResponseValue) => {
    const schemaValue = mapUIToResponse(uiValue);
    originalHandler(questionId, schemaValue);
  };
}

/**
 * Helper to create a handler for select inputs that maps options
 */
export function createSelectHandler(
  originalHandler: (questionId: string, value: string) => void
) {
  return (questionId: string, value: string) => {
    // No mapping needed for string values
    originalHandler(questionId, value);
  };
}

/**
 * Helper to create a handler for file uploads
 */
export function createFileUploadHandler(
  originalHandler: (questionId: string, file: File) => Promise<void>
) {
  return (questionId: string, file: File) => {
    // No mapping needed for File objects
    return originalHandler(questionId, file);
  };
}