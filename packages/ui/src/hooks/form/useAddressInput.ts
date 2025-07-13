import { useState, useCallback, useEffect } from "react";
import { UseInputReturn } from "../base/types";
import { UIAddressData } from "../types/generic";

interface UseAddressInputOptions {
  initialValue?: UIAddressData | null;
  required?: boolean;
  requiredFields?: (keyof UIAddressData)[];
}

export function useAddressInput(
  options: UseAddressInputOptions = {},
): UseInputReturn<UIAddressData | null> {
  const {
    initialValue = null,
    required = false,
    requiredFields = [
      "street1",
      "city",
      "stateProvince",
      "postalCode",
      "country",
    ],
  } = options;

  const [value, setValue] = useState<UIAddressData | null>(initialValue);
  const [errors, setErrors] = useState<string[]>([]);
  const [touched, setTouched] = useState(false);
  const [fieldTouched, setFieldTouched] = useState<Record<string, boolean>>({});

  const validate = useCallback((): boolean => {
    const newErrors: string[] = [];

    // Required validation
    if (required && !value) {
      newErrors.push("Address is required");
    }

    // Field-level validation
    if (value && required) {
      requiredFields.forEach((field) => {
        if (!value[field] || value[field].trim().length === 0) {
          const fieldName =
            field === "street1"
              ? "Street address"
              : field === "stateProvince"
                ? "State/Province"
                : field === "postalCode"
                  ? "Postal code"
                  : field.charAt(0).toUpperCase() + field.slice(1);
          newErrors.push(`${fieldName} is required`);
        }
      });

      // Postal code format validation (basic)
      if (value.postalCode && value.country === "US") {
        const usZipRegex = /^\d{5}(-\d{4})?$/;
        if (!usZipRegex.test(value.postalCode)) {
          newErrors.push("Invalid US ZIP code format");
        }
      }
    }

    setErrors(newErrors);
    return newErrors.length === 0;
  }, [value, required, requiredFields]);

  // Validate when touched
  useEffect(() => {
    if (touched) {
      validate();
    }
  }, [value, touched, validate]);

  const handleChange = useCallback(
    (newValue: UIAddressData | null) => {
      setValue(newValue);
      if (!touched) {
        setTouched(true);
      }
    },
    [touched],
  );

  const updateField = useCallback(
    (field: keyof UIAddressData, fieldValue: string) => {
      const updatedAddress = {
        ...(value || ({} as UIAddressData)),
        [field]: fieldValue,
      } as UIAddressData;

      handleChange(updatedAddress);

      if (!fieldTouched[field]) {
        setFieldTouched((prev) => ({ ...prev, [field]: true }));
      }
    },
    [value, handleChange, fieldTouched],
  );

  const clearErrors = useCallback(() => {
    setErrors([]);
  }, []);

  const isComplete = useCallback(() => {
    if (!value) return false;
    return requiredFields.every(
      (field) => value[field] && value[field].trim().length > 0,
    );
  }, [value, requiredFields]);

  const handlers = {
    updateField,
    isComplete,
    fieldTouched,
  };

  return {
    value,
    setValue: handleChange,
    errors,
    validate,
    isValid: errors.length === 0,
    clearErrors,
    handlers: handlers as Record<string, unknown>,
  };
}
