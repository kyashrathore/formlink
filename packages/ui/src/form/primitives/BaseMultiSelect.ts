import { useState, useCallback, useEffect, useRef } from 'react';
import { BasePrimitiveProps, BasePrimitiveReturn, ValidationError, Option } from './types';

export interface BaseMultiSelectProps<T = string> extends BasePrimitiveProps<T[]> {
  /**
   * Available options
   */
  options: Option<T>[];
  
  /**
   * Placeholder text when no options are selected
   */
  placeholder?: string;
  
  /**
   * Maximum number of selections allowed
   */
  maxSelections?: number;
  
  /**
   * Minimum number of selections required
   */
  minSelections?: number;
  
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
   * Callback on submit
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
}

export interface BaseMultiSelectReturn<T = string> extends BasePrimitiveReturn<T[]> {
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
  options: Array<Option<T> & {
    props: React.HTMLAttributes<HTMLElement>;
    isSelected: boolean;
    isHighlighted: boolean;
  }>;
  
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
   * Toggle an option by value
   */
  toggleOption: (value: T) => void;
  
  /**
   * Select an option by value
   */
  selectOption: (value: T) => void;
  
  /**
   * Deselect an option by value
   */
  deselectOption: (value: T) => void;
  
  /**
   * Toggle an option by index
   */
  toggleByIndex: (index: number) => void;
  
  /**
   * Select all options
   */
  selectAll: () => void;
  
  /**
   * Deselect all options
   */
  deselectAll: () => void;
  
  /**
   * Get container props with keyboard handling
   */
  getContainerProps: () => React.HTMLAttributes<HTMLElement>;
  
  /**
   * Get option props for a specific index
   */
  getOptionProps: (index: number) => React.HTMLAttributes<HTMLElement>;
}

export function BaseMultiSelect<T = string>(props: BaseMultiSelectProps<T>): BaseMultiSelectReturn<T> {
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
  } = props;

  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [isTouched, setIsTouched] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const containerRef = useRef<HTMLElement>(null);

  // Use controlled or internal state for open
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;
  const setIsOpen = useCallback((open: boolean) => {
    if (controlledIsOpen === undefined) {
      setInternalIsOpen(open);
    }
    onOpenChange?.(open);
  }, [controlledIsOpen, onOpenChange]);

  // Validate the selection
  const validate = useCallback(() => {
    const validationErrors: ValidationError[] = [];
    
    // Safe array access with fallback
    const safeValue = value || [];

    // Required validation
    if (required && safeValue.length === 0) {
      validationErrors.push({
        type: 'required',
        message: 'Please select at least one option',
      });
    }

    // Min selections validation
    if (minSelections && safeValue.length < minSelections) {
      validationErrors.push({
        type: 'minSelections',
        message: `Please select at least ${minSelections} option${minSelections > 1 ? 's' : ''}`,
      });
    }

    // Max selections validation
    if (maxSelections && safeValue.length > maxSelections) {
      validationErrors.push({
        type: 'maxSelections',
        message: `Please select no more than ${maxSelections} option${maxSelections > 1 ? 's' : ''}`,
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
  }, [value, required, minSelections, maxSelections, onValidate, onValidationChange]);

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

  const toggleOption = useCallback((optionValue: T) => {
    if (disabled) return;

    // Safe array access with fallback
    const safeValue = value || [];
    const isSelected = safeValue.includes(optionValue);
    
    if (isSelected) {
      // Deselect
      onChange(safeValue.filter(v => v !== optionValue));
    } else {
      // Select (check max selections)
      if (!maxSelections || safeValue.length < maxSelections) {
        onChange([...safeValue, optionValue]);
      }
    }
    
    setIsTouched(true);
  }, [disabled, value, onChange, maxSelections]);

  const selectOption = useCallback((optionValue: T) => {
    // Safe array access with fallback
    const safeValue = value || [];
    if (disabled || safeValue.includes(optionValue)) return;
    
    if (!maxSelections || safeValue.length < maxSelections) {
      onChange([...safeValue, optionValue]);
      setIsTouched(true);
    }
  }, [disabled, value, onChange, maxSelections]);

  const deselectOption = useCallback((optionValue: T) => {
    // Safe array access with fallback
    const safeValue = value || [];
    if (disabled || !safeValue.includes(optionValue)) return;
    
    onChange(safeValue.filter(v => v !== optionValue));
    setIsTouched(true);
  }, [disabled, value, onChange]);

  const toggleByIndex = useCallback((index: number) => {
    // Safe array access with fallback
    const safeOptions = options || [];
    if (index >= 0 && index < safeOptions.length) {
      const option = safeOptions[index];
      if (!option?.disabled) {
        toggleOption(option?.value || '' as T);
      }
    }
  }, [options, toggleOption]);

  const selectAll = useCallback(() => {
    if (disabled) return;
    
    // Safe array access with fallback
    const safeOptions = options || [];
    const selectableOptions = safeOptions.filter(opt => !opt.disabled);
    const allValues = selectableOptions.map(opt => opt.value);
    
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

  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (disabled) return;

    // Handle dropdown navigation when open
    if (isOpen) {
      // Safe array access with fallback
      const safeOptions = options || [];
      
      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          setHighlightedIndex(prev => {
            const next = prev + 1;
            return next >= safeOptions.length ? 0 : next;
          });
          break;
          
        case 'ArrowUp':
          event.preventDefault();
          setHighlightedIndex(prev => {
            const next = prev - 1;
            return next < 0 ? safeOptions.length - 1 : next;
          });
          break;
          
        case 'Enter':
          event.preventDefault();
          if (highlightedIndex >= 0) {
            toggleByIndex(highlightedIndex);
          }
          break;
          
        case ' ':
          event.preventDefault();
          if (highlightedIndex >= 0) {
            toggleByIndex(highlightedIndex);
          }
          break;
          
        case 'Escape':
          event.preventDefault();
          close();
          break;
      }
    } else {
      // Handle shortcuts when closed
      // Safe array access with fallback
      const safeValue = value || [];
      const safeOptions = options || [];
      
      if (event.key === 'Enter') {
        event.preventDefault();
        // Don't auto-submit in AI mode - let components handle submission
        open();
      } else if (event.key === ' ') {
        event.preventDefault();
        open();
      } else if (enableArrowNavigation && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
        event.preventDefault();
        open();
      } else if (enableShortcuts) {
        // Letter shortcuts
        if (/^[a-zA-Z]$/.test(event.key)) {
          const letter = event.key.toLowerCase();
          const optionIndex = safeOptions.findIndex(opt => 
            opt.label.toLowerCase().startsWith(letter) && !opt.disabled
          );
          if (optionIndex >= 0) {
            event.preventDefault();
            toggleByIndex(optionIndex);
          }
        }
        // Number shortcuts
        else if (/^[1-9]$/.test(event.key)) {
          const index = parseInt(event.key) - 1;
          if (index < safeOptions.length) {
            event.preventDefault();
            toggleByIndex(index);
          }
        }
      }
    }
  }, [disabled, isOpen, highlightedIndex, options, value, enableShortcuts, enableArrowNavigation, open, close, toggleByIndex, onSubmit]);

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

  const getContainerProps = useCallback(() => ({
    ref: containerRef,
    id: id ? `${id}-container` : undefined,
    tabIndex: disabled ? -1 : 0,
    onKeyDown: handleKeyDown,
    'aria-label': ariaLabel,
    'aria-describedby': ariaDescribedBy,
    'aria-invalid': errors.length > 0,
    'aria-required': required,
    'aria-disabled': disabled,
    'aria-expanded': isOpen,
    'aria-haspopup': 'listbox' as const,
    'aria-multiselectable': true,
    role: 'combobox',
  }), [id, disabled, handleKeyDown, ariaLabel, ariaDescribedBy, errors, required, isOpen]);

  const getOptionProps = useCallback((index: number) => {
    // Safe array access with fallback
    const safeValue = value || [];
    const safeOptions = options || [];
    
    return {
      id: id ? `${id}-option-${index}` : undefined,
      role: 'option',
      'aria-selected': safeOptions[index] ? safeValue.includes(safeOptions[index].value) : false,
      'aria-disabled': safeOptions[index]?.disabled,
      tabIndex: -1,
      onClick: () => toggleByIndex(index),
      onMouseEnter: () => setHighlightedIndex(index),
    };
  }, [id, options, value, toggleByIndex]);

  // Process options with additional props
  // Safe array access with fallback
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