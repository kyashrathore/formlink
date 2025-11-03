// Re-export canonical schema types to prevent drift.
// Always import types from here in runtime to keep parity with packages/schema.
import type { Form, Question, AddressData } from "./schema";
import type { FormlinkFlow } from "./core/formlinkFlow";
export type { Form, Question, AddressData } from "./schema";

export type RuntimeStatus =
  | "idle"
  | "filling"
  | "submitting"
  | "completed"
  | "error";

export type RuntimeProgress = {
  index: number;
  total: number;
  percent: number;
};

export type RuntimeValues = Record<string, unknown>;

export type RuntimeFieldErrors = Record<string, string[]>;

export interface RuntimeContextSnapshot {
  status: RuntimeStatus;
  currentId: string | null;
  eligibleIds: string[];
  progress: RuntimeProgress;
  values: RuntimeValues;
  errors: RuntimeFieldErrors;
  firstUnansweredId: string | null;
  unansweredIds: string[];
  isValid: boolean;
  isSubmitting: boolean;
}

export interface RuntimeContext {
  readonly form: Form;
  readonly status: RuntimeStatus;
  readonly currentId: string | null;
  readonly eligibleIds: string[];
  readonly progress: RuntimeProgress;
  readonly values: RuntimeValues;
  readonly errors: RuntimeFieldErrors;
  readonly firstUnansweredId: string | null;
  readonly unansweredIds: string[];
  readonly isValid: boolean;
  readonly isSubmitting: boolean;
  subscribe(listener: (snapshot: RuntimeContextSnapshot) => void): () => void;
  getSnapshot(): RuntimeContextSnapshot;
  get: {
    q: (questionId: string) => Question | undefined;
    value: <T = unknown>(questionId: string) => T | undefined;
    error: (questionId: string) => string | undefined;
    visibleError: (questionId: string) => string | undefined;
  };
}

export interface RuntimeValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface RuntimeSubmissionResult {
  submissionId?: string;
  response?: unknown;
}

export interface RuntimeUploadDescriptor {
  url: string;
  name: string;
  size: number;
  mimeType?: string;
  metadata?: Record<string, unknown>;
}

export interface RuntimeTransport {
  submit(values: RuntimeValues): Promise<RuntimeSubmissionResult>;
  savePartial?(values: RuntimeValues): Promise<void>;
  upload?(
    questionId: string,
    file: File | Blob,
  ): Promise<RuntimeUploadDescriptor>;
}

export interface FormfillerTransportConfig {
  baseUrl?: string;
  formId: string;
  submissionId: string;
  formVersionId: string;
  isTestSubmission?: boolean;
  headers?: Record<string, string>;
}

export interface RuntimeConfig {
  form: Form;
  transport?: RuntimeTransport;
  /**
   * Convenience: if provided and `transport` is not, a Formfiller-compatible transport is created.
   */
  formfiller?: FormfillerTransportConfig;
  initialValues?: Partial<RuntimeValues>;
  initialStatus?: RuntimeStatus;
  initialCurrentId?: string | null;
  /**
   * UI mode hint for error-reveal behavior.
   * - 'typeform': reveal errors on Continue/Next and on submit; clear on change when valid.
   * - 'classic': reveal errors on blur; clear on change when valid.
   * Defaults to 'typeform' to preserve existing flows.
   */
  uiMode?: "typeform" | "classic";
  /**
   * Optional routing engine to control branching and navigation.
   * When provided, runtime computes eligibleIds via this engine
   * (typeform: visibleSet; classic: full path).
   */
  flowEngine?: FormlinkFlow;
}

export type RuntimeEventMap = {
  "status:change": { status: RuntimeStatus };
  "cursor:change": { currentId: string | null };
  "answer:set": { questionId: string; value: unknown };
  "visibility:change": { eligibleIds: string[] };
  "progress:change": { progress: RuntimeProgress };
  // Submit lifecycle
  "submit:requested": { values: RuntimeValues };
  "submit:transport:start": { values: RuntimeValues };
  "submit:success": {
    values: RuntimeValues;
    result: RuntimeSubmissionResult;
  };
  "submit:error": { error: unknown };
  "submit:transport:end": { result: RuntimeSubmissionResult | unknown };
  "upload:success": {
    questionId: string;
    descriptor: RuntimeUploadDescriptor;
  };
  "upload:error": { questionId: string; error: unknown };
};

export interface RuntimeEvents {
  on<K extends keyof RuntimeEventMap>(
    event: K,
    handler: (payload: RuntimeEventMap[K]) => void,
  ): () => void;
  once<K extends keyof RuntimeEventMap>(
    event: K,
    handler: (payload: RuntimeEventMap[K]) => void,
  ): () => void;
  off<K extends keyof RuntimeEventMap>(
    event: K,
    handler: (payload: RuntimeEventMap[K]) => void,
  ): void;
}

export interface RuntimeActions {
  start(): void;
  set(questionId: string, value: unknown): void;
  /** Mark a field as blurred (classic mode error reveal). */
  blur(questionId: string): void;
  next(): Promise<void>;
  prev(): void;
  goTo(questionId: string): void;
  validate(questionId: string): Promise<RuntimeValidationResult>;
  validateAll(): Promise<RuntimeValidationResult>;
  submit(): Promise<void>;
  reset(): void;
  savePartial(): Promise<void>;
  upload(
    questionId: string,
    file: File | Blob,
  ): Promise<RuntimeUploadDescriptor>;
}

export interface RuntimeApi {
  context: RuntimeContext;
  actions: RuntimeActions;
  events: RuntimeEvents;
  dispose(): void;
}
