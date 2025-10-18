import { useState, useCallback, useEffect, useRef } from "react";
import {
  BasePrimitiveProps,
  BasePrimitiveReturn,
  ValidationError,
} from "./types";

export interface BaseTextInputProps extends BasePrimitiveProps<string> {
  /**
   * Placeholder text
   */
  placeholder?: string;

  /**
   * Input type (text, email, password, etc.)
   */
  type?: string;

  /**
   * Maximum length of input
   */
  maxLength?: number;

  /**
   * Minimum length of input
   */
  minLength?: number;

  /**
   * Pattern for validation
   */
  pattern?: string;

  /**
   * Callback on blur
   */
  onBlur?: () => void;

  /**
   * Callback on focus
   */
  onFocus?: () => void;

  /**
   * Callback on submit (e.g., Enter key)
   */
  onSubmit?: () => void;

  /**
   * Auto-submit on change (default: true for backward compatibility)
   */
  autoSubmitOnChange?: boolean;
}

export interface BaseTextInputReturn extends BasePrimitiveReturn<string> {
  /**
   * Props to spread on the input element
   */
  inputProps: React.InputHTMLAttributes<HTMLInputElement>;

  /**
   * Whether the input is focused
   */
  isFocused: boolean;
}

export function useBaseTextInput(
  props: BaseTextInputProps,
): BaseTextInputReturn {
  const {
    value,
    onChange,
    disabled = false,
    required = false,
    onValidate,
    onValidationChange,
    autoFocus = false,
    id,
    name,
    ariaLabel,
    ariaDescribedBy,
    placeholder,
    type = "text",
    maxLength,
    minLength,
    pattern,
    onBlur,
    onFocus,
    onSubmit,
    autoSubmitOnChange = true,
  } = props;

  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [isTouched, setIsTouched] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Validate the input
  const validate = useCallback(() => {
    const validationErrors: ValidationError[] = [];

    // Required validation
    if (required && !value.trim()) {
      validationErrors.push({
        type: "required",
        message: "This field is required",
      });
    }

    // Min length validation
    if (minLength && value.length < minLength) {
      validationErrors.push({
        type: "minLength",
        message: `Minimum length is ${minLength} characters`,
      });
    }

    // Max length validation
    if (maxLength && value.length > maxLength) {
      validationErrors.push({
        type: "maxLength",
        message: `Maximum length is ${maxLength} characters`,
      });
    }

    // Pattern validation
    if (pattern && value) {
      const regex = new RegExp(pattern);
      if (!regex.test(value)) {
        validationErrors.push({
          type: "pattern",
          message: "Invalid format",
        });
      }
    }

    // Custom validation
    if (onValidate) {
      const customErrors = onValidate(value);
      validationErrors.push(...customErrors);
    }

    setErrors(validationErrors);
    onValidationChange?.(validationErrors);

    return validationErrors;
  }, [
    value,
    required,
    minLength,
    maxLength,
    pattern,
    onValidate,
    onValidationChange,
  ]);

  // Auto-focus on mount
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  // Validate when touched and value changes
  useEffect(() => {
    if (isTouched) {
      validate();
    }
  }, [value, isTouched, validate]);

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      let val = event.target.value;

      // Special handling for number type
      if (type === "number") {
        // Only allow numeric characters, optional decimal point, and optional minus sign
        const sanitized = val.replace(/[^0-9.-]/g, "");

        // Ensure only one decimal point
        const parts = sanitized.split(".");
        const formatted =
          parts.length > 2
            ? parts[0] + "." + parts.slice(1).join("")
            : sanitized;

        // Ensure minus sign is only at the beginning
        const minusCount = (formatted.match(/-/g) || []).length;
        val =
          minusCount > 1
            ? formatted.replace(/-/g, "").replace(/^/, "-")
            : minusCount === 1 && !formatted.startsWith("-")
              ? formatted.replace(/-/g, "")
              : formatted;
      }

      onChange(val);
    },
    [onChange, type],
  );

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    setIsTouched(true);
    validate();
    onBlur?.();
  }, [validate, onBlur]);

  const handleFocus = useCallback(() => {
    setIsFocused(true);
    onFocus?.();
  }, [onFocus]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      // Handle Enter key for submission
      if (event.key === "Enter" && autoSubmitOnChange && onSubmit) {
        event.preventDefault();
        onSubmit();
        return;
      }

      // Special handling for number type
      if (type === "number") {
        // Allow backspace, delete, tab, escape, enter, arrows
        const allowedKeys = [
          "Backspace",
          "Delete",
          "Tab",
          "Escape",
          "Enter",
          "ArrowLeft",
          "ArrowRight",
          "ArrowUp",
          "ArrowDown",
          "Home",
          "End",
        ];
        if (allowedKeys.includes(event.key)) {
          return;
        }

        // Allow Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
        if (
          (event.key === "a" ||
            event.key === "c" ||
            event.key === "v" ||
            event.key === "x") &&
          (event.ctrlKey || event.metaKey)
        ) {
          return;
        }

        const currentValue = (event.target as HTMLInputElement).value;
        const selectionStart =
          (event.target as HTMLInputElement).selectionStart || 0;

        // Allow minus only at the beginning
        if (event.key === "-") {
          if (selectionStart !== 0 || currentValue.includes("-")) {
            event.preventDefault();
          }
          return;
        }

        // Allow only one decimal point
        if (event.key === ".") {
          if (currentValue.includes(".")) {
            event.preventDefault();
          }
          return;
        }

        // Only allow numeric keys
        if (!/^[0-9]$/.test(event.key)) {
          event.preventDefault();
        }
      }
    },
    [autoSubmitOnChange, onSubmit, type],
  );

  const clear = useCallback(() => {
    onChange("");
    setErrors([]);
    setIsTouched(false);
  }, [onChange]);

  const reset = useCallback(() => {
    onChange("");
    setErrors([]);
    setIsTouched(false);
    setIsFocused(false);
  }, [onChange]);

  const containerProps: React.HTMLAttributes<HTMLElement> = {
    id: id ? `${id}-container` : undefined,
  };

  const inputProps: React.InputHTMLAttributes<HTMLInputElement> & {
    ref: React.RefObject<HTMLInputElement | null>;
  } = {
    ref: inputRef,
    id,
    name,
    type: type === "number" ? "text" : type, // Use text type for number to control input better
    inputMode: type === "number" ? "numeric" : undefined, // Show numeric keyboard on mobile
    pattern: type === "number" ? "[0-9.-]*" : pattern, // Pattern for mobile browsers
    value,
    onChange: handleChange,
    onBlur: handleBlur,
    onFocus: handleFocus,
    onKeyDown: handleKeyDown,
    disabled,
    required,
    placeholder,
    maxLength,
    minLength,
    "aria-label": ariaLabel,
    "aria-describedby": ariaDescribedBy,
    "aria-invalid": errors.length > 0,
    "aria-required": required,
    "aria-disabled": disabled,
  };

  return {
    value,
    errors,
    containerProps,
    inputProps,
    isValid: errors.length === 0,
    isTouched,
    setTouched: setIsTouched,
    validate,
    clear,
    reset,
    isFocused,
  };
}

// Back-compat alias
