import type {
  ExtendedValidations,
  FileData,
  QuestionResponse,
  ValidationResult,
} from "@/lib/types";
import { AddressData, Form, Question } from "@formlink/schema";

export class FormValidator {
  private static validators: Record<
    string,
    (val: string, question: Question) => ValidationResult
  > = {
    email: (val, question) => {
      const trimmed = val.trim().toLowerCase();
      const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);

      // Custom domain validation if specified (check if property exists)
      const customRules = question.validations as ExtendedValidations;
      if (
        isValid &&
        customRules?.customRules?.allowedDomains &&
        Array.isArray(customRules.customRules.allowedDomains)
      ) {
        const domain = trimmed.split("@")[1];
        const allowed = customRules.customRules.allowedDomains;
        if (domain && !allowed.includes(domain)) {
          return {
            isValid: false,
            error: `Email must be from one of these domains: ${allowed.join(", ")}`,
          };
        }
      }

      return {
        isValid,
        error: isValid ? undefined : "Please enter a valid email address",
        normalizedValue: trimmed,
      };
    },

    phone: (val, question) => {
      const cleaned = val.replace(/\D/g, "");
      const minLength = question.validations?.minLength?.value || 10;
      const maxLength = question.validations?.maxLength?.value || 15;

      const isValid =
        cleaned.length >= minLength && cleaned.length <= maxLength;

      // Format phone number
      let formatted = val;
      if (isValid && cleaned.length === 10) {
        formatted = `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
      }

      return {
        isValid,
        error: isValid
          ? undefined
          : `Phone number must be ${minLength}-${maxLength} digits`,
        normalizedValue: formatted,
      };
    },

    url: (val, question) => {
      try {
        const url = new URL(val);

        // Check allowed protocols
        const customRules = question.validations as ExtendedValidations;
        const allowedProtocols = customRules?.customRules?.allowedProtocols || [
          "http:",
          "https:",
        ];
        if (
          Array.isArray(allowedProtocols) &&
          !allowedProtocols.includes(url.protocol)
        ) {
          return {
            isValid: false,
            error: `URL must use one of these protocols: ${allowedProtocols.join(", ")}`,
          };
        }

        return { isValid: true, normalizedValue: val };
      } catch {
        return { isValid: false, error: "Please enter a valid URL" };
      }
    },

    number: (val, question) => {
      const num = Number(val);
      if (isNaN(num)) {
        return { isValid: false, error: "Please enter a valid number" };
      }

      // Range validation
      const extValidations = question.validations as ExtendedValidations;
      const minRule = extValidations?.min;
      const maxRule = extValidations?.max;

      if (minRule?.value !== undefined && num < minRule.value) {
        return {
          isValid: false,
          error: minRule.message || `Number must be at least ${minRule.value}`,
        };
      }
      if (maxRule?.value !== undefined && num > maxRule.value) {
        return {
          isValid: false,
          error: maxRule.message || `Number must be at most ${maxRule.value}`,
        };
      }

      return { isValid: true, normalizedValue: num };
    },

    date: (val, question) => {
      const date = new Date(val);
      if (isNaN(date.getTime())) {
        return { isValid: false, error: "Please enter a valid date" };
      }

      // Date range validation using standard minDate/maxDate
      if (question.validations?.minDate?.value) {
        const minDate = new Date(question.validations.minDate.value);
        if (date < minDate) {
          return {
            isValid: false,
            error:
              question.validations.minDate.message ||
              `Date must be after ${minDate.toLocaleDateString()}`,
          };
        }
      }

      if (question.validations?.maxDate?.value) {
        const maxDate = new Date(question.validations.maxDate.value);
        if (date > maxDate) {
          return {
            isValid: false,
            error:
              question.validations.maxDate.message ||
              `Date must be before ${maxDate.toLocaleDateString()}`,
          };
        }
      }

      return { isValid: true, normalizedValue: date.toISOString() };
    },
  };

  static validate(
    input: QuestionResponse | unknown,
    question: Question,
  ): ValidationResult {
    // Handle different input types
    if (typeof input === "object" && input !== null) {
      // Special handling for complex types
      if (question.type.name === "address") {
        return this.validateAddress(input, question);
      }
      if (question.type.name === "multipleChoice" && Array.isArray(input)) {
        return this.validateMultipleChoice(input, question);
      }
      if (question.type.name === "fileUpload") {
        return this.validateFileUpload(input, question);
      }
      if (question.type.name === "ranking" && Array.isArray(input)) {
        return this.validateRanking(input, question);
      }
    }

    // String validation
    const value =
      typeof input === "string" ? input.trim() : String(input).trim();

    // Required field check
    if (question.validations?.required && !value) {
      return { isValid: false, error: "This field is required" };
    }

    // Empty optional field is valid
    if (!value && !question.validations?.required) {
      return { isValid: true, normalizedValue: "" };
    }

    // Pattern validation
    if (question.validations?.pattern?.value) {
      const regex = new RegExp(question.validations.pattern.value);
      if (!regex.test(value)) {
        return {
          isValid: false,
          error: question.validations.pattern.message || "Invalid format",
        };
      }
    }

    // Type-specific validation
    const validatorKey =
      question.type.name === "text"
        ? (question.type as any).format || "text"
        : question.type.name;
    const validator = this.validators[validatorKey];

    if (validator) {
      return validator(value, question);
    }

    // Default validation for text
    if (
      question.validations?.minLength?.value &&
      value.length < question.validations.minLength.value
    ) {
      return {
        isValid: false,
        error:
          question.validations.minLength.message ||
          `Must be at least ${question.validations.minLength.value} characters`,
      };
    }

    if (
      question.validations?.maxLength?.value &&
      value.length > question.validations.maxLength.value
    ) {
      return {
        isValid: false,
        error:
          question.validations.maxLength.message ||
          `Must be no more than ${question.validations.maxLength.value} characters`,
      };
    }

    return { isValid: true, normalizedValue: value };
  }

  // Validation methods for complex types
  static validateAddress(
    input: AddressData | unknown,
    question: Question,
  ): ValidationResult {
    if (!input || typeof input !== "object") {
      return { isValid: false, error: "Invalid address format" };
    }

    // Check required address fields
    const requiredFields = [
      "street1",
      "city",
      "stateProvince",
      "postalCode",
      "country",
    ];
    const missingFields = requiredFields.filter(
      (field) => !(input as any)[field],
    );

    if (question.validations?.required && missingFields.length > 0) {
      return {
        isValid: false,
        error: `Please fill in: ${missingFields.join(", ")}`,
      };
    }

    return { isValid: true, normalizedValue: input };
  }

  static validateMultipleChoice(
    input: string[],
    question: Question,
  ): ValidationResult {
    if (!Array.isArray(input)) {
      return { isValid: false, error: "Invalid selection format" };
    }

    if (question.validations?.required && input.length === 0) {
      return { isValid: false, error: "Please select at least one option" };
    }

    // Validate all selections are valid options
    // Access options from the new type structure
    const choiceType = question.type as {
      name: "multipleChoice";
      options: Array<{ value: string; label: string }>;
    };
    const validOptions = choiceType.options?.map((opt) => opt.value) || [];
    const invalidSelections = input.filter(
      (val) => !validOptions.includes(val),
    );

    if (invalidSelections.length > 0) {
      return { isValid: false, error: "Invalid option selected" };
    }

    return { isValid: true, normalizedValue: input };
  }

  static validateFileUpload(
    input: File | FileData | unknown,
    question: Question,
  ): ValidationResult {
    if (!input) {
      if (question.validations?.required) {
        return { isValid: false, error: "Please upload a file" };
      }
      return { isValid: true, normalizedValue: null };
    }

    return { isValid: true, normalizedValue: input };
  }

  static validateRanking(
    input: string[],
    question: Question,
  ): ValidationResult {
    if (!Array.isArray(input)) {
      return { isValid: false, error: "Invalid ranking format" };
    }

    if (question.validations?.required && input.length === 0) {
      return { isValid: false, error: "Please rank the options" };
    }

    // Check if all options are ranked
    // Access options from the new type structure
    const rankingType = question.type as {
      name: "ranking";
      options: Array<{ value: string; label: string }>;
    };
    const expectedOptions = rankingType.options?.map((opt) => opt.value) || [];
    if (input.length !== expectedOptions.length) {
      return { isValid: false, error: "Please rank all options" };
    }

    return { isValid: true, normalizedValue: input };
  }

  // Cross-field validation
  static validateCrossField(
    questionId: string,
    value: QuestionResponse,
    allResponses: Record<string, QuestionResponse>,
    formSchema: Form,
  ): ValidationResult {
    const question = formSchema.questions.find((q) => q.id === questionId);
    const customRules = question?.validations as ExtendedValidations;

    if (!customRules?.customRules?.crossField) {
      return { isValid: true };
    }

    // Example: end date must be after start date
    const rules = customRules.customRules.crossField;
    if (rules.mustBeAfter) {
      const compareValue = allResponses[rules.mustBeAfter];
      if (
        compareValue &&
        new Date(value as string) <= new Date(compareValue as string)
      ) {
        const compareQuestion = formSchema.questions.find(
          (q) => q.id === rules.mustBeAfter,
        );
        return {
          isValid: false,
          error: `Must be after ${compareQuestion?.title || rules.mustBeAfter}`,
        };
      }
    }

    return { isValid: true };
  }
}
