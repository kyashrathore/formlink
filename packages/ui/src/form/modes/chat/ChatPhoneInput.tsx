"use client";

import React from "react";
import { BaseTextInput } from "../../primitives/BaseTextInput";
import { Input } from "../../../ui/input";
import { cn } from "../../../lib/utils";

export interface ChatPhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
}

export function ChatPhoneInput({
  value,
  onChange,
  onSubmit,
  placeholder = "Enter phone number...",
  disabled = false,
  required = false,
}: ChatPhoneInputProps) {
  const { inputProps, errors, isTouched } = BaseTextInput({
    value,
    onChange,
    disabled,
    required,
    placeholder,
    type: "tel",
    onSubmit,
    autoFocus: false,
    pattern: "^[+]?[(]?[0-9]{3}[)]?[-\\s.]?[(]?[0-9]{3}[)]?[-\\s.]?[0-9]{4,6}$",
    onValidate: (val) => {
      const errors = [];
      if (
        val &&
        !val.match(
          /^[+]?[(]?[0-9]{3}[)]?[-\s.]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{4,6}$/,
        )
      ) {
        errors.push({
          type: "pattern",
          message: "Please enter a valid phone number",
        });
      }
      return errors;
    },
  });

  const showError = isTouched && errors.length > 0;

  return (
    <div className="space-y-3">
      <div
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && onSubmit) {
            e.preventDefault();
            onSubmit();
          }
        }}
      >
        <Input
          {...inputProps}
          className={cn(
            "w-full px-4 py-3 rounded-lg border-2 border-border bg-background text-foreground placeholder:text-muted-foreground transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:border-primary hover:border-border",
            showError && "border-destructive focus:ring-destructive",
            disabled && "opacity-50 cursor-not-allowed",
          )}
        />
      </div>

      {showError && (
        <p className="text-sm text-destructive">{errors[0]?.message}</p>
      )}
    </div>
  );
}
