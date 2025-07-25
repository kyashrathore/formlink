import { Form, Question, AddressData } from "@formlink/schema";
import type { Element } from "hast";

/**
 * Type definitions for FormFiller app
 * Replaces any types with proper interfaces
 */

// Extended Form type with version fields
export interface FormWithVersions extends Form {
  current_published_version_id?: string;
  current_draft_version_id?: string;
}

// Note: Message type from @ai-sdk/react already includes toolInvocations
// See: https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-chat#messages.ui-message

// Message part types for AI SDK
export interface TextPart {
  type: "text";
  text: string;
}

export interface ReasoningPart {
  type: "reasoning";
  reasoning: string;
}

export type MessagePart = TextPart | ReasoningPart;

// Form mode context types
export interface ExtendedFormModeContext {
  mode: string;
  setMode: (mode: string) => void;
  isChatMode?: boolean;
  isTypeFormMode?: boolean;
}

// Markdown component props types
export interface MarkdownComponentProps {
  node?: Element; // HAST element node from unified ecosystem
  children?: React.ReactNode;
  href?: string;
  [key: string]: unknown;
}

// Validation types
export interface ValidationResult {
  isValid: boolean;
  error?: string;
  normalizedValue?: QuestionResponse;
  warnings?: string[];
}

// AI Context types
export interface AIContext {
  userInput: string;
  submissionBehavior: "auto" | "manualClear" | "manualUnclear" | null;
  formSchema: Form;
  currentQuestionId: string | null;
  responses: Record<string, QuestionResponse>;
  validationResult?: ValidationResult;
  justSavedAnswer?: {
    questionId: string;
    value: QuestionResponse;
  };
  progress: {
    answered: number;
    total: number;
    percentage: number;
  };
  responseSummary?: {
    totalAnswered: number;
    truncated: boolean;
    earliestIncluded: string;
  };
  journeyScript?: string;
}

// Extended validation types for forms
export interface ValidationCustomRules {
  allowedDomains?: string[];
  allowedProtocols?: string[];
  crossField?: {
    mustBeAfter?: string;
    mustBeBefore?: string;
  };
}

export interface ExtendedValidations {
  required?: boolean;
  pattern?: {
    value: string;
    message?: string;
  };
  minLength?: {
    value: number;
    message?: string;
  };
  maxLength?: {
    value: number;
    message?: string;
  };
  min?: {
    value: number;
    message?: string;
  };
  max?: {
    value: number;
    message?: string;
  };
  minDate?: {
    value: string;
    message?: string;
  };
  maxDate?: {
    value: string;
    message?: string;
  };
  customRules?: ValidationCustomRules;
}

// Question with options type
export interface QuestionWithOptions extends Question {
  options?: Array<{
    value: string;
    label: string;
  }>;
}

// Question with placeholder type
export interface QuestionWithPlaceholder extends Question {
  placeholder?: string;
}

// Webhook data type
export interface WebhookData {
  submissionId: string;
  formId?: string;
  responses?: Record<string, QuestionResponse>;
  timestamp?: string;
  [key: string]: unknown;
}

// Query data type for form initialization
export type QueryDataForForm = Record<string, string | number | boolean>;

// Chat error type
export interface ChatError extends Error {
  message: string;
  code?: string;
  status?: number;
}

// React event types
export type InputChangeEvent = React.ChangeEvent<
  HTMLInputElement | HTMLTextAreaElement
>;

// API Context types
export interface ChatContext {
  submissionId: string;
  userId?: string;
  formSchema?: Form;
  responses?: Record<string, QuestionResponse>;
}

// Database types
export interface FormAnswer {
  question_id: string;
  answer_value: QuestionResponse;
}

// API Error types
export interface APIError extends Error {
  message: string;
  statusCode?: number;
  details?: unknown;
}

// File response types
export interface FileData {
  name?: string;
  filename?: string;
  url?: string;
  size?: number;
}

// Question response types based on question types
export type QuestionResponse =
  | string // text, singleChoice, date
  | number // rating, linearScale
  | string[] // multipleChoice, ranking
  | File // fileUpload (client-side)
  | FileData // fileUpload (server response)
  | FileData[] // multiple file uploads
  | AddressData // address
  | null; // empty/unset

export type QuestionResponseMap = Record<string, QuestionResponse>;

// API Response types
export interface UploadResponse {
  url: string;
  fileName?: string;
  fileSize?: number;
}

export interface SaveAnswersRequest {
  submissionId: string;
  answers: Array<{
    questionId: string;
    value: QuestionResponse;
  }>;
  formVersionId: string;
  isTestSubmission: boolean;
  status: "in_progress" | "completed";
}

export interface SaveAnswersResponse {
  success: boolean;
  submissionId: string;
}

// Webhook types
export interface WebhookAnswer {
  q_id: string;
  answer: QuestionResponse;
  is_additional_field: boolean;
}

export interface WebhookPayload {
  submissionId: string;
  versionId: string;
  submissionStatus?: string;
  testmode?: boolean;
  answers: WebhookAnswer[];
}

// Form settings types
export interface FormIntegrations {
  webhookUrl?: string;
}

export interface ThemeOverrides {
  shadcn_css?: string;
}

export interface FormSettings {
  integrations?: FormIntegrations;
  theme_overrides?: ThemeOverrides;
  additionalFields?: {
    queryParamater?: string[];
    computedFromResponses?: Array<{
      field_id: string;
      jsonata: string;
    }>;
  };
}

// Save answers API request body types
export interface SaveAnswersRequestBody {
  submissionId: string;
  formVersionId: string;
  isPartial?: boolean;
  submissionStatus?: string;
  testmode?: boolean;
  // For partial saves
  questionId?: string;
  answerValue?: QuestionResponse;
  // For bulk saves
  allResponses?: Record<string, QuestionResponse>;
}

// Store types
export interface AppFormState {
  formSchema: Form | null;
  formId: string | undefined;
  submissionId: string | undefined;
  questions: Question[];
  questionResponses: QuestionResponseMap;
  isCompleted: boolean;
}

export interface AppFormActions {
  // Core business logic
  initialize: (schema: Form, id?: string) => Promise<void>;
  restart: () => Promise<void>;

  // Question response management
  setQuestionResponse: (questionId: string, value: QuestionResponse) => void;
  handleSingleChoiceChange: (questionId: string, value: string) => void;
  handleMultipleChoiceChange: (
    questionId: string,
    value: string,
    checked: boolean,
  ) => void;
  handleTextChange: (questionId: string, value: string) => void;

  // Navigation logic
  shouldShowQuestion: (question: Question) => boolean;
  getNextValidQuestionIndex: (currentIndex: number) => number | null;
  markAsCompleted: () => void;

  // File upload business logic
  handleFileUpload: (questionId: string, file: File) => Promise<string | null>;

  // Utilities
  getCurrentQuestion: (activeIndex: number) => Question | null;
  getProgress: (activeIndex: number) => number;
  reset: () => void;
}

// Keyboard handler types
export interface UseTypeFormKeyboardProps {
  currentQuestion: Question | null;
  onAnswer: (
    questionId: string,
    value: QuestionResponse,
    questionType: Question["questionType"],
  ) => void;
  onNext: () => void;
  onPrevious?: () => void;
  showHelp?: () => void;
  getCurrentResponse?: (questionId: string) => QuestionResponse;
}
