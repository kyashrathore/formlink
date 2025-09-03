"use client";

import { cn } from "@/lib/utils";
import { AddressData } from "@formlink/schema";
import { motion } from "motion/react";
import React from "react";
import { BaseAddress } from "../../../../packages/ui/src/form/primitives";

export interface TypeFormAddressInputProps {
  value?: AddressData | null;
  onChange: (value: AddressData) => void;
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

export function TypeFormAddressInput(props: TypeFormAddressInputProps) {
  const {
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

  const addressPrimitive = BaseAddress({
    value,
    onChange: onChange as any,
    disabled,
    required,
    requiredFields,
    autoFocus,
    autoSubmitOnComplete: false,
    onSubmit: onSubmit,
  });

  const { fieldProps, isComplete, errors, isTouched, validate } =
    addressPrimitive;

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
        if (nextField) {
          const nextInput = document.querySelector(
            `input[id="${(fieldProps[nextField] as any).id}"]`,
          ) as HTMLInputElement;
          if (nextInput) {
            nextInput.focus();
          }
        }
      }
    }
  };

  const inputClass = cn(
    "w-full px-3 py-2 border rounded-lg transition-all duration-200",
    "text-base placeholder:text-muted-foreground/50",
    "focus:outline-none focus:border-primary focus:ring-0",
  );

  return (
    <div className={cn("w-full space-y-4", className)}>
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
                      : "border-border hover:border-border-hover",
                  domProps.disabled && "opacity-50 cursor-not-allowed",
                )}
              />
            </motion.div>
          );
        })}
      </div>
      {isTouched && required && !isComplete && errors.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-sm text-red-500 text-center"
        >
          Please complete all required address fields
        </motion.div>
      )}
    </div>
  );
}
