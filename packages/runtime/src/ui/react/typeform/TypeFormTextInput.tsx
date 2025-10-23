"use client";

import * as React from "react";

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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // number type restrictions
    if (type === "number") {
      const allowed = [
        "Backspace",
        "Delete",
        "Tab",
        "Escape",
        "Enter",
        "ArrowLeft",
        "ArrowRight",
        "ArrowUp",
        "ArrowDown",
        "Home",
        "End",
      ];
      if (allowed.includes(e.key)) {
        // allow
      } else if (
        (e.key === "a" || e.key === "c" || e.key === "v" || e.key === "x") &&
        (e.ctrlKey || e.metaKey)
      ) {
        // allow shortcuts
      } else if (e.key === "-") {
        const input = e.currentTarget;
        const atStart = (input.selectionStart ?? 0) === 0;
        if (!atStart || (input.value || "").includes("-")) e.preventDefault();
      } else if (e.key === ".") {
        if ((e.currentTarget.value || "").includes(".")) e.preventDefault();
      } else if (!/^[0-9]$/.test(e.key)) {
        e.preventDefault();
      }
    }
    if (e.key === "Enter" && !e.shiftKey && onSubmit) {
      e.preventDefault();
      if (!isInvalid) onSubmit();
    }
  };

  return (
    <div className="w-full max-w-2xl space-y-4">
      <input
        autoFocus
        id={ariaLabel ? ariaLabel.replace(/\s+/g, "_") : undefined}
        name={ariaLabel ? ariaLabel.replace(/\s+/g, "_") : undefined}
        type={type === "number" ? "text" : type}
        inputMode={type === "number" ? "numeric" : undefined}
        value={value ?? ""}
        placeholder={placeholder}
        onChange={(e) => {
          let v = e.target.value;
          if (type === "number") {
            const sanitized = v.replace(/[^0-9.-]/g, "");
            const parts = sanitized.split(".");
            const formatted =
              parts.length > 2
                ? parts[0] + "." + parts.slice(1).join("")
                : sanitized;
            const minusCount = (formatted.match(/-/g) || []).length;
            v =
              minusCount > 1
                ? formatted.replace(/-/g, "").replace(/^/, "-")
                : minusCount === 1 && !formatted.startsWith("-")
                  ? formatted.replace(/-/g, "")
                  : formatted;
          }
          onChange(v);
        }}
        onKeyDown={handleKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        aria-label={ariaLabel}
        aria-invalid={isInvalid || undefined}
        aria-required={required || undefined}
        disabled={disabled}
        maxLength={maxLength}
        minLength={minLength}
        pattern={type === "number" ? undefined : pattern}
        className={[
          "w-full h-16 px-0 py-3 text-2xl md:text-3xl font-light",
          "bg-transparent border-0 border-b-2 border-border/30",
          focused ? "focus:border-primary" : "",
          "focus:outline-none transition-colors duration-200",
          "placeholder:text-muted-foreground/50",
          disabled ? "opacity-50 cursor-not-allowed" : "",
        ].join(" ")}
      />
    </div>
  );
}
