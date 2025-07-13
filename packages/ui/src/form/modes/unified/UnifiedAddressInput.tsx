import React from "react";
import { motion } from "motion/react";
import { UIAddressData } from "../../../types/generic";
import { BaseAddress } from "../../primitives";
import { cn } from "../../../lib/utils";
import { Button } from "../../../ui/button";
import { ArrowRight } from "lucide-react";

export type FormMode = "chat" | "typeform";

export interface UnifiedAddressInputProps {
  mode: FormMode;
  value?: UIAddressData | null;
  onChange: (value: UIAddressData) => void;
  onSubmit?: () => void;
  disabled?: boolean;
  required?: boolean;
  requiredFields?: (keyof UIAddressData)[];
  autoFocus?: boolean;
  className?: string;
}

// Grid layout configuration for fields
const fieldGridConfig: Record<keyof UIAddressData, string> = {
  street1: "col-span-2",
  street2: "col-span-2",
  city: "col-span-1",
  stateProvince: "col-span-1",
  postalCode: "col-span-1",
  country: "col-span-1",
};

export function UnifiedAddressInput(props: UnifiedAddressInputProps) {
  const {
    mode,
    value = null,
    onChange,
    onSubmit,
    disabled = false,
    required = false,
    requiredFields = [
      "street1",
      "city",
      "stateProvince",
      "postalCode",
      "country",
    ],
    autoFocus = true,
    className,
  } = props;

  // Use BaseAddress primitive for all field state management and validation
  const addressPrimitive = BaseAddress({
    value,
    onChange,
    disabled,
    required,
    requiredFields,
    autoFocus,
    // Never auto-submit - both modes handle submission manually
    autoSubmitOnComplete: false,
    onSubmit,
  });

  const { fieldProps, isComplete, errors, isTouched, validate } =
    addressPrimitive;

  // Field order for rendering
  const fieldOrder: (keyof UIAddressData)[] = [
    "street1",
    "street2",
    "city",
    "stateProvince",
    "postalCode",
    "country",
  ];

  const handleKeyDown = (
    e: React.KeyboardEvent,
    field: keyof UIAddressData,
  ) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();

      // Find current field index
      const currentIndex = fieldOrder.indexOf(field);

      // Try to focus next field
      if (currentIndex < fieldOrder.length - 1) {
        const nextField = fieldOrder[currentIndex + 1];
        if (nextField) {
          const nextInput = document.querySelector(
            `input[id="${fieldProps[nextField].id}"]`,
          ) as HTMLInputElement;
          if (nextInput) {
            nextInput.focus();
          }
        }
      } else if (isComplete && onSubmit && mode === "chat") {
        // Only submit on Enter in chat mode when complete
        onSubmit();
      }
      // TypeForm mode: Don't submit on Enter, let parent handle navigation
    }
  };

  // Mode-specific styling
  const containerClass =
    mode === "chat" ? "w-full space-y-6" : "w-full space-y-4";

  const inputClass =
    mode === "chat"
      ? cn(
          "w-full px-4 py-3 border-2 rounded-lg transition-all duration-200",
          "text-lg placeholder:text-muted-foreground/50",
          "focus:outline-none focus:border-primary focus:ring-0",
        )
      : cn(
          "w-full px-3 py-2 border rounded-lg transition-all duration-200",
          "text-base placeholder:text-muted-foreground/50",
          "focus:outline-none focus:border-primary focus:ring-0",
        );

  return (
    <div className={cn(containerClass, className)}>
      {/* Address Fields Grid */}
      <div className="grid grid-cols-2 gap-4">
        {fieldOrder.map((field, index) => {
          const fieldData = fieldProps[field];
          const { domProps, state } = fieldData;
          const hasError = state.touched && state.error;
          const fieldValue = domProps.value;

          return (
            <motion.div
              key={field}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={cn("space-y-2", fieldGridConfig[field])}
            >
              <label
                htmlFor={domProps.id}
                className="block text-sm font-medium text-foreground"
              >
                {domProps["aria-label"]}
                {state.required && <span className="text-red-500 ml-1">*</span>}
              </label>
              <input
                {...domProps}
                onKeyDown={(e) => {
                  domProps.onKeyDown(e);
                  handleKeyDown(e, field);
                }}
                className={cn(
                  inputClass,
                  hasError
                    ? "border-red-500 bg-red-50/50"
                    : fieldValue
                      ? "border-green-500 bg-green-50/30"
                      : mode === "chat"
                        ? "border-muted hover:border-muted-foreground/50"
                        : "border-border hover:border-border-hover",
                  domProps.disabled && "opacity-50 cursor-not-allowed",
                )}
              />
            </motion.div>
          );
        })}
      </div>

      {/* Error Messages */}
      {isTouched && required && !isComplete && errors.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-sm text-red-500 text-center"
        >
          Please complete all required address fields
        </motion.div>
      )}

      {/* Submit Button - ONLY for Chat Mode */}
      {mode === "chat" && onSubmit && isComplete && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex items-center mt-4"
        >
          <Button
            onClick={() => {
              // Validate on submit - only place validation should happen
              const validationErrors = validate();
              if (validationErrors.length === 0 && onSubmit) {
                onSubmit();
              }
            }}
            disabled={disabled}
            size="lg"
            className="group"
          >
            Continue
            <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Button>
        </motion.div>
      )}

      {/* TypeForm Mode: No continue button - let parent handle navigation */}
    </div>
  );
}
