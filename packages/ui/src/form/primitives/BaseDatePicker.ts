import { useState, useCallback, useEffect, useRef } from "react";
import {
  BasePrimitiveProps,
  BasePrimitiveReturn,
  ValidationError,
} from "./types";

export interface BaseDatePickerProps extends BasePrimitiveProps<Date | null> {
  /**
   * Minimum date allowed
   */
  minDate?: Date;

  /**
   * Maximum date allowed
   */
  maxDate?: Date;

  /**
   * Disabled dates
   */
  disabledDates?: Date[];

  /**
   * Date format string or function
   */
  format?: string | ((date: Date) => string);

  /**
   * Placeholder text
   */
  placeholder?: string;

  /**
   * Whether calendar is open
   */
  isCalendarOpen?: boolean;

  /**
   * Callback when calendar open state changes
   */
  onCalendarOpenChange?: (open: boolean) => void;

  /**
   * Callback on submit
   */
  onSubmit?: () => void;

  /**
   * Enable keyboard navigation
   */
  enableKeyboard?: boolean;

  /**
   * First day of week (0 = Sunday, 1 = Monday, etc.)
   */
  firstDayOfWeek?: number;

  /**
   * Auto-submit on change (default: true for backward compatibility)
   */
  autoSubmitOnChange?: boolean;
}

export interface BaseDatePickerReturn extends BasePrimitiveReturn<Date | null> {
  /**
   * Formatted date string
   */
  formattedValue: string;

  /**
   * Whether calendar is open
   */
  isCalendarOpen: boolean;

  /**
   * Open the calendar
   */
  openCalendar: () => void;

  /**
   * Close the calendar
   */
  closeCalendar: () => void;

  /**
   * Toggle calendar state
   */
  toggleCalendar: () => void;

  /**
   * Currently highlighted date in calendar
   */
  highlightedDate: Date;

  /**
   * Set highlighted date
   */
  setHighlightedDate: (date: Date) => void;

  /**
   * Props for the input element
   */
  inputProps: React.InputHTMLAttributes<HTMLInputElement>;

  /**
   * Props for the calendar trigger button
   */
  triggerProps: React.ButtonHTMLAttributes<HTMLButtonElement>;

  /**
   * Calendar navigation
   */
  calendar: {
    currentMonth: Date;
    setCurrentMonth: (date: Date) => void;
    nextMonth: () => void;
    previousMonth: () => void;
    nextYear: () => void;
    previousYear: () => void;
    goToToday: () => void;
    getDaysInMonth: () => CalendarDay[];
  };

  /**
   * Select a date (exposed for testing)
   */
  selectDate: (date: Date) => void;
}

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  isDisabled: boolean;
  props: React.HTMLAttributes<HTMLElement>;
}

export function BaseDatePicker(
  props: BaseDatePickerProps,
): BaseDatePickerReturn {
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
    minDate,
    maxDate,
    disabledDates = [],
    format = "MM/DD/YYYY",
    placeholder = "Select date",
    isCalendarOpen: controlledIsCalendarOpen,
    onCalendarOpenChange,
    onSubmit,
    enableKeyboard = true,
    firstDayOfWeek = 0,
    autoSubmitOnChange = true,
  } = props;

  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [isTouched, setIsTouched] = useState(false);
  const [internalIsCalendarOpen, setInternalIsCalendarOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(value || new Date());
  const [highlightedDate, setHighlightedDate] = useState(value || new Date());
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Use controlled or internal state for calendar open
  const isCalendarOpen =
    controlledIsCalendarOpen !== undefined
      ? controlledIsCalendarOpen
      : internalIsCalendarOpen;
  const setIsCalendarOpen = useCallback(
    (open: boolean) => {
      if (controlledIsCalendarOpen === undefined) {
        setInternalIsCalendarOpen(open);
      }
      onCalendarOpenChange?.(open);
    },
    [controlledIsCalendarOpen, onCalendarOpenChange],
  );

  // Format date - make it stable by using a ref for the format prop
  const formatRef = useRef(format);
  useEffect(() => {
    formatRef.current = format;
  }, [format]);

  const formatDate = useCallback((date: Date | null): string => {
    if (!date) return "";

    const currentFormat = formatRef.current;
    if (typeof currentFormat === "function") {
      return currentFormat(date);
    }

    // Simple format implementation (you can use date-fns or similar in real implementation)
    const pad = (n: number) => n.toString().padStart(2, "0");
    return currentFormat
      .replace("YYYY", date.getFullYear().toString())
      .replace("YY", date.getFullYear().toString().slice(-2))
      .replace("MM", pad(date.getMonth() + 1))
      .replace("DD", pad(date.getDate()));
  }, []); // No dependencies - stable function

  // Parse date from input
  const parseDate = useCallback((dateString: string): Date | null => {
    if (!dateString) return null;

    // Simple parse implementation (you can use date-fns or similar in real implementation)
    const parts = dateString.split(/[/\-.]/);
    if (parts.length !== 3) return null;

    const month = parseInt(parts[0]) - 1;
    const day = parseInt(parts[1]);
    const year = parseInt(parts[2]);

    if (isNaN(month) || isNaN(day) || isNaN(year)) return null;

    const date = new Date(year, month, day);
    if (date.getMonth() !== month || date.getDate() !== day) return null;

    return date;
  }, []);

  // Update input value when value changes
  useEffect(() => {
    setInputValue(formatDate(value));
  }, [value, formatDate]);

  // Use ref to avoid infinite loops with onValidationChange callback
  const onValidationChangeRef = useRef(onValidationChange);
  useEffect(() => {
    onValidationChangeRef.current = onValidationChange;
  }, [onValidationChange]);

  // Validate the date
  const validate = useCallback(() => {
    const validationErrors: ValidationError[] = [];

    // Required validation
    if (required && !value) {
      validationErrors.push({
        type: "required",
        message: "Please select a date",
      });
    }

    if (value) {
      // Min date validation
      if (minDate && value < minDate) {
        validationErrors.push({
          type: "minDate",
          message: `Date must be after ${formatDate(minDate)}`,
        });
      }

      // Max date validation
      if (maxDate && value > maxDate) {
        validationErrors.push({
          type: "maxDate",
          message: `Date must be before ${formatDate(maxDate)}`,
        });
      }

      // Disabled dates validation
      const isDisabled = disabledDates.some(
        (d) =>
          d.getFullYear() === value.getFullYear() &&
          d.getMonth() === value.getMonth() &&
          d.getDate() === value.getDate(),
      );
      if (isDisabled) {
        validationErrors.push({
          type: "disabledDate",
          message: "This date is not available",
        });
      }
    }

    // Custom validation
    if (onValidate) {
      const customErrors = onValidate(value);
      validationErrors.push(...customErrors);
    }

    setErrors(validationErrors);
    onValidationChangeRef.current?.(validationErrors);

    return validationErrors;
  }, [
    value,
    required,
    minDate,
    maxDate,
    disabledDates,
    formatDate,
    onValidate,
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
      // Defer validation to next tick to avoid infinite loops
      const timeoutId = setTimeout(() => {
        validate();
      }, 0);

      return () => clearTimeout(timeoutId);
    }
  }, [value, isTouched, validate]);

  const openCalendar = useCallback(() => {
    if (!disabled) {
      setIsCalendarOpen(true);
      if (value) {
        setCurrentMonth(value);
        setHighlightedDate(value);
      }
    }
  }, [disabled, value, setIsCalendarOpen]);

  const closeCalendar = useCallback(() => {
    setIsCalendarOpen(false);
  }, [setIsCalendarOpen]);

  const toggleCalendar = useCallback(() => {
    if (isCalendarOpen) {
      closeCalendar();
    } else {
      openCalendar();
    }
  }, [isCalendarOpen, openCalendar, closeCalendar]);

  const selectDate = useCallback(
    (date: Date) => {
      if (disabled) return;

      onChange(date);
      setIsTouched(true);
      closeCalendar();

      // Controlled by prop instead of hardcoded
      if (autoSubmitOnChange && onSubmit) {
        onSubmit();
      }
    },
    [disabled, onChange, closeCalendar, autoSubmitOnChange, onSubmit],
  );

  const handleInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = event.target.value;
      setInputValue(newValue);

      // Try to parse the date
      const parsedDate = parseDate(newValue);
      if (parsedDate) {
        onChange(parsedDate);
        setCurrentMonth(parsedDate);
        setHighlightedDate(parsedDate);
      }
    },
    [parseDate, onChange],
  );

  const handleInputBlur = useCallback(() => {
    setIsTouched(true);
    // Reformat the input value
    setInputValue(formatDate(value));
  }, [value, formatDate]);

  const handleInputKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (disabled || !enableKeyboard) return;

      switch (event.key) {
        case "Enter":
          event.preventDefault();
          if (isCalendarOpen) {
            selectDate(highlightedDate);
          } else {
            openCalendar();
          }
          break;

        case "Escape":
          if (isCalendarOpen) {
            event.preventDefault();
            closeCalendar();
          }
          break;

        case "ArrowDown":
          if (!isCalendarOpen) {
            event.preventDefault();
            openCalendar();
          }
          break;
      }
    },
    [
      disabled,
      enableKeyboard,
      isCalendarOpen,
      highlightedDate,
      selectDate,
      openCalendar,
      closeCalendar,
    ],
  );

  const handleCalendarKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (disabled || !enableKeyboard || !isCalendarOpen) return;

      let newDate = new Date(highlightedDate);
      let handled = true;

      switch (event.key) {
        case "ArrowLeft":
          newDate.setDate(newDate.getDate() - 1);
          break;

        case "ArrowRight":
          newDate.setDate(newDate.getDate() + 1);
          break;

        case "ArrowUp":
          newDate.setDate(newDate.getDate() - 7);
          break;

        case "ArrowDown":
          newDate.setDate(newDate.getDate() + 7);
          break;

        case "Home":
          newDate.setDate(1);
          break;

        case "End":
          newDate = new Date(newDate.getFullYear(), newDate.getMonth() + 1, 0);
          break;

        case "PageUp":
          if (event.shiftKey) {
            newDate.setFullYear(newDate.getFullYear() - 1);
          } else {
            newDate.setMonth(newDate.getMonth() - 1);
          }
          break;

        case "PageDown":
          if (event.shiftKey) {
            newDate.setFullYear(newDate.getFullYear() + 1);
          } else {
            newDate.setMonth(newDate.getMonth() + 1);
          }
          break;

        case "Enter":
        case " ":
          selectDate(highlightedDate);
          break;

        case "Escape":
          closeCalendar();
          break;

        default:
          handled = false;
      }

      if (handled) {
        event.preventDefault();
        setHighlightedDate(newDate);

        // Update current month if necessary
        if (
          newDate.getMonth() !== currentMonth.getMonth() ||
          newDate.getFullYear() !== currentMonth.getFullYear()
        ) {
          setCurrentMonth(newDate);
        }
      }
    },
    [
      disabled,
      enableKeyboard,
      isCalendarOpen,
      highlightedDate,
      currentMonth,
      selectDate,
      closeCalendar,
    ],
  );

  const clear = useCallback(() => {
    onChange(null);
    setInputValue("");
    setErrors([]);
    setIsTouched(false);
    closeCalendar();
  }, [onChange, closeCalendar]);

  const reset = useCallback(() => {
    onChange(null);
    setInputValue("");
    setErrors([]);
    setIsTouched(false);
    setCurrentMonth(new Date());
    setHighlightedDate(new Date());
    closeCalendar();
  }, [onChange, closeCalendar]);

  const isDateDisabled = useCallback(
    (date: Date): boolean => {
      if (minDate && date < minDate) return true;
      if (maxDate && date > maxDate) return true;

      return disabledDates.some(
        (d) =>
          d.getFullYear() === date.getFullYear() &&
          d.getMonth() === date.getMonth() &&
          d.getDate() === date.getDate(),
      );
    },
    [minDate, maxDate, disabledDates],
  );

  // Calendar methods
  const nextMonth = useCallback(() => {
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1),
    );
  }, [currentMonth]);

  const previousMonth = useCallback(() => {
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1),
    );
  }, [currentMonth]);

  const nextYear = useCallback(() => {
    setCurrentMonth(
      new Date(currentMonth.getFullYear() + 1, currentMonth.getMonth()),
    );
  }, [currentMonth]);

  const previousYear = useCallback(() => {
    setCurrentMonth(
      new Date(currentMonth.getFullYear() - 1, currentMonth.getMonth()),
    );
  }, [currentMonth]);

  const goToToday = useCallback(() => {
    const today = new Date();
    setCurrentMonth(today);
    setHighlightedDate(today);
  }, []);

  const getDaysInMonth = useCallback((): CalendarDay[] => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startOffset = (firstDay.getDay() - firstDayOfWeek + 7) % 7;

    const days: CalendarDay[] = [];
    const today = new Date();

    // Previous month days
    for (let i = startOffset - 1; i >= 0; i--) {
      const date = new Date(year, month, -i);
      days.push({
        date,
        isCurrentMonth: false,
        isToday: false,
        isSelected: false,
        isDisabled: true,
        props: {},
      });
    }

    // Current month days
    for (let day = 1; day <= lastDay.getDate(); day++) {
      const date = new Date(year, month, day);
      const isToday = date.toDateString() === today.toDateString();
      const isSelected = value
        ? date.toDateString() === value.toDateString()
        : false;
      const isHighlighted =
        date.toDateString() === highlightedDate.toDateString();
      const isDisabled = isDateDisabled(date);

      days.push({
        date,
        isCurrentMonth: true,
        isToday,
        isSelected,
        isDisabled,
        props: {
          onClick: () => !isDisabled && selectDate(date),
          onMouseEnter: () => !isDisabled && setHighlightedDate(date),
          "aria-selected": isSelected,
          "aria-current": isToday ? "date" : undefined,
          "aria-disabled": isDisabled,
          tabIndex: isHighlighted ? 0 : -1,
          role: "gridcell",
        },
      });
    }

    // Next month days to fill the grid
    const remainingDays = 42 - days.length; // 6 weeks × 7 days
    for (let day = 1; day <= remainingDays; day++) {
      const date = new Date(year, month + 1, day);
      days.push({
        date,
        isCurrentMonth: false,
        isToday: false,
        isSelected: false,
        isDisabled: true,
        props: {},
      });
    }

    return days;
  }, [
    currentMonth,
    value,
    highlightedDate,
    firstDayOfWeek,
    isDateDisabled,
    selectDate,
  ]);

  const containerProps: React.HTMLAttributes<HTMLElement> = {
    id: id ? `${id}-container` : undefined,
    onKeyDown: handleCalendarKeyDown,
  };

  const inputProps: React.InputHTMLAttributes<HTMLInputElement> = {
    ref: inputRef,
    id,
    name,
    type: "text",
    value: inputValue,
    onChange: handleInputChange,
    onBlur: handleInputBlur,
    onKeyDown: handleInputKeyDown,
    disabled,
    required,
    placeholder,
    "aria-label": ariaLabel || "Date input",
    "aria-describedby": ariaDescribedBy,
    "aria-invalid": errors.length > 0,
    "aria-required": required,
    "aria-disabled": disabled,
    "aria-haspopup": "dialog",
    "aria-expanded": isCalendarOpen,
  };

  const triggerProps: React.ButtonHTMLAttributes<HTMLButtonElement> = {
    type: "button",
    onClick: toggleCalendar,
    disabled,
    "aria-label": "Open calendar",
    "aria-haspopup": "dialog",
    "aria-expanded": isCalendarOpen,
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
    formattedValue: formatDate(value),
    isCalendarOpen,
    openCalendar,
    closeCalendar,
    toggleCalendar,
    highlightedDate,
    setHighlightedDate,
    inputProps,
    triggerProps,
    calendar: {
      currentMonth,
      setCurrentMonth,
      nextMonth,
      previousMonth,
      nextYear,
      previousYear,
      goToToday,
      getDaysInMonth,
    },
    selectDate,
  };
}
