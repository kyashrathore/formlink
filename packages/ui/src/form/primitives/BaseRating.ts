import { useState, useCallback, useEffect, useRef } from 'react';
import { BasePrimitiveProps, BasePrimitiveReturn, ValidationError } from './types';

export interface BaseRatingProps extends BasePrimitiveProps<number> {
  /**
   * Maximum rating value (e.g., 5 for 5-star rating)
   */
  max?: number;
  
  /**
   * Minimum rating value (default: 0)
   */
  min?: number;
  
  /**
   * Step between values (e.g., 0.5 for half-star ratings)
   */
  step?: number;
  
  /**
   * Allow clearing the rating (setting to 0/null)
   */
  allowClear?: boolean;
  
  /**
   * Callback on hover over a rating value
   */
  onHover?: (value: number | null) => void;
  
  /**
   * Callback on submit
   */
  onSubmit?: () => void;
  
  /**
   * Enable keyboard navigation
   */
  enableKeyboard?: boolean;
  
  /**
   * Auto-submit on change (default: true for backward compatibility)
   */
  autoSubmitOnChange?: boolean;
}

export interface BaseRatingReturn extends BasePrimitiveReturn<number> {
  /**
   * Current hovered value
   */
  hoveredValue: number | null;
  
  /**
   * Set hovered value
   */
  setHoveredValue: (value: number | null) => void;
  
  /**
   * Rating items with properties
   */
  items: Array<{
    value: number;
    props: React.HTMLAttributes<HTMLElement>;
    isActive: boolean;
    isHovered: boolean;
    isHalf: boolean;
  }>;
  
  /**
   * Set rating to a specific value
   */
  setRating: (value: number) => void;
  
  /**
   * Get props for a rating item
   */
  getItemProps: (value: number) => React.HTMLAttributes<HTMLElement>;
}

export function BaseRating(props: BaseRatingProps): BaseRatingReturn {
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
    max = 5,
    min = 0,
    step = 1,
    allowClear = true,
    onHover,
    onSubmit,
    enableKeyboard = true,
    autoSubmitOnChange = true,
  } = props;

  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [isTouched, setIsTouched] = useState(false);
  const [hoveredValue, setHoveredValue] = useState<number | null>(null);
  const containerRef = useRef<HTMLElement>(null);

  // Validate the rating
  const validate = useCallback(() => {
    const validationErrors: ValidationError[] = [];

    // Required validation
    if (required && (!value || value === 0)) {
      validationErrors.push({
        type: 'required',
        message: 'Please provide a rating',
      });
    }

    // Min validation
    if (value && value < min) {
      validationErrors.push({
        type: 'min',
        message: `Rating must be at least ${min}`,
      });
    }

    // Max validation
    if (value && value > max) {
      validationErrors.push({
        type: 'max',
        message: `Rating cannot exceed ${max}`,
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
  }, [value, required, min, max, onValidate, onValidationChange]);

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

  // Handle hover callback
  useEffect(() => {
    if (onHover) {
      onHover(hoveredValue);
    }
  }, [hoveredValue, onHover]);

  const setRating = useCallback((newValue: number) => {
    if (disabled) return;

    // If clicking the same value and clear is allowed, clear the rating
    if (allowClear && value === newValue) {
      onChange(0);
    } else {
      onChange(newValue);
    }
    
    setIsTouched(true);
    
    // Controlled by prop instead of hardcoded
    if (autoSubmitOnChange !== false && onSubmit) {
      onSubmit();
    }
  }, [disabled, value, onChange, allowClear, autoSubmitOnChange, onSubmit]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (disabled || !enableKeyboard) return;

    let newValue: number | null = null;

    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        event.preventDefault();
        newValue = Math.min(value + step, max);
        break;
        
      case 'ArrowLeft':
      case 'ArrowDown':
        event.preventDefault();
        newValue = Math.max(value - step, min);
        break;
        
      case 'Home':
        event.preventDefault();
        newValue = min;
        break;
        
      case 'End':
        event.preventDefault();
        newValue = max;
        break;
        
      case 'Delete':
      case 'Backspace':
        if (allowClear) {
          event.preventDefault();
          newValue = 0;
        }
        break;
        
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (value > 0 && autoSubmitOnChange !== false && onSubmit) {
          onSubmit();
        }
        break;
        
      default:
        // Number keys 1-9
        if (/^[1-9]$/.test(event.key)) {
          const num = parseInt(event.key);
          if (num <= max && num >= min) {
            event.preventDefault();
            newValue = num;
          }
        }
        // Number key 0
        else if (event.key === '0' && allowClear) {
          event.preventDefault();
          newValue = 0;
        }
    }

    if (newValue !== null) {
      onChange(newValue);
      setIsTouched(true);
      
      // Auto-submit on keyboard selection if enabled
      if (autoSubmitOnChange !== false && onSubmit && newValue > 0) {
        onSubmit();
      }
    }
  }, [disabled, enableKeyboard, value, step, min, max, allowClear, onChange, autoSubmitOnChange, onSubmit]);

  const clear = useCallback(() => {
    onChange(0);
    setErrors([]);
    setIsTouched(false);
    setHoveredValue(null);
  }, [onChange]);

  const reset = useCallback(() => {
    onChange(0);
    setErrors([]);
    setIsTouched(false);
    setHoveredValue(null);
  }, [onChange]);

  const getItemProps = useCallback((itemValue: number) => ({
    id: id ? `${id}-item-${itemValue}` : undefined,
    role: 'radio',
    'aria-checked': value === itemValue,
    'aria-label': `${itemValue} out of ${max}`,
    tabIndex: -1,
    onClick: () => setRating(itemValue),
    onMouseEnter: () => !disabled && setHoveredValue(itemValue),
    onMouseLeave: () => !disabled && setHoveredValue(null),
  }), [id, value, max, disabled, setRating]);

  // Generate rating items
  const items = [];
  for (let i = step; i <= max; i += step) {
    const displayValue = hoveredValue !== null ? hoveredValue : value;
    items.push({
      value: i,
      props: getItemProps(i),
      isActive: i <= value,
      isHovered: hoveredValue !== null && i <= hoveredValue,
      isHalf: step < 1 && i % 1 !== 0,
    });
  }

  const containerProps: React.HTMLAttributes<HTMLElement> = {
    ref: containerRef,
    id: id ? `${id}-container` : undefined,
    tabIndex: disabled ? -1 : 0,
    onKeyDown: enableKeyboard ? handleKeyDown : undefined,
    onMouseLeave: () => setHoveredValue(null),
    'aria-label': ariaLabel || 'Rating',
    'aria-describedby': ariaDescribedBy,
    'aria-invalid': errors.length > 0,
    'aria-required': required,
    'aria-disabled': disabled,
    'aria-valuemin': min,
    'aria-valuemax': max,
    'aria-valuenow': value,
    'aria-valuetext': `${value} out of ${max}`,
    role: 'radiogroup',
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
    hoveredValue,
    setHoveredValue,
    items,
    setRating,
    getItemProps,
  };
}