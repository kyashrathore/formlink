import { useState, useCallback, useRef, useEffect, useMemo } from 'react';

export interface ValidationRules<T = unknown> {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  patternMessage?: string;
  custom?: (value: T) => string | null;
}

export interface UseFormValueProps<T> {
  value: T;
  onChange: (value: T) => void;
  validation?: ValidationRules<T>;
  validateOnChange?: boolean;
  showErrorsOnlyWhenTouched?: boolean;
}

export interface UseFormValueReturn<T> {
  value: T;
  setValue: (value: T) => void;
  errors: string[];
  setErrors: (errors: string[]) => void;
  clearErrors: () => void;
  isValid: boolean;
  isTouched: boolean;
  setTouched: (touched: boolean) => void;
  isPristine: boolean;
  validate: () => boolean;
  reset: (newValue?: T) => void;
}

export function useFormValue<T = any>({
  value: externalValue,
  onChange,
  validation,
  validateOnChange = false,
  showErrorsOnlyWhenTouched = false,
}: UseFormValueProps<T>): UseFormValueReturn<T> {
  // Track the initial value for pristine state and reset
  const initialValueRef = useRef<T>(externalValue);
  const [internalErrors, setInternalErrors] = useState<string[]>([]);
  const [isTouched, setIsTouchedState] = useState(false);
  
  // Update initial value on first render
  useEffect(() => {
    initialValueRef.current = externalValue;
  }, []);
  
  // Calculate if value is pristine
  const isPristine = JSON.stringify(externalValue) === JSON.stringify(initialValueRef.current);
  
  // Memoize validation rules to prevent infinite loops
  const memoizedValidation = useMemo(() => validation, [
    validation?.required,
    validation?.minLength,
    validation?.maxLength,
    validation?.pattern,
    validation?.patternMessage,
    validation?.custom
  ]);
  
  // Validate function that doesn't cause re-renders
  const validateValue = useCallback((value: T): string[] => {
    const errors: string[] = [];
    
    if (memoizedValidation) {
      // Required validation
      if (memoizedValidation.required) {
        const isEmpty = 
          value === null || 
          value === undefined || 
          value === '' ||
          (Array.isArray(value) && value.length === 0) ||
          (typeof value === 'object' && !Array.isArray(value) && Object.keys(value as any).length === 0);
          
        if (isEmpty) {
          errors.push('This field is required');
        }
      }
      
      // String-specific validations
      if (typeof value === 'string') {
        // MinLength validation
        if (memoizedValidation.minLength && value.length < memoizedValidation.minLength) {
          errors.push(`Minimum length is ${memoizedValidation.minLength} characters`);
        }
        
        // MaxLength validation
        if (memoizedValidation.maxLength && value.length > memoizedValidation.maxLength) {
          errors.push(`Maximum length is ${memoizedValidation.maxLength} characters`);
        }
        
        // Pattern validation
        if (memoizedValidation.pattern && !memoizedValidation.pattern.test(value)) {
          errors.push(memoizedValidation.patternMessage || 'Invalid format');
        }
      }
      
      // Custom validation
      if (memoizedValidation.custom) {
        const customError = memoizedValidation.custom(value);
        if (customError) {
          errors.push(customError);
        }
      }
    }
    
    return errors;
  }, [memoizedValidation]);
  
  // Validate and update errors
  const validate = useCallback((): boolean => {
    const errors = validateValue(externalValue);
    setInternalErrors(errors);
    return errors.length === 0;
  }, [externalValue, validateValue]);
  
  // Set value and mark as touched
  const setValue = useCallback((newValue: T) => {
    onChange(newValue);
    setIsTouchedState(true);
  }, [onChange]);
  
  // Set touched state
  const setTouched = useCallback((touched: boolean) => {
    setIsTouchedState(touched);
  }, []);
  
  // Validate on value change if enabled and touched
  useEffect(() => {
    if (validateOnChange && isTouched) {
      const errors = validateValue(externalValue);
      setInternalErrors(errors);
    }
  }, [externalValue, validateOnChange, isTouched, validateValue]);
  
  // Set errors manually
  const setErrors = useCallback((errors: string[]) => {
    setInternalErrors(errors);
  }, []);
  
  // Clear errors
  const clearErrors = useCallback(() => {
    setInternalErrors([]);
  }, []);
  
  // Reset to initial value
  const reset = useCallback((newInitialValue?: T) => {
    const resetValue = newInitialValue !== undefined ? newInitialValue : initialValueRef.current;
    
    // Update initial value ref if new value provided
    if (newInitialValue !== undefined) {
      initialValueRef.current = newInitialValue;
    }
    
    onChange(resetValue);
    setIsTouchedState(false);
    setInternalErrors([]);
  }, [onChange]);
  
  // Determine which errors to show
  const errors = showErrorsOnlyWhenTouched && !isTouched ? [] : internalErrors;
  const isValid = errors.length === 0;
  
  return {
    value: externalValue,
    setValue,
    errors,
    setErrors,
    clearErrors,
    isValid,
    isTouched,
    setTouched,
    isPristine,
    validate,
    reset,
  };
}