"use client";

import React, { useMemo } from "react";
import { cn } from "../../../lib/utils";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
} from "../../../ui/kibo-ui/combobox";

export type FormMode = "chat" | "typeform";

export interface UnifiedDropdownSelectOption<T = string> {
  value: T;
  label: string;
  disabled?: boolean;
}

export interface UnifiedDropdownSelectProps<T = string> {
  mode: FormMode;
  options: UnifiedDropdownSelectOption<T>[];
  value: T | null;
  onChange: (value: T | null) => void;
  onSubmit?: () => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  ariaLabel?: string;
  ariaDescribedBy?: string;
}

export function UnifiedDropdownSelect<T = string>({
  mode,
  options,
  value,
  onChange,
  onSubmit,
  placeholder = "Select an option...",
  disabled = false,
  required = false,
  className,
}: UnifiedDropdownSelectProps<T>) {
  const data = useMemo(
    () => options.map((o) => ({ value: String(o.value), label: o.label })),
    [options],
  );

  const selectedOption = useMemo(
    () =>
      value == null
        ? null
        : options.find((o) => String(o.value) === String(value)) || null,
    [options, value],
  );
  const currentLabel = selectedOption ? selectedOption.label : "";

  return (
    <div
      className={cn(
        mode === "typeform" ? "w-full max-w-2xl" : "w-full",
        className,
      )}
    >
      <Combobox
        data={data}
        type="option"
        value={currentLabel}
        onValueChange={(v) => {
          // v is the label string; map back to option value
          const found = options.find((o) => o.label === v);
          onChange((found ? found.value : null) as any as T | null);
          onSubmit?.();
        }}
      >
        <ComboboxTrigger
          className={cn(
            mode === "typeform" ? "h-12 text-base" : "h-10 text-sm",
            "w-full justify-between",
          )}
        >
          {currentLabel || placeholder}
        </ComboboxTrigger>
        <ComboboxContent>
          <ComboboxInput />
          <ComboboxList>
            <ComboboxEmpty>No options found.</ComboboxEmpty>
            <ComboboxGroup>
              {data.map((item) => (
                <ComboboxItem key={item.value} value={item.label}>
                  {item.label}
                </ComboboxItem>
              ))}
            </ComboboxGroup>
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
      {required && !value && (
        <p className="text-sm text-destructive mt-2">Please select an option</p>
      )}
    </div>
  );
}
