"use client";

import { useAddress } from "@/headless/react/hooks/useAddress";
import { ArrowRight } from "lucide-react";
import { motion } from "motion/react";
import * as React from "react";
import type { AddressData } from "../../schema";
import { useUiComponents } from "./primitives/context";

export type FormMode = "chat" | "typeform";

export interface UnifiedAddressInputProps {
  mode: FormMode;
  value?: AddressData | null;
  onChange: (value: AddressData | null) => void;
  onSubmit?: () => void;
  disabled?: boolean;
  required?: boolean;
  requiredFields?: (keyof AddressData)[];
  autoFocus?: boolean;
  className?: string;
  density?: "compact" | "comfy" | "spacious";
}

type Density = NonNullable<UnifiedAddressInputProps["density"]>;

const FIELD_ORDER: (keyof AddressData)[] = [
  "street1",
  "street2",
  "city",
  "stateProvince",
  "postalCode",
  "country",
];

const FIELD_CONFIG: Record<
  keyof AddressData,
  { label: string; placeholder: string; autoComplete: string }
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

type ButtonProps = React.ComponentPropsWithRef<"button"> & {
  variant?: string;
};

const CONTINUE_LABEL = "Continue";

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

function getContainerSpacing(mode: FormMode, density: Density | undefined) {
  const resolved =
    density ??
    (mode === "chat" ? ("compact" as Density) : ("comfy" as Density));
  if (mode === "chat") {
    switch (resolved) {
      case "compact":
        return "w-full space-y-4";
      case "comfy":
        return "w-full space-y-6";
      case "spacious":
        return "w-full space-y-8";
    }
  }
  switch (resolved) {
    case "compact":
      return "w-full space-y-3";
    case "comfy":
      return "w-full space-y-4";
    case "spacious":
      return "w-full space-y-6";
    default:
      return "w-full space-y-4";
  }
}

function getInputClasses(mode: FormMode, density: Density | undefined) {
  const resolved =
    density ??
    (mode === "chat" ? ("compact" as Density) : ("comfy" as Density));
  const shared =
    "w-full transition-all duration-200 focus:outline-none placeholder:text-muted-foreground/50";
  if (mode === "chat") {
    switch (resolved) {
      case "compact":
        return cx(shared, "px-3 py-2 text-base border-2 rounded-lg");
      case "comfy":
        return cx(shared, "px-4 py-3 text-lg border-2 rounded-lg");
      case "spacious":
        return cx(shared, "px-5 py-3 text-lg border-2 rounded-lg");
    }
  }
  switch (resolved) {
    case "compact":
      return cx(shared, "px-2.5 py-1.5 text-sm border rounded-lg");
    case "comfy":
      return cx(shared, "px-3 py-2 text-base border rounded-lg");
    case "spacious":
      return cx(shared, "px-4 py-3 text-base border rounded-lg");
    default:
      return cx(shared, "px-3 py-2 text-base border rounded-lg");
  }
}

export function UnifiedAddressInput({
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
  density,
}: UnifiedAddressInputProps) {
  const [submitted, setSubmitted] = React.useState(false);
  const fieldRefs = React.useRef<
    Partial<Record<keyof AddressData, HTMLInputElement | null>>
  >({});

  React.useEffect(() => {
    if (!autoFocus) return;
    const firstField = FIELD_ORDER[0];
    if (!firstField) return;
    const node = fieldRefs.current[firstField];
    if (node) {
      try {
        node.focus();
      } catch {
        /* ignore focus failures */
      }
    }
  }, [autoFocus]);

  const address = useAddress({
    value,
    onChange,
    onSubmit,
    required,
    requiredFields,
  });

  const resolvedContainerClass = getContainerSpacing(mode, density);
  const inputClass = getInputClasses(mode, density);

  const allRequiredFilled = address.allRequiredFilled;
  const showError =
    required && (!allRequiredFilled || submitted) && address.showAnyError;

  const primitives = useUiComponents();
  const ButtonComponent =
    (primitives.Button as React.ComponentType<ButtonProps>) ??
    ((props: ButtonProps) => <button type="button" {...props} />);

  const handleFieldChange = (field: keyof AddressData, nextValue: string) => {
    address.setField(field, nextValue);
  };

  // Note: We intentionally do not re-emit on external value → localAddress sync
  // to prevent infinite loops. Emissions happen in handleFieldChange only.

  const focusNext = (currentField: keyof AddressData) => {
    const currentIndex = FIELD_ORDER.indexOf(currentField);
    if (currentIndex === -1) return;
    const nextField = FIELD_ORDER[currentIndex + 1];
    if (!nextField) return;
    const node = fieldRefs.current[nextField];
    if (node) {
      try {
        node.focus();
      } catch {
        /* ignore */
      }
    }
  };

  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>,
    field: keyof AddressData,
  ) => {
    const isLast = FIELD_ORDER.indexOf(field) === FIELD_ORDER.length - 1;
    const next = () => focusNext(field);
    address.onFieldKeyDown(field, isLast, next)(event);
    if (event.key === "Enter" && !event.shiftKey) setSubmitted(true);
  };

  return (
    <div
      className={cx(resolvedContainerClass, className)}
      data-unified-address-mode={mode}
      data-unified-address-density={density ?? "default"}
    >
      <div className="grid grid-cols-2 gap-4">
        {FIELD_ORDER.map((field, index) => {
          const config = FIELD_CONFIG[field];
          const fieldValue = address.getValue(field);
          const isRequired = address.requiredSet.has(field);
          const isTouched = true; // address hook tracks errors by overall showAnyError; keep per-field simple
          const hasError =
            required &&
            isRequired &&
            isTouched &&
            fieldValue.trim().length === 0;

          return (
            <motion.div
              key={field}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className={cx(
                "space-y-2",
                field === "street1" || field === "street2"
                  ? "col-span-2"
                  : "col-span-1",
              )}
            >
              <label
                htmlFor={`unified-address-${field}`}
                className="block text-sm font-medium text-foreground"
              >
                {config.label}
                {isRequired && <span className="ml-1 text-destructive">*</span>}
              </label>
              <input
                ref={(node) => {
                  fieldRefs.current[field] = node;
                }}
                id={`unified-address-${field}`}
                name={`unified-address-${field}`}
                type="text"
                autoComplete={config.autoComplete}
                disabled={disabled}
                aria-required={isRequired}
                aria-invalid={hasError}
                aria-label={config.label}
                placeholder={config.placeholder}
                value={fieldValue}
                onChange={(event) =>
                  handleFieldChange(field, event.target.value)
                }
                onBlur={() => {
                  /* touched handled in hook via setField on change */
                }}
                onKeyDown={(event) => handleKeyDown(event, field)}
                className={cx(
                  inputClass,
                  mode === "chat"
                    ? "border-muted hover:border-muted-foreground/50 focus:border-primary"
                    : "border-border hover:border-border/80 focus:border-primary",
                  hasError && "border-destructive bg-destructive/10",
                  disabled && "opacity-50 cursor-not-allowed",
                )}
              />
            </motion.div>
          );
        })}
      </div>

      {showError && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-sm text-destructive text-center"
        >
          Please complete all required address fields
        </motion.div>
      )}

      {mode === "chat" && onSubmit && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex items-center pt-2"
        >
          <ButtonComponent
            type="button"
            onClick={() => {
              setSubmitted(true);
              if (!required || allRequiredFilled) {
                onSubmit();
              }
            }}
            disabled={disabled}
            className="group flex items-center gap-2"
            variant="default"
          >
            {CONTINUE_LABEL}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </ButtonComponent>
        </motion.div>
      )}
    </div>
  );
}
