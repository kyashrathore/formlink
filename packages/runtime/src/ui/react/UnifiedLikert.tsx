"use client";

import * as React from "react";
import { InlineSelect } from "./InlineSelect";

export type FormMode = "chat" | "typeform";

export interface UnifiedLikertProps {
  mode: FormMode;
  options: string[];
  value: string | null;
  onChange: (value: string | null) => void;
  onSubmit?: () => void;
  disabled?: boolean;
  required?: boolean;
  showKeyboardHints?: boolean;
  className?: string;
}

export function UnifiedLikert({
  mode,
  options,
  value,
  onChange,
  onSubmit,
  disabled,
  showKeyboardHints = true,
  className,
}: UnifiedLikertProps) {
  const mapped = React.useMemo(
    () => options.map((label) => ({ value: label, label })),
    [options],
  );
  // InlineSelect doesn’t have disabled; we no-op interactions when disabled
  const handleChange = React.useCallback(
    (v: string | null) => {
      if (disabled) return;
      onChange(v);
    },
    [disabled, onChange],
  );
  const handleSubmit = React.useCallback(() => {
    if (disabled) return;
    onSubmit?.();
  }, [disabled, onSubmit]);
  return (
    <div className={className}>
      <InlineSelect
        options={mapped}
        value={value}
        onChange={handleChange}
        onSubmit={handleSubmit}
        showKeyboardHints={showKeyboardHints}
        // In Typeform mode we want quick advance; InlineSelect defaults autoAdvance=true
        autoFocus
      />
    </div>
  );
}
