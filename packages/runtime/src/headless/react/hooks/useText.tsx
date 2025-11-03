"use client";
import * as React from "react";

export type UseTextOptions = {
  value: string | null;
  onChange: (v: string) => void;
  onSubmit?: () => void | Promise<void>;
  type?: string;
  required?: boolean;
  isInvalid?: boolean;
  placeholder?: string;
  ariaLabel?: string;
  maxLength?: number;
  minLength?: number;
  pattern?: string;
};

export function useText(opts: UseTextOptions) {
  const {
    value,
    onChange,
    onSubmit,
    type = "text",
    required,
    isInvalid,
    placeholder,
    ariaLabel,
    maxLength,
    minLength,
    pattern,
  } = opts;

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
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
      if (!isInvalid) void onSubmit();
    }
  };

  const inputProps = {
    type: type === "number" ? "text" : type,
    inputMode: type === "number" ? "numeric" : undefined,
    value: value ?? "",
    placeholder,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
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
    },
    onKeyDown,
    "aria-label": ariaLabel,
    "aria-invalid": isInvalid || undefined,
    "aria-required": required || undefined,
    maxLength,
    minLength,
    pattern: type === "number" ? undefined : pattern,
  } as const;

  return { inputProps } as const;
}
