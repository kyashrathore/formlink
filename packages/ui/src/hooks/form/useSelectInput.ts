import { useState, useCallback, useMemo, useEffect } from "react";
import { UseInputReturn } from "../../types/generic";
import { UIOption } from "../../types/generic";

interface UseSelectInputOptions {
  initialValue?: string | null;
  required?: boolean;
  options: UIOption[];
  multiple?: boolean;
}

type UseSelectReturn = UseInputReturn<string | null> & {
  validate: () => boolean;
  clearErrors: () => void;
  handlers: {
    onKeyPress: (key: string) => boolean;
    setSearchQuery: (q: string) => void;
    filteredOptions: UIOption[];
  };
  errors: string[];
};

export function useSelectInput(
  options: UseSelectInputOptions,
): UseSelectReturn {
  const {
    initialValue = null,
    required = false,
    options: selectOptions,
  } = options;

  const [value, setValue] = useState<string | null>(initialValue);
  const [errors, setErrors] = useState<string[]>([]);
  const [touched, setTouched] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Filter options based on search
  const filteredOptions = useMemo(() => {
    if (!searchQuery) return selectOptions;

    const query = searchQuery.toLowerCase();
    return selectOptions.filter(
      (option) =>
        option.label.toLowerCase().includes(query) ||
        option.value.toLowerCase().includes(query),
    );
  }, [selectOptions, searchQuery]);

  const validate = useCallback((): boolean => {
    const newErrors: string[] = [];

    // Required validation
    if (required && !value) {
      newErrors.push("Please select an option");
    }

    // Check if selected value is valid
    if (value && !selectOptions.find((opt) => opt.value === value)) {
      newErrors.push("Invalid selection");
    }

    setErrors(newErrors);
    return newErrors.length === 0;
  }, [value, required]); // Removed selectOptions to prevent infinite loop

  // Validate on value change if touched
  useEffect(() => {
    if (touched) {
      const newErrors: string[] = [];

      // Required validation
      if (required && !value) {
        newErrors.push("Please select an option");
      }

      // Check if selected value is valid
      if (value && !selectOptions.find((opt) => opt.value === value)) {
        newErrors.push("Invalid selection");
      }

      setErrors(newErrors);
    }
  }, [value, touched, required]); // Removed selectOptions to prevent infinite loop

  const handleChange = useCallback((newValue: string | null) => {
    setValue(newValue);
    if (!touched) {
      setTouched(true);
    }
  }, []); // Removed touched dependency to prevent infinite loop

  const clearErrors = useCallback(() => {
    setErrors([]);
  }, []);

  // Keyboard navigation helpers
  const handleKeyboard = useCallback(
    (key: string) => {
      // Handle letter/number shortcuts
      if (key.length === 1) {
        const upperKey = key.toUpperCase();
        const index = upperKey.charCodeAt(0) - 65; // A=0, B=1, etc

        if (index >= 0 && index < selectOptions.length) {
          const option = selectOptions[index];
          if (option) {
            handleChange(option.value);
            return true;
          }
        }

        // Try number shortcuts
        const num = parseInt(key);
        if (!isNaN(num) && num > 0 && num <= selectOptions.length) {
          const option = selectOptions[num - 1];
          if (option) {
            handleChange(option.value);
            return true;
          }
        }
      }
      return false;
    },
    [handleChange],
  ); // Removed selectOptions to prevent infinite loop

  const handlers = {
    onKeyPress: handleKeyboard,
    setSearchQuery,
  };

  return {
    value,
    setValue: handleChange,
    error: errors.length > 0 ? errors[0] : undefined,
    isDirty: value !== initialValue,
    isValid: errors.length === 0,
    reset: () => setValue(initialValue || null),
    validate,
    clearErrors,
    handlers: {
      ...handlers,
      filteredOptions,
    },
    errors,
  };
}
