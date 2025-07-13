import { useState, useCallback, useEffect } from "react";
import {
  BasePrimitiveProps,
  BasePrimitiveReturn,
  ValidationError,
} from "./types";

export interface LinearScaleConfig {
  start: number;
  end: number;
  step: number;
  startLabel?: string;
  endLabel?: string;
}

export interface BaseLinearScaleProps
  extends BasePrimitiveProps<number | null> {
  /**
   * Configuration for the linear scale
   */
  config: LinearScaleConfig;

  /**
   * Callback on submit (e.g., clicking an option)
   */
  onSubmit?: () => void;

  /**
   * Auto-submit on change (default: true for backward compatibility)
   */
  autoSubmitOnChange?: boolean;
}

export interface BaseLinearScaleReturn
  extends BasePrimitiveReturn<number | null> {
  /**
   * Array of scale values
   */
  scaleValues: number[];

  /**
   * Props for individual scale buttons
   */
  getOptionProps: (
    value: number,
  ) => React.ButtonHTMLAttributes<HTMLButtonElement>;

  /**
   * Whether a specific value is selected
   */
  isSelected: (value: number) => boolean;

  /**
   * Configuration object
   */
  config: LinearScaleConfig;
}

export function BaseLinearScale(
  props: BaseLinearScaleProps,
): BaseLinearScaleReturn {
  const {
    value,
    onChange,
    disabled = false,
    required = false,
    onValidate,
    onValidationChange,
    autoFocus: _autoFocus = false,
    id,
    name: _name,
    ariaLabel,
    ariaDescribedBy,
    config,
    onSubmit,
    autoSubmitOnChange = true,
  } = props;

  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [isTouched, setIsTouched] = useState(false);
  const [focusedValue, setFocusedValue] = useState<number | null>(null);

  // Generate scale values
  const scaleValues: number[] = [];
  for (let i = config.start; i <= config.end; i += config.step) {
    scaleValues.push(i);
  }

  // Validate the selection
  const validate = useCallback(() => {
    const validationErrors: ValidationError[] = [];

    // Required validation
    if (required && value === null) {
      validationErrors.push({
        type: "required",
        message: "Please select a value",
      });
    }

    // Custom validation
    if (onValidate) {
      const customErrors = onValidate(value);
      validationErrors.push(...customErrors);
    }

    setErrors(validationErrors);
    onValidationChange?.(validationErrors);

    return validationErrors;
  }, [value, required, onValidate, onValidationChange]);

  // Validate when touched and value changes
  useEffect(() => {
    if (isTouched) {
      validate();
    }
  }, [value, isTouched, validate]);

  const handleSelect = useCallback(
    (selectedValue: number) => {
      if (disabled) return;

      onChange(selectedValue);
      setIsTouched(true);

      // Controlled by prop instead of hardcoded
      if (autoSubmitOnChange && onSubmit) {
        onSubmit();
      }
    },
    [disabled, onChange, autoSubmitOnChange, onSubmit],
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>, currentValue: number) => {
      const currentIndex = scaleValues.indexOf(currentValue);
      let newIndex = currentIndex;

      switch (event.key) {
        case "ArrowLeft":
        case "ArrowUp":
          event.preventDefault();
          newIndex = Math.max(0, currentIndex - 1);
          break;
        case "ArrowRight":
        case "ArrowDown":
          event.preventDefault();
          newIndex = Math.min(scaleValues.length - 1, currentIndex + 1);
          break;
        case "Home":
          event.preventDefault();
          newIndex = 0;
          break;
        case "End":
          event.preventDefault();
          newIndex = scaleValues.length - 1;
          break;
        case "Enter":
        case " ":
          event.preventDefault();
          handleSelect(currentValue);
          return;
        default: {
          // Handle number keys
          const num = parseInt(event.key);
          if (!isNaN(num) && scaleValues.includes(num)) {
            event.preventDefault();
            handleSelect(num);
            return;
          }
        }
      }

      if (newIndex !== currentIndex) {
        setFocusedValue(scaleValues[newIndex]);
        // Focus the new button
        const button = document.querySelector(
          `[data-scale-value="${scaleValues[newIndex]}"]`,
        ) as HTMLButtonElement;
        button?.focus();
      }
    },
    [scaleValues, handleSelect],
  );

  const getOptionProps = useCallback(
    (optionValue: number): React.ButtonHTMLAttributes<HTMLButtonElement> => {
      const isCurrentlySelected = value === optionValue;
      const isFocused = focusedValue === optionValue;

      return {
        "data-scale-value": optionValue,
        onClick: () => handleSelect(optionValue),
        onKeyDown: (e) => handleKeyDown(e, optionValue),
        onFocus: () => setFocusedValue(optionValue),
        onBlur: () => setFocusedValue(null),
        disabled,
        tabIndex: disabled
          ? -1
          : isCurrentlySelected ||
              (value === null && optionValue === scaleValues[0])
            ? 0
            : -1,
        role: "radio",
        "aria-checked": isCurrentlySelected,
        "aria-label": `${optionValue}${optionValue === config.start && config.startLabel ? ` (${config.startLabel})` : ""}${optionValue === config.end && config.endLabel ? ` (${config.endLabel})` : ""}`,
        "aria-disabled": disabled,
      };
    },
    [
      value,
      focusedValue,
      disabled,
      scaleValues,
      config,
      handleSelect,
      handleKeyDown,
    ],
  );

  const isSelected = useCallback(
    (optionValue: number) => {
      return value === optionValue;
    },
    [value],
  );

  const clear = useCallback(() => {
    onChange(null);
    setErrors([]);
    setIsTouched(false);
    setFocusedValue(null);
  }, [onChange]);

  const reset = useCallback(() => {
    onChange(null);
    setErrors([]);
    setIsTouched(false);
    setFocusedValue(null);
  }, [onChange]);

  const containerProps: React.HTMLAttributes<HTMLElement> = {
    id: id ? `${id}-container` : undefined,
    role: "radiogroup",
    "aria-label": ariaLabel || "Linear scale rating",
    "aria-describedby": ariaDescribedBy,
    "aria-required": required,
    "aria-invalid": errors.length > 0,
  };

  return {
    value,
    errors,
    containerProps,
    isValid: errors.length === 0,
    isTouched,
    setTouched: setIsTouched,
    validate,
    clear,
    reset,
    scaleValues,
    getOptionProps,
    isSelected,
    config,
  };
}
