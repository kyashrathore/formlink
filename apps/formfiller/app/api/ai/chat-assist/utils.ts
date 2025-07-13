import { z } from "zod";
import { Question, Form } from "@formlink/schema";
import posthog from 'posthog-js';

// Re-export Question and Form types
export type { Question, Form };

// Types
export interface ValidationResult {
  isValid: boolean;
  error?: string;
  normalizedValue?: any;
  warnings?: string[];
}

export interface AIContext {
  userInput: string;
  submissionBehavior: 'auto' | 'manualClear' | 'manualUnclear' | null;
  formSchema: Form;
  currentQuestionId: string | null;
  responses: Record<string, any>;
  validationResult?: ValidationResult;
  justSavedAnswer?: {
    questionId: string;
    value: any;
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

// Form Validator Class
export class FormValidator {
  private static validators: Record<string, (val: string, question: Question) => ValidationResult> = {
    email: (val, question) => {
      const trimmed = val.trim().toLowerCase();
      const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
      
      // Custom domain validation if specified (check if property exists)
      const customRules = question.validations as any;
      if (isValid && customRules?.customRules?.allowedDomains && Array.isArray(customRules.customRules.allowedDomains)) {
        const domain = trimmed.split('@')[1];
        const allowed = customRules.customRules.allowedDomains;
        if (!allowed.includes(domain)) {
          return {
            isValid: false,
            error: `Email must be from one of these domains: ${allowed.join(', ')}`,
          };
        }
      }
      
      return {
        isValid,
        error: isValid ? undefined : 'Please enter a valid email address',
        normalizedValue: trimmed,
      };
    },

    phone: (val, question) => {
      const cleaned = val.replace(/\D/g, '');
      const minLength = question.validations?.minLength?.value || 10;
      const maxLength = question.validations?.maxLength?.value || 15;
      
      const isValid = cleaned.length >= minLength && cleaned.length <= maxLength;
      
      // Format phone number
      let formatted = val;
      if (isValid && cleaned.length === 10) {
        formatted = `(${cleaned.slice(0,3)}) ${cleaned.slice(3,6)}-${cleaned.slice(6)}`;
      }
      
      return {
        isValid,
        error: isValid ? undefined : `Phone number must be ${minLength}-${maxLength} digits`,
        normalizedValue: formatted,
      };
    },

    url: (val, question) => {
      try {
        const url = new URL(val);
        
        // Check allowed protocols
        const customRules = question.validations as any;
        const allowedProtocols = customRules?.customRules?.allowedProtocols || ['http:', 'https:'];
        if (Array.isArray(allowedProtocols) && !allowedProtocols.includes(url.protocol)) {
          return {
            isValid: false,
            error: `URL must use one of these protocols: ${allowedProtocols.join(', ')}`,
          };
        }
        
        return { isValid: true, normalizedValue: val };
      } catch {
        return { isValid: false, error: 'Please enter a valid URL' };
      }
    },

    number: (val, question) => {
      const num = Number(val);
      if (isNaN(num)) {
        return { isValid: false, error: 'Please enter a valid number' };
      }
      
      // Range validation
      const minRule = (question.validations as any)?.min;
      const maxRule = (question.validations as any)?.max;
      
      if (minRule?.value !== undefined && num < minRule.value) {
        return { isValid: false, error: minRule.message || `Number must be at least ${minRule.value}` };
      }
      if (maxRule?.value !== undefined && num > maxRule.value) {
        return { isValid: false, error: maxRule.message || `Number must be at most ${maxRule.value}` };
      }
      
      return { isValid: true, normalizedValue: num };
    },

    date: (val, question) => {
      const date = new Date(val);
      if (isNaN(date.getTime())) {
        return { isValid: false, error: 'Please enter a valid date' };
      }
      
      // Date range validation using standard minDate/maxDate
      if (question.validations?.minDate?.value) {
        const minDate = new Date(question.validations.minDate.value);
        if (date < minDate) {
          return { isValid: false, error: question.validations.minDate.message || `Date must be after ${minDate.toLocaleDateString()}` };
        }
      }
      
      if (question.validations?.maxDate?.value) {
        const maxDate = new Date(question.validations.maxDate.value);
        if (date > maxDate) {
          return { isValid: false, error: question.validations.maxDate.message || `Date must be before ${maxDate.toLocaleDateString()}` };
        }
      }
      
      return { isValid: true, normalizedValue: date.toISOString() };
    },
  };

  static validate(input: any, question: Question): ValidationResult {
    // Handle different input types
    if (typeof input === 'object' && input !== null) {
      // Special handling for complex types
      if (question.questionType === 'address' || question.display?.inputType === 'addressBlock') {
        return this.validateAddress(input, question);
      }
      if (question.questionType === 'multipleChoice' && Array.isArray(input)) {
        return this.validateMultipleChoice(input, question);
      }
      if (question.questionType === 'fileUpload') {
        return this.validateFileUpload(input, question);
      }
      if (question.questionType === 'ranking' && Array.isArray(input)) {
        return this.validateRanking(input, question);
      }
    }
    
    // String validation
    const value = typeof input === 'string' ? input.trim() : String(input).trim();
    
    // Required field check
    if (question.validations?.required && !value) {
      return { isValid: false, error: 'This field is required' };
    }
    
    // Empty optional field is valid
    if (!value && !question.validations?.required) {
      return { isValid: true, normalizedValue: '' };
    }
    
    // Pattern validation
    if (question.validations?.pattern?.value) {
      const regex = new RegExp(question.validations.pattern.value);
      if (!regex.test(value)) {
        return {
          isValid: false,
          error: question.validations.pattern.message || 'Invalid format',
        };
      }
    }
    
    // Type-specific validation
    const validatorKey = question.display?.inputType || question.questionType;
    const validator = this.validators[validatorKey];
    
    if (validator) {
      return validator(value, question);
    }
    
    // Default validation for text
    if (question.validations?.minLength?.value && value.length < question.validations.minLength.value) {
      return {
        isValid: false,
        error: question.validations.minLength.message || `Must be at least ${question.validations.minLength.value} characters`,
      };
    }
    
    if (question.validations?.maxLength?.value && value.length > question.validations.maxLength.value) {
      return {
        isValid: false,
        error: question.validations.maxLength.message || `Must be no more than ${question.validations.maxLength.value} characters`,
      };
    }
    
    return { isValid: true, normalizedValue: value };
  }

  // Validation methods for complex types
  static validateAddress(input: any, question: Question): ValidationResult {
    if (!input || typeof input !== 'object') {
      return { isValid: false, error: 'Invalid address format' };
    }
    
    // Check required address fields
    const requiredFields = ['street1', 'city', 'stateProvince', 'postalCode', 'country'];
    const missingFields = requiredFields.filter(field => !input[field]);
    
    if (question.validations?.required && missingFields.length > 0) {
      return { 
        isValid: false, 
        error: `Please fill in: ${missingFields.join(', ')}` 
      };
    }
    
    return { isValid: true, normalizedValue: input };
  }

  static validateMultipleChoice(input: string[], question: Question): ValidationResult {
    if (!Array.isArray(input)) {
      return { isValid: false, error: 'Invalid selection format' };
    }
    
    if (question.validations?.required && input.length === 0) {
      return { isValid: false, error: 'Please select at least one option' };
    }
    
    // Validate all selections are valid options
    // Type assertion since we know multiple choice questions have options
    const mcQuestion = question as any;
    const validOptions = mcQuestion.options?.map((opt: any) => opt.value) || [];
    const invalidSelections = input.filter(val => !validOptions.includes(val));
    
    if (invalidSelections.length > 0) {
      return { isValid: false, error: 'Invalid option selected' };
    }
    
    return { isValid: true, normalizedValue: input };
  }

  static validateFileUpload(input: any, question: Question): ValidationResult {
    if (!input) {
      if (question.validations?.required) {
        return { isValid: false, error: 'Please upload a file' };
      }
      return { isValid: true, normalizedValue: null };
    }
    
    return { isValid: true, normalizedValue: input };
  }

  static validateRanking(input: string[], question: Question): ValidationResult {
    if (!Array.isArray(input)) {
      return { isValid: false, error: 'Invalid ranking format' };
    }
    
    if (question.validations?.required && input.length === 0) {
      return { isValid: false, error: 'Please rank the options' };
    }
    
    // Check if all options are ranked
    // Type assertion since we know ranking questions have options
    const rankingQuestion = question as any;
    const expectedOptions = rankingQuestion.options?.map((opt: any) => opt.value) || [];
    if (input.length !== expectedOptions.length) {
      return { isValid: false, error: 'Please rank all options' };
    }
    
    return { isValid: true, normalizedValue: input };
  }

  // Cross-field validation
  static validateCrossField(
    questionId: string,
    value: any,
    allResponses: Record<string, any>,
    formSchema: Form
  ): ValidationResult {
    const question = formSchema.questions.find(q => q.id === questionId);
    const customRules = question?.validations as any;
    
    if (!customRules?.crossField) {
      return { isValid: true };
    }

    // Example: end date must be after start date
    const rules = customRules.crossField;
    if (rules.mustBeAfter) {
      const compareValue = allResponses[rules.mustBeAfter];
      if (compareValue && new Date(value) <= new Date(compareValue)) {
        const compareQuestion = formSchema.questions.find(q => q.id === rules.mustBeAfter);
        return {
          isValid: false,
          error: `Must be after ${compareQuestion?.title || rules.mustBeAfter}`,
        };
      }
    }

    return { isValid: true };
  }
}

// Context Manager Class
export class ContextManager {
  private static readonly MAX_CONTEXT_SIZE = 10000; // tokens
  private static readonly MAX_RESPONSE_HISTORY = 20;

  static compressContext(context: AIContext): AIContext {
    // Estimate token count (rough: 1 token ≈ 4 chars)
    const estimatedTokens = JSON.stringify(context).length / 4;
    
    if (estimatedTokens < this.MAX_CONTEXT_SIZE) {
      return context;
    }

    // Compress strategies
    const compressed: AIContext = { ...context };

    // 1. Only include relevant questions based on conditional logic
    const answeredIds = Object.keys(context.responses);
    const relevantQuestions = this.getRelevantQuestions(
      context.formSchema.questions,
      context.responses,
      context.currentQuestionId
    );
    
    compressed.formSchema = {
      ...context.formSchema,
      questions: relevantQuestions,
    };

    // 2. Summarize previous responses if too many
    if (answeredIds.length > this.MAX_RESPONSE_HISTORY) {
      const recentIds = answeredIds.slice(-this.MAX_RESPONSE_HISTORY);
      compressed.responses = Object.fromEntries(
        recentIds.map(id => [id, context.responses[id]])
      );
      compressed.responseSummary = {
        totalAnswered: answeredIds.length,
        truncated: true,
        earliestIncluded: recentIds[0] || '',
      };
    }

    // 3. Keep questions as is - they're already minimal
    // The Question type is already optimized

    return compressed;
  }

  private static getRelevantQuestions(
    allQuestions: Question[],
    responses: Record<string, any>,
    currentQuestionId: string | null
  ): Question[] {
    const relevant = new Set<string>();
    
    // Always include current question
    if (currentQuestionId) {
      relevant.add(currentQuestionId);
    }

    // Include answered questions
    Object.keys(responses).forEach(id => relevant.add(id));

    // Include next possible questions based on conditional logic
    const currentIndex = allQuestions.findIndex(q => q.id === currentQuestionId);
    for (let i = currentIndex; i < Math.min(currentIndex + 5, allQuestions.length); i++) {
      if (i >= 0 && i < allQuestions.length) {
        const question = allQuestions[i];
        if (question && this.evaluateCondition(question, responses)) {
          relevant.add(question.id);
        }
      }
    }

    return allQuestions.filter(q => relevant.has(q.id));
  }

  private static evaluateCondition(
    question: Question,
    responses: Record<string, any>
  ): boolean {
    if (!question.conditionalLogic) return true;
    
    // Handle different conditional logic types
    const logic = question.conditionalLogic as any;
    
    // If it has conditions and action properties (standard format)
    if (logic.conditions && logic.action) {
      const conditionsMet = logic.conditions.every((condition: any) => {
        const answer = responses[condition.questionId];
        switch (condition.operator) {
          case 'equals':
            return answer === condition.value;
          case 'not_equals':
            return answer !== condition.value;
          case 'contains':
            return String(answer).includes(String(condition.value));
          case 'greater_than':
            return Number(answer) > Number(condition.value);
          // Add more operators...
          default:
            return true;
        }
      });
      return logic.action === 'show' ? conditionsMet : !conditionsMet;
    }
    
    // Default to showing the question
    return true;
  }
}


// PostHog Analytics Helper
export function trackServerEvent(event: string, properties?: Record<string, any>) {
  if (process.env.NODE_ENV === 'development') {
    console.log('PostHog Event:', event, properties);
    return;
  }
  
  try {
    // PostHog handles queueing and batching automatically
    posthog.capture(event, properties);
  } catch (error) {
    // Fail silently - don't break the main flow
    console.error('PostHog tracking error:', error);
  }
}

// Helper functions
export function sanitizeUserInput(input: any): string {
  if (!input || typeof input !== 'string') return '';
  
  // Remove potential prompt injection patterns
  return input
    .replace(/\[INST\]/gi, '')
    .replace(/\[\/INST\]/gi, '')
    .replace(/\{\{.*?\}\}/g, '') // Remove template syntax
    .replace(/<script.*?>.*?<\/script>/gi, '') // Remove scripts
    .trim()
    .slice(0, 1000); // Limit length
}

export async function triggerWebhook(url: string, data: any) {
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });
  } catch (error) {
    console.error('Webhook failed:', error);
  }
}
