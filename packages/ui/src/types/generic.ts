/**
 * Generic interfaces for UI components to remove @formlink/schema dependencies
 * 
 * These types are minimal, reusable interfaces that capture just what UI components need
 * without tying them to FormJunction's specific schema structure.
 */

// ============================================================================
// Base Types
// ============================================================================

export interface UIOption {
  label: string;
  value: string;
  description?: string;
}

export interface UIAddressData {
  street1: string;
  street2?: string;
  city: string;
  stateProvince: string;
  postalCode: string;
  country: string;
}

export interface UIValidationRule {
  value: boolean | number | string;
  message?: string;
}

export interface UIValidations {
  required?: UIValidationRule;
  minLength?: UIValidationRule;
  maxLength?: UIValidationRule;
  pattern?: UIValidationRule;
  fileTypes?: string[];
  maxFileSize?: number;
}

export interface UIDisplay {
  inputType?: string;
  placeholder?: string;
  helpText?: string;
}

export interface UILinearScaleConfig {
  min?: number;
  max?: number;
  start?: number;
  end?: number;
  step?: number;
  startLabel?: string;
  endLabel?: string;
}

export interface UIRatingConfig {
  max?: number;
  icon?: string;
}

export interface UILikertScaleConfig {
  statements: string[];
  scale: UIOption[];
}

// ============================================================================
// Question Types
// ============================================================================

export type UIQuestionType = 
  | "text"
  | "email" 
  | "url"
  | "tel"
  | "password"
  | "textarea"
  | "number"
  | "date"
  | "singleChoice"
  | "multipleChoice"
  | "address"
  | "rating"
  | "linearScale"
  | "likertScale"
  | "fileUpload"
  | "ranking";

export interface UIQuestion {
  id: string;
  title: string;
  description?: string;
  questionType: UIQuestionType;
  options?: UIOption[];
  validations?: UIValidations;
  display?: UIDisplay;
  required?: boolean;
  placeholder?: string;
  
  // Type-specific configurations
  linearScaleConfig?: UILinearScaleConfig;
  ratingConfig?: UIRatingConfig;
  likertScaleConfig?: UILikertScaleConfig;
  
  // Conditional logic (basic structure)
  conditionalLogic?: {
    field?: string;
    value?: unknown;
    operator?: string;
  };
}

// ============================================================================
// Form Types
// ============================================================================

export interface UIForm {
  id: string;
  title: string;
  description?: string;
  questions: UIQuestion[];
  version_id?: string;
  settings?: {
    allowAnonymous?: boolean;
    requireAuth?: boolean;
    submitOnce?: boolean;
  };
}

// ============================================================================
// Response Types
// ============================================================================

export type UIResponseValue = 
  | string 
  | number 
  | string[] 
  | UIAddressData 
  | File 
  | null;

export interface UIFormResponse {
  questionId: string;
  value: UIResponseValue;
  timestamp?: string;
}

export interface UISubmission {
  id: string;
  formId: string;
  submissionId: string;
  responses: Record<string, UIResponseValue>;
  status: "in_progress" | "completed" | "draft";
  createdAt?: string;
  updatedAt?: string;
}

// ============================================================================
// Component Props Types
// ============================================================================

export interface UIFormModeContextValue {
  mode: "chat" | "typeform";
  setMode: (mode: "chat" | "typeform") => void;
}

export interface UIInputContainerProps {
  currentQuestion: UIQuestion;
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
}

export interface UIIntroScreenProps {
  formSchema: UIForm;
  onStart: () => void;
  className?: string;
}

// ============================================================================
// Store Types
// ============================================================================

export interface UIFormFillingState {
  formSchema: UIForm | null;
  formId: string | undefined;
  submissionId: string | undefined;
  questions: UIQuestion[];
  activeQuestionIndex: number;
  questionResponses: Record<string, UIResponseValue>;
  isCompleted: boolean;
  showConfetti: boolean;
  uploadedFile: File | null;
}

export interface UIFormFillingActions {
  initialize: (schema: UIForm, id?: string) => void;
  setActiveQuestionIndex: (index: number) => void;
  handleStartQuiz: () => void;
  handleRestart: () => void;
  handleSingleChoiceChange: (questionId: string, value: string) => void;
  handleMultipleChoiceChange: (questionId: string, value: string, checked: boolean) => void;
  handleTextChange: (questionId: string, value: string) => void;
  setQuestionResponse: (questionId: string, value: UIResponseValue) => void;
  shouldShowQuestion: (question: UIQuestion) => boolean;
  handleNavigateToNextValidQuestion: () => void;
  handleFileUpload: (questionId: string, file: File) => Promise<void>;
  setUploadedFile: (file: File | null) => void;
  reset: () => void;
}

// ============================================================================
// Hook Option Types
// ============================================================================

export interface UISelectInputOptions {
  initialValue?: string | null;
  required?: boolean;
  options: UIOption[];
  multiple?: boolean;
}

export interface UIAddressInputOptions {
  initialValue?: UIAddressData | null;
  required?: boolean;
  requiredFields?: (keyof UIAddressData)[];
}

// ============================================================================
// Utility Types for Mapping
// ============================================================================

/**
 * Type helpers for applications to map between their schema types and UI types
 */
export type SchemaToUIMapper<TSchema, TUI> = (schema: TSchema) => TUI;
export type UIToSchemaMapper<TUI, TSchema> = (ui: TUI) => TSchema;

// Common mapper function signatures
export type QuestionMapper<TQuestion> = SchemaToUIMapper<TQuestion, UIQuestion>;
export type FormMapper<TForm> = SchemaToUIMapper<TForm, UIForm>;
export type AddressMapper<TAddress> = SchemaToUIMapper<TAddress, UIAddressData>;
export type OptionMapper<TOption> = SchemaToUIMapper<TOption, UIOption>;