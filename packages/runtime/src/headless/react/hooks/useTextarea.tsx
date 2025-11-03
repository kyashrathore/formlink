"use client";
import * as React from "react";

export type UseTextareaOptions = {
  value: string | null;
  onChange: (v: string) => void;
  onSubmit?: () => void | Promise<void>;
  required?: boolean;
  isInvalid?: boolean;
  placeholder?: string;
  ariaLabel?: string;
  maxLength?: number;
  minLength?: number;
};

export function useTextarea(opts: UseTextareaOptions) {
  const {
    value,
    onChange,
    onSubmit,
    required,
    isInvalid,
    placeholder,
    ariaLabel,
    maxLength,
    minLength,
  } = opts;

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!isInvalid) void onSubmit?.();
    }
  };

  const textareaProps = {
    value: value ?? "",
    placeholder,
    onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) =>
      onChange(e.target.value),
    onKeyDown,
    "aria-label": ariaLabel,
    "aria-invalid": isInvalid || undefined,
    "aria-required": required || undefined,
    maxLength,
    minLength,
  } as const;

  return { textareaProps } as const;
}
