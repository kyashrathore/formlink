"use client";

import * as React from "react";
import type { AddressData } from "../../schema";
// no @formlink/ui dependency; implement minimal logic locally

export interface AddressInputProps {
  value?: AddressData | null;
  onChange: (value: AddressData) => void;
  onCompleteChange?: (value: AddressData | null) => void;
  onSubmit?: () => void;
  disabled?: boolean;
  required?: boolean;
  requiredFields?: (keyof AddressData)[];
  autoFocus?: boolean;
  className?: string;
}

const fieldGridConfig: Record<keyof AddressData, string> = {
  street1: "col-span-2",
  street2: "col-span-2",
  city: "col-span-1",
  stateProvince: "col-span-1",
  postalCode: "col-span-1",
  country: "col-span-1",
};

function addressesEqual(a: AddressData | null, b: AddressData | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  const keys: Array<keyof AddressData> = [
    "street1",
    "street2",
    "city",
    "stateProvince",
    "postalCode",
    "country",
  ];
  return keys.every((key) => (a[key] ?? "") === (b[key] ?? ""));
}

export function AddressInput(props: AddressInputProps) {
  const {
    value = null,
    onChange,
    onCompleteChange,
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

  // Local mirror for stable typing/focus
  const [localAddress, setLocalAddress] = React.useState<AddressData | null>(
    value,
  );
  const lastCompletedAddressRef = React.useRef<AddressData | null>(null);

  React.useEffect(() => {
    if (!addressesEqual(value, localAddress)) {
      setLocalAddress(value);
    }
  }, [value, localAddress]);

  const [isTouched, setIsTouched] = React.useState(false);
  const isComplete = React.useMemo(() => {
    if (!localAddress) return false;
    return requiredFields.every((f) => {
      const v = localAddress[f];
      return typeof v === "string" && v.trim().length > 0;
    });
  }, [localAddress, requiredFields]);

  // Notify once when complete with a distinct value.
  React.useEffect(() => {
    if (!onCompleteChange) return;
    if (
      isComplete &&
      !addressesEqual(localAddress, lastCompletedAddressRef.current)
    ) {
      onCompleteChange(localAddress);
      lastCompletedAddressRef.current = localAddress;
    }
  }, [isComplete, localAddress, onCompleteChange]);

  const fieldOrder: (keyof AddressData)[] = [
    "street1",
    "street2",
    "city",
    "stateProvince",
    "postalCode",
    "country",
  ];

  const handleKeyDown = (e: React.KeyboardEvent, field: keyof AddressData) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const currentIndex = fieldOrder.indexOf(field);
      if (currentIndex < fieldOrder.length - 1) {
        const nextField = fieldOrder[currentIndex + 1];
        const el = document.getElementById(
          `addr_${nextField}`,
        ) as HTMLInputElement | null;
        if (el) el.focus();
      } else if (onSubmit) {
        onSubmit();
      }
    }
  };

  const inputClass = [
    "w-full px-3 py-2 border rounded-lg transition-all duration-200",
    "text-base placeholder:text-muted-foreground/50",
    "focus:outline-none focus:border-primary focus:ring-0",
  ].join(" ");

  return (
    <div className={["w-full space-y-4", className].filter(Boolean).join(" ")}>
      <div className="grid grid-cols-2 gap-4">
        {fieldOrder.map((field, index) => {
          const fieldVal = localAddress?.[field] ?? "";
          const isReq = required && requiredFields.includes(field);
          const hasError = isTouched && isReq && !fieldVal;

          return (
            <div
              key={field}
              className={["space-y-2", fieldGridConfig[field]].join(" ")}
              style={{ animationDelay: `${index * 80}ms` }}
            >
              <label
                htmlFor={`addr_${field}`}
                className="block text-sm font-medium text-foreground"
              >
                {labelFor(field)}
                {isReq && <span className="text-red-500 ml-1">*</span>}
              </label>
              <input
                id={`addr_${field}`}
                name={`addr_${field}`}
                value={fieldVal}
                onChange={(e) => {
                  const next: AddressData = {
                    ...(localAddress ?? {}),
                    [field]: e.target.value,
                  };
                  setLocalAddress(next);
                  onChange(next);
                  if (!isTouched) setIsTouched(true);
                }}
                onKeyDown={(e) => {
                  handleKeyDown(e, field);
                }}
                className={[
                  inputClass,
                  "h-[42px]",
                  hasError
                    ? "border-destructive bg-destructive/10"
                    : "border-border hover:border-border/80 focus:border-primary",
                  disabled ? "opacity-50 cursor-not-allowed" : "",
                ].join(" ")}
                disabled={disabled}
                aria-label={labelFor(field)}
              />
            </div>
          );
        })}
      </div>
      {isTouched && required && !isComplete && (
        <div className="text-sm text-red-500 text-center">
          Please complete all required address fields
        </div>
      )}
    </div>
  );
}

function labelFor(field: keyof AddressData): string {
  switch (field) {
    case "street1":
      return "Street Address";
    case "street2":
      return "Apartment/Suite (Optional)";
    case "city":
      return "City";
    case "stateProvince":
      return "State/Province";
    case "postalCode":
      return "Postal Code";
    case "country":
      return "Country";
    default:
      return String(field);
  }
}
