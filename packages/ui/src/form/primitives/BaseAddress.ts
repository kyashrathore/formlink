import { useState, useCallback, useEffect, useRef } from "react";
import {
  BasePrimitiveProps,
  BasePrimitiveReturn,
  ValidationError,
} from "./types";

// Address data structure that matches the schema
export interface AddressData {
  street1?: string;
  street2?: string;
  city?: string;
  stateProvince?: string;
  postalCode?: string;
  country?: string;
}

export interface BaseAddressProps
  extends BasePrimitiveProps<AddressData | null> {
  /**
   * Required fields for the address
   */
  requiredFields?: (keyof AddressData)[];

  /**
   * Callback on field blur
   */
  onFieldBlur?: (field: keyof AddressData) => void;

  /**
   * Callback on field focus
   */
  onFieldFocus?: (field: keyof AddressData) => void;

  /**
   * Callback on submit
   */
  onSubmit?: () => void;

  /**
   * Auto-submit when address is complete
   */
  autoSubmitOnComplete?: boolean;

  /**
   * Country-specific address format configurations
   */
  addressFormat?: AddressFormat;

  /**
   * Enable autocomplete
   */
  enableAutocomplete?: boolean;
}

export interface AddressFormat {
  /**
   * Order of fields for display
   */
  fieldOrder?: (keyof AddressData)[];

  /**
   * Field labels by country
   */
  fieldLabels?: Partial<Record<keyof AddressData, string>>;

  /**
   * Field placeholders
   */
  fieldPlaceholders?: Partial<Record<keyof AddressData, string>>;

  /**
   * Postal code pattern for validation
   */
  postalCodePattern?: string;

  /**
   * State/Province list for validation
   */
  stateProvinceOptions?: Array<{ value: string; label: string }>;
}

export interface AddressFieldState {
  error?: string;
  touched: boolean;
  required: boolean;
}

export interface AddressFieldDOMProps {
  value: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur: () => void;
  onFocus: () => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  placeholder?: string;
  disabled: boolean;
  id: string;
  name: string;
  autoComplete: string;
  "aria-label": string;
  "aria-invalid": boolean;
  "aria-required": boolean;
  "aria-disabled": boolean;
  "aria-describedby"?: string;
}

export interface AddressFieldProps {
  domProps: AddressFieldDOMProps;
  state: AddressFieldState;
}

export interface BaseAddressReturn
  extends BasePrimitiveReturn<AddressData | null> {
  /**
   * Props for individual address fields
   */
  fieldProps: Record<keyof AddressData, AddressFieldProps>;

  /**
   * Whether all required fields are filled
   */
  isComplete: boolean;

  /**
   * Set touched state for a specific field
   */
  setFieldTouched: (field: keyof AddressData, touched: boolean) => void;

  /**
   * Get validation errors for a specific field
   */
  getFieldErrors: (field: keyof AddressData) => ValidationError[];

  /**
   * Validate a specific field
   */
  validateField: (field: keyof AddressData) => ValidationError[];

  /**
   * Check if a specific field is required
   */
  isFieldRequired: (field: keyof AddressData) => boolean;

  /**
   * Field-specific touched states
   */
  fieldTouchedStates: Record<keyof AddressData, boolean>;
}

// Default field configurations
const defaultFieldConfig: Record<
  keyof AddressData,
  {
    label: string;
    placeholder: string;
    autoComplete: string;
  }
> = {
  street1: {
    label: "Street Address",
    placeholder: "123 Main Street",
    autoComplete: "address-line1",
  },
  street2: {
    label: "Apartment/Suite (Optional)",
    placeholder: "Apt 4B",
    autoComplete: "address-line2",
  },
  city: {
    label: "City",
    placeholder: "New York",
    autoComplete: "address-level2",
  },
  stateProvince: {
    label: "State/Province",
    placeholder: "NY",
    autoComplete: "address-level1",
  },
  postalCode: {
    label: "Postal Code",
    placeholder: "10001",
    autoComplete: "postal-code",
  },
  country: {
    label: "Country",
    placeholder: "United States",
    autoComplete: "country-name",
  },
};

export function BaseAddress(props: BaseAddressProps): BaseAddressReturn {
  const {
    value,
    onChange,
    disabled = false,
    onValidate,
    onValidationChange,
    autoFocus = false,
    id,
    name,
    ariaLabel: _ariaLabel,
    ariaDescribedBy,
    requiredFields = [
      "street1",
      "city",
      "stateProvince",
      "postalCode",
      "country",
    ],
    onFieldBlur,
    onFieldFocus,
    onSubmit,
    autoSubmitOnComplete = false,
    addressFormat,
    enableAutocomplete = true,
  } = props;

  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [fieldErrors, setFieldErrors] = useState<
    Record<keyof AddressData, ValidationError[]>
  >({
    street1: [],
    street2: [],
    city: [],
    stateProvince: [],
    postalCode: [],
    country: [],
  });
  const [isTouched, setIsTouched] = useState(false);
  const [fieldTouchedStates, setFieldTouchedStates] = useState<
    Record<keyof AddressData, boolean>
  >({
    street1: false,
    street2: false,
    city: false,
    stateProvince: false,
    postalCode: false,
    country: false,
  });

  const fieldRefs = useRef<Record<keyof AddressData, HTMLInputElement | null>>({
    street1: null,
    street2: null,
    city: null,
    stateProvince: null,
    postalCode: null,
    country: null,
  });

  // Check if address is complete
  const isComplete = useCallback(() => {
    if (!value) return false;
    return requiredFields.every((field) => {
      const fieldValue = value[field];
      return (
        fieldValue &&
        typeof fieldValue === "string" &&
        fieldValue.trim().length > 0
      );
    });
  }, [value, requiredFields]);

  // Validate individual field
  const validateField = useCallback(
    (field: keyof AddressData): ValidationError[] => {
      const fieldValue = value?.[field] || "";
      const fieldValidationErrors: ValidationError[] = [];
      const isFieldRequired = requiredFields.includes(field);

      // Required validation
      if (
        isFieldRequired &&
        (!fieldValue || (typeof fieldValue === "string" && !fieldValue.trim()))
      ) {
        fieldValidationErrors.push({
          type: "required",
          message: `${addressFormat?.fieldLabels?.[field] || defaultFieldConfig[field].label} is required`,
        });
      }

      // Postal code pattern validation
      if (
        field === "postalCode" &&
        fieldValue &&
        addressFormat?.postalCodePattern
      ) {
        const pattern = new RegExp(addressFormat.postalCodePattern);
        if (!pattern.test(fieldValue)) {
          fieldValidationErrors.push({
            type: "pattern",
            message: "Invalid postal code format",
          });
        }
      }

      // State/Province validation against options
      if (
        field === "stateProvince" &&
        fieldValue &&
        addressFormat?.stateProvinceOptions
      ) {
        const isValidState = addressFormat.stateProvinceOptions.some(
          (option) => option.value === fieldValue,
        );
        if (!isValidState) {
          fieldValidationErrors.push({
            type: "invalid",
            message: "Invalid state/province",
          });
        }
      }

      return fieldValidationErrors;
    },
    [value, requiredFields, addressFormat],
  );

  // Validate entire address
  const validate = useCallback(() => {
    const validationErrors: ValidationError[] = [];
    const newFieldErrors: Record<keyof AddressData, ValidationError[]> = {
      street1: [],
      street2: [],
      city: [],
      stateProvince: [],
      postalCode: [],
      country: [],
    };

    // Validate each field
    (Object.keys(defaultFieldConfig) as Array<keyof AddressData>).forEach(
      (field) => {
        const fieldValidationErrors = validateField(field);
        newFieldErrors[field] = fieldValidationErrors;
        validationErrors.push(...fieldValidationErrors);
      },
    );

    // Custom validation
    if (onValidate) {
      const customErrors = onValidate(value);
      validationErrors.push(...customErrors);
    }

    setFieldErrors(newFieldErrors);
    setErrors(validationErrors);
    onValidationChange?.(validationErrors);

    return validationErrors;
  }, [value, validateField, onValidate, onValidationChange]);

  // Auto-focus on mount
  useEffect(() => {
    if (autoFocus && fieldRefs.current.street1) {
      fieldRefs.current.street1.focus();
    }
  }, [autoFocus]);

  // Don't validate automatically - only validate on blur or explicit calls
  // This prevents infinite loops when the parent re-renders after submission

  // Auto-submit when complete - NO VALIDATION HERE
  useEffect(() => {
    if (autoSubmitOnComplete && isComplete() && onSubmit) {
      // Don't validate here - let the submit handler validate
      onSubmit();
    }
  }, [value, autoSubmitOnComplete, isComplete, onSubmit]);

  const handleFieldChange = useCallback(
    (field: keyof AddressData, fieldValue: string) => {
      const newValue: AddressData = {
        ...value,
        [field]: fieldValue,
      };
      onChange(newValue);
    },
    [value, onChange],
  );

  const handleFieldBlur = useCallback(
    (field: keyof AddressData) => {
      setFieldTouchedStates((prev) => ({ ...prev, [field]: true }));
      setIsTouched(true);
      onFieldBlur?.(field);
    },
    [onFieldBlur],
  );

  const handleFieldFocus = useCallback(
    (field: keyof AddressData) => {
      onFieldFocus?.(field);
    },
    [onFieldFocus],
  );

  const handleFieldKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter" && onSubmit) {
        event.preventDefault();
        if (isComplete()) {
          onSubmit();
        }
      }
    },
    [isComplete, onSubmit],
  );

  const clear = useCallback(() => {
    onChange(null);
    setErrors([]);
    setFieldErrors({
      street1: [],
      street2: [],
      city: [],
      stateProvince: [],
      postalCode: [],
      country: [],
    });
    setIsTouched(false);
    setFieldTouchedStates({
      street1: false,
      street2: false,
      city: false,
      stateProvince: false,
      postalCode: false,
      country: false,
    });
  }, [onChange]);

  const reset = useCallback(() => {
    clear();
  }, [clear]);

  const setFieldTouched = useCallback(
    (field: keyof AddressData, touched: boolean) => {
      setFieldTouchedStates((prev) => ({ ...prev, [field]: touched }));
      if (touched) {
        setIsTouched(true);
      }
    },
    [],
  );

  const getFieldErrors = useCallback(
    (field: keyof AddressData): ValidationError[] => {
      return fieldErrors[field] || [];
    },
    [fieldErrors],
  );

  const isFieldRequired = useCallback(
    (field: keyof AddressData): boolean => {
      return requiredFields.includes(field);
    },
    [requiredFields],
  );

  // Generate field props for each address field
  const fieldProps: Record<keyof AddressData, AddressFieldProps> = {} as any;

  (Object.keys(defaultFieldConfig) as Array<keyof AddressData>).forEach(
    (field) => {
      const fieldConfig = {
        ...defaultFieldConfig[field],
        ...(addressFormat?.fieldLabels && {
          label:
            addressFormat.fieldLabels[field] || defaultFieldConfig[field].label,
        }),
        ...(addressFormat?.fieldPlaceholders && {
          placeholder:
            addressFormat.fieldPlaceholders[field] ||
            defaultFieldConfig[field].placeholder,
        }),
      };

      fieldProps[field] = {
        domProps: {
          value:
            (typeof value?.[field] === "string"
              ? value[field]
              : value?.[field]?.toString?.() || "") || "",
          onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
            handleFieldChange(field, event.target.value),
          onBlur: () => handleFieldBlur(field),
          onFocus: () => handleFieldFocus(field),
          onKeyDown: handleFieldKeyDown,
          placeholder: fieldConfig.placeholder,
          disabled,
          id: id ? `${id}-${field}` : field,
          name: name ? `${name}.${field}` : field,
          autoComplete: enableAutocomplete ? fieldConfig.autoComplete : "off",
          "aria-label": fieldConfig.label,
          "aria-invalid": fieldErrors[field].length > 0,
          "aria-required": isFieldRequired(field),
          "aria-disabled": disabled,
          "aria-describedby": ariaDescribedBy
            ? `${ariaDescribedBy}-${field}`
            : undefined,
        },
        state: {
          error: fieldErrors[field]?.[0]?.message,
          touched: fieldTouchedStates[field],
          required: isFieldRequired(field),
        },
      };
    },
  );

  const containerProps: React.HTMLAttributes<HTMLElement> = {
    id: id ? `${id}-container` : undefined,
  };

  return {
    value,
    errors,
    containerProps,
    fieldProps,
    isValid: errors.length === 0,
    isTouched,
    setTouched: setIsTouched,
    validate,
    clear,
    reset,
    isComplete: isComplete(),
    setFieldTouched,
    getFieldErrors,
    validateField,
    isFieldRequired,
    fieldTouchedStates,
  };
}
