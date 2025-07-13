import { useState, useCallback, useEffect, useRef } from "react";
import {
  BasePrimitiveProps,
  BasePrimitiveReturn,
  ValidationError,
  Option,
} from "./types";

export interface BaseSelectProps<T = string> extends BasePrimitiveProps<T> {
  /**
   * Available options
   */
  options: Option<T>[];

  /**
   * Placeholder text when no option is selected
   */
  placeholder?: string;

  /**
   * Whether the dropdown is open
   */
  isOpen?: boolean;

  /**
   * Callback when dropdown open state changes
   */
  onOpenChange?: (open: boolean) => void;

  /**
   * Callback on blur
   */
  onBlur?: () => void;

  /**
   * Callback on focus
   */
  onFocus?: () => void;

  /**
   * Callback on submit (after selection)
   */
  onSubmit?: () => void;

  /**
   * Enable keyboard shortcuts (letters and numbers)
   */
  enableShortcuts?: boolean;

  /**
   * Enable arrow key navigation
   */
  enableArrowNavigation?: boolean;

  /**
   * Auto-submit on change (default: true for backward compatibility)
   */
  autoSubmitOnChange?: boolean;
}

export interface BaseSelectReturn<T = string> extends BasePrimitiveReturn<T> {
  /**
   * Current highlighted index
   */
  highlightedIndex: number;

  /**
   * Set highlighted index
   */
  setHighlightedIndex: (index: number) => void;

  /**
   * Processed options with additional props
   */
  options: Array<
    Option<T> & {
      props: React.HTMLAttributes<HTMLElement>;
      isSelected: boolean;
      isHighlighted: boolean;
    }
  >;

  /**
   * Whether the dropdown is open
   */
  isOpen: boolean;

  /**
   * Open the dropdown
   */
  open: () => void;

  /**
   * Close the dropdown
   */
  close: () => void;

  /**
   * Toggle dropdown state
   */
  toggle: () => void;

  /**
   * Select an option by value
   */
  selectOption: (value: T) => void;

  /**
   * Select an option by index
   */
  selectByIndex: (index: number) => void;

  /**
   * Get container props with keyboard handling
   */
  getContainerProps: () => React.HTMLAttributes<HTMLElement>;

  /**
   * Get option props for a specific index
   */
  getOptionProps: (index: number) => React.HTMLAttributes<HTMLElement>;
}

export function BaseSelect<T = string>(
  props: BaseSelectProps<T>,
): BaseSelectReturn<T> {
  const {
    value,
    onChange,
    options,
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
    isOpen: controlledIsOpen,
    onOpenChange,
    onBlur,
    onFocus,
    onSubmit,
    enableShortcuts = true,
    enableArrowNavigation = true,
    autoSubmitOnChange = true,
  } = props;

  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [isTouched, setIsTouched] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const containerRef = useRef<HTMLElement>(null);

  // Use controlled or internal state for open
  const isOpen =
    controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;
  const setIsOpen = useCallback(
    (open: boolean) => {
      if (controlledIsOpen === undefined) {
        setInternalIsOpen(open);
      }
      onOpenChange?.(open);
    },
    [controlledIsOpen, onOpenChange],
  );

  // Validate the selection
  const validate = useCallback(() => {
    const validationErrors: ValidationError[] = [];

    // Required validation
    if (required && !value) {
      validationErrors.push({
        type: "required",
        message: "Please select an option",
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

  // Auto-focus on mount
  useEffect(() => {
    if (autoFocus && containerRef.current) {
      containerRef.current.focus();
    }
  }, [autoFocus]);

  // Validate when touched and value changes
  useEffect(() => {
    if (isTouched) {
      validate();
    }
  }, [value, isTouched, validate]);

  // Update highlighted index when dropdown opens
  useEffect(() => {
    if (isOpen) {
      // Safe array access with fallback
      const safeOptions = options || [];
      const selectedIndex = safeOptions.findIndex((opt) => opt.value === value);
      setHighlightedIndex(selectedIndex >= 0 ? selectedIndex : 0);
    }
  }, [isOpen, value, options]);

  const open = useCallback(() => {
    if (!disabled) {
      setIsOpen(true);
      onFocus?.();
    }
  }, [disabled, setIsOpen, onFocus]);

  const close = useCallback(() => {
    setIsOpen(false);
    setHighlightedIndex(-1);
    onBlur?.();
  }, [setIsOpen, onBlur]);

  const toggle = useCallback(() => {
    if (isOpen) {
      close();
    } else {
      open();
    }
  }, [isOpen, open, close]);

  const selectOption = useCallback(
    (optionValue: T) => {
      if (!disabled) {
        onChange(optionValue);
        setIsTouched(true);
        close();

        // Controlled by prop instead of hardcoded
        if (autoSubmitOnChange && onSubmit) {
          onSubmit();
        }
      }
    },
    [disabled, onChange, close, autoSubmitOnChange, onSubmit],
  );

  const selectByIndex = useCallback(
    (index: number) => {
      // Safe array access with fallback
      const safeOptions = options || [];
      if (index >= 0 && index < safeOptions.length) {
        const option = safeOptions[index];
        if (!option.disabled) {
          selectOption(option.value);
        }
      }
    },
    [options, selectOption],
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (disabled) return;

      // Don't handle if any modifier key is pressed (to allow browser shortcuts)
      if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      // Handle dropdown navigation when open
      if (isOpen) {
        // Safe array access with fallback
        const safeOptions = options || [];

        switch (event.key) {
          case "ArrowDown":
            event.preventDefault();
            setHighlightedIndex((prev) => {
              const next = prev + 1;
              return next >= safeOptions.length ? 0 : next;
            });
            break;

          case "ArrowUp":
            event.preventDefault();
            setHighlightedIndex((prev) => {
              const next = prev - 1;
              return next < 0 ? safeOptions.length - 1 : next;
            });
            break;

          case "Enter":
            event.preventDefault();
            if (highlightedIndex >= 0) {
              selectByIndex(highlightedIndex);
            }
            break;

          case "Escape":
            event.preventDefault();
            close();
            break;

          case " ":
            event.preventDefault();
            if (highlightedIndex >= 0) {
              selectByIndex(highlightedIndex);
            }
            break;
        }
      } else {
        // Handle shortcuts when closed
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          open();
        } else if (
          enableArrowNavigation &&
          (event.key === "ArrowDown" || event.key === "ArrowUp")
        ) {
          event.preventDefault();
          open();
        } else if (enableShortcuts && !event.shiftKey) {
          // Don't handle shortcuts if shift is pressed
          // Safe array access with fallback
          const safeOptions = options || [];

          // Letter shortcuts
          if (/^[a-zA-Z]$/.test(event.key)) {
            const letter = event.key.toLowerCase();
            const optionIndex = safeOptions.findIndex(
              (opt) =>
                opt.label.toLowerCase().startsWith(letter) && !opt.disabled,
            );
            if (optionIndex >= 0) {
              event.preventDefault();
              selectByIndex(optionIndex);
            }
          }
          // Number shortcuts
          else if (/^[1-9]$/.test(event.key)) {
            const index = parseInt(event.key) - 1;
            if (index < safeOptions.length) {
              event.preventDefault();
              selectByIndex(index);
            }
          }
        }
      }
    },
    [
      disabled,
      isOpen,
      highlightedIndex,
      options,
      enableShortcuts,
      enableArrowNavigation,
      open,
      close,
      selectByIndex,
    ],
  );

  const clear = useCallback(() => {
    onChange(null as any);
    setErrors([]);
    setIsTouched(false);
    close();
  }, [onChange, close]);

  const reset = useCallback(() => {
    onChange(null as any);
    setErrors([]);
    setIsTouched(false);
    setHighlightedIndex(-1);
    close();
  }, [onChange, close]);

  const getContainerProps = useCallback(
    () => ({
      ref: containerRef,
      id: id ? `${id}-container` : undefined,
      tabIndex: disabled ? -1 : 0,
      onKeyDown: handleKeyDown,
      "aria-label": ariaLabel,
      "aria-describedby": ariaDescribedBy,
      "aria-invalid": errors.length > 0,
      "aria-required": required,
      "aria-disabled": disabled,
      "aria-expanded": isOpen,
      "aria-haspopup": "listbox" as const,
      role: "combobox",
    }),
    [
      id,
      disabled,
      handleKeyDown,
      ariaLabel,
      ariaDescribedBy,
      errors,
      required,
      isOpen,
    ],
  );

  const getOptionProps = useCallback(
    (index: number) => {
      // Safe array access with fallback
      const safeOptions = options || [];

      return {
        id: id ? `${id}-option-${index}` : undefined,
        role: "option",
        "aria-selected": safeOptions[index]?.value === value,
        "aria-disabled": safeOptions[index]?.disabled,
        tabIndex: -1,
        onClick: () => selectByIndex(index),
        onMouseEnter: () => setHighlightedIndex(index),
      };
    },
    [id, options, value, selectByIndex],
  );

  // Process options with additional props
  // Safe array access with fallback
  const safeOptions = options || [];

  const processedOptions = safeOptions.map((opt, idx) => ({
    ...opt,
    props: getOptionProps(idx),
    isSelected: value === opt.value,
    isHighlighted: highlightedIndex === idx,
  }));

  return {
    value,
    errors,
    containerProps: getContainerProps(),
    isValid: errors.length === 0,
    isTouched,
    setTouched: setIsTouched,
    validate,
    clear,
    reset,
    highlightedIndex,
    setHighlightedIndex,
    options: processedOptions,
    isOpen,
    open,
    close,
    toggle,
    selectOption,
    selectByIndex,
    getContainerProps,
    getOptionProps,
  };
}
