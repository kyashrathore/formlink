import { useState, useCallback, useEffect, useRef } from "react";
import {
  BasePrimitiveProps,
  BasePrimitiveReturn,
  ValidationError,
  Option,
} from "./types";

// NOTE: This is a custom hook. It must be called
// unconditionally at the top level of a React component.
// Do not guard it behind conditionals or early returns.
// Skipping this call across renders changes the caller's
// hook count and will trigger React’s invariant.

export interface BaseMultiSelectProps<T = string>
  extends BasePrimitiveProps<T[]> {
  options: Option<T>[];
  placeholder?: string;
  maxSelections?: number;
  minSelections?: number;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  onBlur?: () => void;
  onFocus?: () => void;
  onSubmit?: () => void;
  enableShortcuts?: boolean;
  enableArrowNavigation?: boolean;
  // Accessibility controls (for wrapper-specific semantics)
  a11yContainerRole?: "combobox" | "group" | "listbox" | "none";
  a11yHasPopup?: boolean | "listbox";
  a11yIncludeAriaMultiSelectable?: boolean;
  a11yIncludeExpanded?: boolean;
}

export interface BaseMultiSelectReturn<T = string>
  extends BasePrimitiveReturn<T[]> {
  highlightedIndex: number;
  setHighlightedIndex: (index: number) => void;
  options: Array<
    Option<T> & {
      props: React.HTMLAttributes<HTMLElement>;
      isSelected: boolean;
      isHighlighted: boolean;
    }
  >;
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  toggleOption: (value: T) => void;
  selectOption: (value: T) => void;
  deselectOption: (value: T) => void;
  toggleByIndex: (index: number) => void;
  selectAll: () => void;
  deselectAll: () => void;
  getContainerProps: () => React.HTMLAttributes<HTMLElement>;
  getOptionProps: (index: number) => React.HTMLAttributes<HTMLElement>;
}

export function useBaseMultiSelect<T = string>(
  props: BaseMultiSelectProps<T>,
): BaseMultiSelectReturn<T> {
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
    name: _name,
    ariaLabel,
    ariaDescribedBy,
    placeholder: _placeholder,
    maxSelections,
    minSelections,
    isOpen: controlledIsOpen,
    onOpenChange,
    onBlur,
    onFocus,
    onSubmit,
    enableShortcuts = true,
    enableArrowNavigation = true,
    a11yContainerRole = "combobox",
    a11yHasPopup = "listbox",
    a11yIncludeAriaMultiSelectable = true,
    a11yIncludeExpanded = true,
  } = props;

  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [isTouched, setIsTouched] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const containerRef = useRef<HTMLElement>(null);

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

  const validate = useCallback(() => {
    const validationErrors: ValidationError[] = [];
    const safeValue = value || [];
    if (required && safeValue.length === 0) {
      validationErrors.push({
        type: "required",
        message: "Please select at least one option",
      });
    }
    if (minSelections && safeValue.length < minSelections) {
      validationErrors.push({
        type: "minSelections",
        message: `Please select at least ${minSelections} option${minSelections > 1 ? "s" : ""}`,
      });
    }
    if (maxSelections && safeValue.length > maxSelections) {
      validationErrors.push({
        type: "maxSelections",
        message: `Please select no more than ${maxSelections} option${maxSelections > 1 ? "s" : ""}`,
      });
    }
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
    minSelections,
    maxSelections,
    onValidate,
    onValidationChange,
  ]);

  useEffect(() => {
    if (autoFocus && containerRef.current) {
      containerRef.current.focus();
    }
  }, [autoFocus]);

  useEffect(() => {
    if (isTouched) {
      validate();
    }
  }, [value, isTouched, validate]);

  useEffect(() => {
    if (isOpen && highlightedIndex === -1) {
      setHighlightedIndex(0);
    }
  }, [isOpen, highlightedIndex]);

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

  const toggleOption = useCallback(
    (optionValue: T) => {
      if (disabled) return;
      const safeValue = value || [];
      const isSelected = safeValue.includes(optionValue);
      if (isSelected) {
        onChange(safeValue.filter((v) => v !== optionValue));
      } else {
        if (!maxSelections || safeValue.length < maxSelections) {
          onChange([...safeValue, optionValue]);
        }
      }
      setIsTouched(true);
    },
    [disabled, value, onChange, maxSelections],
  );

  const selectOption = useCallback(
    (optionValue: T) => {
      const safeValue = value || [];
      if (disabled || safeValue.includes(optionValue)) return;
      if (!maxSelections || safeValue.length < maxSelections) {
        onChange([...safeValue, optionValue]);
        setIsTouched(true);
      }
    },
    [disabled, value, onChange, maxSelections],
  );

  const deselectOption = useCallback(
    (optionValue: T) => {
      const safeValue = value || [];
      if (disabled || !safeValue.includes(optionValue)) return;
      onChange(safeValue.filter((v) => v !== optionValue));
      setIsTouched(true);
    },
    [disabled, value, onChange],
  );

  const toggleByIndex = useCallback(
    (index: number) => {
      const safeOptions = options || [];
      if (index >= 0 && index < safeOptions.length) {
        const option = safeOptions[index];
        if (!option?.disabled) {
          toggleOption(option?.value || ("" as T));
        }
      }
    },
    [options, toggleOption],
  );

  const selectAll = useCallback(() => {
    if (disabled) return;
    const safeOptions = options || [];
    const selectableOptions = safeOptions.filter((opt) => !opt.disabled);
    const allValues = selectableOptions.map((opt) => opt.value);
    if (maxSelections) {
      onChange(allValues.slice(0, maxSelections));
    } else {
      onChange(allValues);
    }
    setIsTouched(true);
  }, [disabled, options, maxSelections, onChange]);

  const deselectAll = useCallback(() => {
    if (disabled) return;
    onChange([]);
    setIsTouched(true);
  }, [disabled, onChange]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (disabled) return;
      if (isOpen) {
        const safeOptions = options || [];
        switch (event.key) {
          case "ArrowDown":
            event.preventDefault();
            setHighlightedIndex((prev) => (prev + 1) % safeOptions.length);
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
            if (highlightedIndex >= 0) toggleByIndex(highlightedIndex);
            break;
          case " ":
            event.preventDefault();
            if (highlightedIndex >= 0) toggleByIndex(highlightedIndex);
            break;
          case "Escape":
            event.preventDefault();
            close();
            break;
        }
      } else {
        const safeOptions = options || [];
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          open();
        } else if (
          enableArrowNavigation &&
          (event.key === "ArrowDown" || event.key === "ArrowUp")
        ) {
          event.preventDefault();
          open();
        } else if (enableShortcuts) {
          if (/^[a-zA-Z]$/.test(event.key)) {
            const letter = event.key.toLowerCase();
            const optionIndex = safeOptions.findIndex(
              (opt) =>
                opt.label.toLowerCase().startsWith(letter) && !opt.disabled,
            );
            if (optionIndex >= 0) {
              event.preventDefault();
              toggleByIndex(optionIndex);
            }
          } else if (/^[1-9]$/.test(event.key)) {
            const index = parseInt(event.key) - 1;
            if (index < safeOptions.length) {
              event.preventDefault();
              toggleByIndex(index);
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
      toggleByIndex,
      onSubmit,
    ],
  );

  const clear = useCallback(() => {
    onChange([]);
    setErrors([]);
    setIsTouched(false);
    close();
  }, [onChange, close]);

  const reset = useCallback(() => {
    onChange([]);
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
      ...(a11yIncludeExpanded ? { "aria-expanded": isOpen } : {}),
      ...(a11yHasPopup
        ? {
            "aria-haspopup": (a11yHasPopup === true
              ? "listbox"
              : a11yHasPopup) as React.AriaAttributes["aria-haspopup"],
          }
        : {}),
      ...(a11yIncludeAriaMultiSelectable
        ? { "aria-multiselectable": true }
        : {}),
      ...(a11yContainerRole !== "none" ? { role: a11yContainerRole } : {}),
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
      a11yIncludeExpanded,
      a11yHasPopup,
      a11yIncludeAriaMultiSelectable,
      a11yContainerRole,
    ],
  );

  const getOptionProps = useCallback(
    (index: number) => {
      const safeValue = value || [];
      const safeOptions = options || [];
      return {
        id: id ? `${id}-option-${index}` : undefined,
        role: "option",
        "aria-selected": safeOptions[index]
          ? safeValue.includes(safeOptions[index].value)
          : false,
        "aria-disabled": safeOptions[index]?.disabled,
        tabIndex: -1,
        onClick: () => toggleByIndex(index),
        onMouseEnter: () => setHighlightedIndex(index),
      };
    },
    [id, options, value, toggleByIndex],
  );

  const safeOptions = options || [];
  const safeValue = value || [];
  const processedOptions = safeOptions.map((opt, idx) => ({
    ...opt,
    props: getOptionProps(idx),
    isSelected: safeValue.includes(opt.value),
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
    toggleOption,
    selectOption,
    deselectOption,
    toggleByIndex,
    selectAll,
    deselectAll,
    getContainerProps,
    getOptionProps,
  };
}
