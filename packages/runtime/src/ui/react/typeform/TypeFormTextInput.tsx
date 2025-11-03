"use client";

import * as React from "react";
import { useText } from "@/headless/react/hooks/useText";

export interface TypeFormTextInputProps {
  value: string | null;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  maxLength?: number;
  minLength?: number;
  pattern?: string;
  type?: string;
  showEnterHint?: boolean;
  onValidate?: (value: string) => Array<{ type: string; message: string }>;
  ariaLabel?: string;
  isInvalid?: boolean;
}

export function TypeFormTextInput({
  value,
  onChange,
  onSubmit,
  placeholder = "Type your answer...",
  disabled = false,
  required = false,
  maxLength,
  minLength,
  pattern,
  type = "text",
  ariaLabel,
  isInvalid = false,
}: TypeFormTextInputProps) {
  const [focused, setFocused] = React.useState(false);
  const tx = useText({
    value,
    onChange,
    onSubmit,
    type,
    required,
    isInvalid,
    maxLength,
    minLength,
    pattern,
  });

  return (
    <div className="w-full max-w-2xl space-y-4">
      <input
        autoFocus
        id={ariaLabel ? ariaLabel.replace(/\s+/g, "_") : undefined}
        name={ariaLabel ? ariaLabel.replace(/\s+/g, "_") : undefined}
        {...tx.inputProps}
        placeholder={placeholder}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        aria-label={ariaLabel}
        disabled={disabled}
        className={[
          "w-full h-16 px-0 py-3 text-2xl md:text-3xl font-light",
          "bg-transparent border-0 border-b-2 border-border/30",
          focused ? "focus:border-b-primary" : "",
          "focus:outline-none transition-colors duration-200",
          "placeholder:text-muted-foreground/50",
          disabled ? "opacity-50 cursor-not-allowed" : "",
        ].join(" ")}
      />
    </div>
  );
}
