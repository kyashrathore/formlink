/**
 * Base primitive types for headless form components
 */

export interface ValidationError {
  type: string;
  message: string;
}

export interface BasePrimitiveProps<T = any> {
  /**
   * The current value of the input
   */
  value: T;

  /**
   * Callback when the value changes
   */
  onChange: (value: T) => void;

  /**
   * Whether the input is disabled
   */
  disabled?: boolean;

  /**
   * Whether the input is required
   */
  required?: boolean;

  /**
   * Validation function that returns errors
   */
  onValidate?: (value: T) => ValidationError[];

  /**
   * Callback when validation state changes
   */
  onValidationChange?: (errors: ValidationError[]) => void;

  /**
   * Auto-focus the input
   */
  autoFocus?: boolean;

  /**
   * Unique identifier for the input
   */
  id?: string;

  /**
   * Name attribute for form submission
   */
  name?: string;

  /**
   * ARIA label for accessibility
   */
  ariaLabel?: string;

  /**
   * ARIA description for accessibility
   */
  ariaDescribedBy?: string;
}

export interface Option<T = string> {
  value: T;
  label: string;
  disabled?: boolean;
  description?: string;
  group?: string;
}

export interface BasePrimitiveReturn<T = any> {
  /**
   * Current value
   */
  value: T;

  /**
   * Validation errors
   */
  errors: ValidationError[];

  /**
   * Props to spread on the container element
   */
  containerProps: React.HTMLAttributes<HTMLElement>;

  /**
   * Props to spread on the input element
   */
  inputProps?: React.InputHTMLAttributes<HTMLInputElement>;

  /**
   * Whether the input is currently valid
   */
  isValid: boolean;

  /**
   * Whether the input has been touched/interacted with
   */
  isTouched: boolean;

  /**
   * Set touched state
   */
  setTouched: (touched: boolean) => void;

  /**
   * Trigger validation manually
   */
  validate: () => ValidationError[];

  /**
   * Clear the input value
   */
  clear: () => void;

  /**
   * Reset to initial state
   */
  reset: () => void;
}

export interface KeyboardNavigation {
  /**
   * Currently highlighted index
   */
  highlightedIndex: number;

  /**
   * Set highlighted index
   */
  setHighlightedIndex: (index: number) => void;

  /**
   * Handle keyboard events
   */
  handleKeyDown: (event: React.KeyboardEvent) => void;

  /**
   * Whether keyboard navigation is active
   */
  isNavigating: boolean;
}

export interface AccessibilityProps {
  /**
   * ARIA role
   */
  role?: string;

  /**
   * ARIA label
   */
  "aria-label"?: string;

  /**
   * ARIA labelledby
   */
  "aria-labelledby"?: string;

  /**
   * ARIA describedby
   */
  "aria-describedby"?: string;

  /**
   * ARIA invalid state
   */
  "aria-invalid"?: boolean;

  /**
   * ARIA required state
   */
  "aria-required"?: boolean;

  /**
   * ARIA disabled state
   */
  "aria-disabled"?: boolean;

  /**
   * Tab index
   */
  tabIndex?: number;
}
