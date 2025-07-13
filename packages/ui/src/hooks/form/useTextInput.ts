import { useState, useCallback, useMemo } from "react";
import { UseInputReturn } from "../base/types";

/**
 * Configuration options for the useTextInput hook
 */
interface UseTextInputOptions {
  /** Initial value for the input */
  initialValue?: string;
  /** Whether the field is required */
  required?: boolean;
  /** Minimum character length */
  minLength?: number;
  /** Maximum character length */
  maxLength?: number;
  /** Regular expression pattern for validation */
  pattern?: RegExp;
  /** Custom validation function returning error message or null */
  customValidator?: (value: string) => string | null;
}

/**
 * Hook for managing text input state and validation
 * 
 * @description
 * Provides complete text input management including value state,
 * validation, error handling, and touch tracking. Supports various
 * validation rules and custom validators.
 * 
 * @example
 * ```typescript
 * const emailInput = useTextInput({
 *   required: true,
 *   pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
 *   customValidator: (value) => {
 *     if (value && !value.includes('@company.com')) {
 *       return 'Must be a company email';
 *     }
 *     return null;
 *   }
 * });
 * 
 * return (
 *   <input
 *     value={emailInput.value}
 *     onChange={(e) => emailInput.setValue(e.target.value)}
 *     onBlur={emailInput.handlers.onBlur}
 *   />
 * );
 * ```
 */
export function useTextInput(options: UseTextInputOptions = {}): UseInputReturn<string> {
  const {
    initialValue = "",
    required = false,
    minLength,
    maxLength,
    pattern,
    customValidator
  } = options;

  const [value, setValue] = useState<string>(initialValue);
  const [errors, setErrors] = useState<string[]>([]);
  const [touched, setTouched] = useState(false);

  const validate = useCallback((): boolean => {
    const newErrors: string[] = [];

    // Required validation
    if (required && !value.trim()) {
      newErrors.push("This field is required");
    }

    // Min length validation
    if (minLength && value.length < minLength) {
      newErrors.push(`Must be at least ${minLength} characters`);
    }

    // Max length validation
    if (maxLength && value.length > maxLength) {
      newErrors.push(`Must be no more than ${maxLength} characters`);
    }

    // Pattern validation
    if (pattern && value && !pattern.test(value)) {
      newErrors.push("Invalid format");
    }

    // Custom validation
    if (customValidator) {
      const customError = customValidator(value);
      if (customError) {
        newErrors.push(customError);
      }
    }

    setErrors(newErrors);
    return newErrors.length === 0;
  }, [value, required, minLength, maxLength, pattern, customValidator]);

  // Validate on value change if touched
  useMemo(() => {
    if (touched) {
      validate();
    }
  }, [value, touched, validate]);

  const handleChange = useCallback((newValue: string) => {
    setValue(newValue);
    if (!touched) {
      setTouched(true);
    }
  }, [touched]);

  const clearErrors = useCallback(() => {
    setErrors([]);
  }, []);

  const handlers = {
    onBlur: () => {
      if (!touched) {
        setTouched(true);
        validate();
      }
    },
    onFocus: () => {
      // Could be used for focus tracking
    }
  };

  return {
    value,
    setValue: handleChange,
    errors,
    validate,
    isValid: errors.length === 0,
    clearErrors,
    handlers
  };
}