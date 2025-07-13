import { useState, useCallback, useEffect, useRef } from 'react';
import { FormMode } from '../../primitives/types';

interface UseSubmissionControlProps<T = unknown> {
  mode: FormMode;
  value: T;
  isValid: boolean;
  onSubmit: (value: T) => Promise<void> | void;
  autoSubmitOnChange?: boolean;
  debounceDelay?: number;
}

interface UseSubmissionControlReturn<T = any> {
  isSubmitting: boolean;
  error: Error | null;
  handleSubmit: () => Promise<void>;
  retry: () => Promise<void>;
}

export function useSubmissionControl<T = any>({
  mode,
  value,
  isValid,
  onSubmit,
  autoSubmitOnChange = false,
  debounceDelay,
}: UseSubmissionControlProps<T>): UseSubmissionControlReturn<T> {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [lastSubmittedValue, setLastSubmittedValue] = useState<T | null>(null);
  
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);
  const isSubmittingRef = useRef(false);

  // Mode-specific debounce delays
  const getDebounceDelay = useCallback(() => {
    if (debounceDelay !== undefined) return debounceDelay;
    
    switch (mode) {
      case 'typeform':
        return 300; // Faster for typeform
      case 'chat':
      default:
        return 500; // Standard delay for chat
    }
  }, [mode, debounceDelay]);

  // Submit handler
  const submitValue = useCallback(async (valueToSubmit: T) => {
    if (!isValid || !isMountedRef.current || isSubmittingRef.current) {
      return;
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setError(null);

    try {
      await onSubmit(valueToSubmit);
      setLastSubmittedValue(valueToSubmit);
    } catch (err) {
      if (isMountedRef.current) {
        setError(err instanceof Error ? err : new Error('Submission failed'));
      }
    } finally {
      if (isMountedRef.current) {
        setIsSubmitting(false);
        isSubmittingRef.current = false;
      }
    }
  }, [isValid, onSubmit]);

  // Manual submit handler
  const handleSubmit = useCallback(async () => {
    await submitValue(value);
  }, [submitValue, value]);

  // Retry handler
  const retry = useCallback(async () => {
    // Retry with current value if we have an error
    if (error !== null) {
      await submitValue(value);
    }
  }, [submitValue, value, error]);

  // Auto-submit effect
  useEffect(() => {
    if (!autoSubmitOnChange || !isValid) {
      return;
    }

    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set new timer
    debounceTimerRef.current = setTimeout(() => {
      if (isMountedRef.current) {
        submitValue(value);
      }
    }, getDebounceDelay());

    // Cleanup
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [value, autoSubmitOnChange, isValid, submitValue, getDebounceDelay]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return {
    isSubmitting,
    error,
    handleSubmit,
    retry,
  };
}