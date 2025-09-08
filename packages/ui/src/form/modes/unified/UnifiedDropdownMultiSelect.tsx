"use client";

import React, { useMemo } from "react";
import { cn } from "../../../lib/utils";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxList,
  ComboboxTrigger,
} from "../../../ui/kibo-ui/combobox";
import { CommandItem } from "../../../ui/command";
import { Check } from "lucide-react";

export type FormMode = "chat" | "typeform";

export interface UnifiedDropdownMultiSelectOption<T = string> {
  value: T;
  label: string;
  disabled?: boolean;
}

export interface UnifiedDropdownMultiSelectProps<T = string> {
  mode: FormMode;
  options: UnifiedDropdownMultiSelectOption<T>[];
  value: T[];
  onChange: (value: T[]) => void;
  onSubmit?: () => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  ariaLabel?: string;
  ariaDescribedBy?: string;
}

export function UnifiedDropdownMultiSelect<T = string>({
  mode,
  options,
  value,
  onChange,
  onSubmit,
  placeholder = "Select options...",
  disabled = false,
  required = false,
  className,
}: UnifiedDropdownMultiSelectProps<T>) {
  const data = useMemo(
    () => options.map((o) => ({ value: String(o.value), label: o.label })),
    [options],
  );

  const stringValues = useMemo(
    () => new Set((value || []).map((v) => String(v))),
    [value],
  );

  const selectedLabels = useMemo(
    () =>
      options
        .filter((o) => stringValues.has(String(o.value)))
        .map((o) => o.label),
    [options, stringValues],
  );

  const handleToggleByLabel = (label: string) => {
    const opt = options.find((o) => o.label === label);
    if (!opt) return;
    const valStr = String(opt.value);
    const isSelected = stringValues.has(valStr);
    const newValues = isSelected
      ? (value || []).filter((v) => String(v) !== valStr)
      : [...((value || []) as any[]), opt.value as any];
    onChange(newValues as T[]);
  };

  return (
    <div
      className={cn(
        mode === "typeform" ? "w-full max-w-2xl" : "w-full",
        className,
      )}
    >
      <Combobox data={data} type="option">
        <ComboboxTrigger
          className={cn(
            mode === "typeform" ? "min-h-12 py-2 text-base" : "h-10 text-sm",
            "w-full justify-between",
          )}
          onClick={(e) => {
            // Let popover toggle via combobox; no-op
          }}
        >
          {selectedLabels.length > 0 ? (
            <div className="flex flex-wrap gap-1 items-center">
              {selectedLabels.slice(0, 3).map((label) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs"
                >
                  <span className="max-w-[160px] truncate">{label}</span>
                  {!disabled && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleByLabel(label);
                      }}
                      aria-label={`Remove ${label}`}
                      className="opacity-70 hover:opacity-100"
                    >
                      ×
                    </button>
                  )}
                </span>
              ))}
              {selectedLabels.length > 3 && (
                <span className="text-xs text-muted-foreground">
                  +{selectedLabels.length - 3}
                </span>
              )}
            </div>
          ) : (
            placeholder
          )}
        </ComboboxTrigger>
        <ComboboxContent>
          <ComboboxInput />
          <ComboboxList>
            <ComboboxEmpty>No options found.</ComboboxEmpty>
            <ComboboxGroup>
              {data
                .filter((item) => !stringValues.has(item.value))
                .map((item) => {
                  const isSelected = stringValues.has(item.value);
                  return (
                    <CommandItem
                      key={item.value}
                      value={item.label}
                      onSelect={() => handleToggleByLabel(item.label)}
                    >
                      <span className="flex-1">{item.label}</span>
                      {isSelected && <Check className="w-4 h-4 opacity-80" />}
                    </CommandItem>
                  );
                })}
            </ComboboxGroup>
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
      {/* Footer: selection count and Continue button when onSubmit present (e.g., chat mode) */}
      <div className="flex items-center justify-between text-sm text-muted-foreground mt-2">
        <span>
          {selectedLabels.length} selected
          {required && selectedLabels.length === 0 && " (required)"}
        </span>
        {onSubmit && selectedLabels.length > 0 && (
          <button
            type="button"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground hover:opacity-90"
            onClick={() => onSubmit?.()}
          >
            Continue
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M10.293 3.293a1 1 0 011.414 0l5 5a1 1 0 010 1.414l-5 5a1 1 0 11-1.414-1.414L13.586 11H4a1 1 0 110-2h9.586l-3.293-3.293a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        )}
      </div>
      {required && (!value || value.length === 0) && (
        <p className="text-sm text-destructive mt-2">
          Please select at least one option
        </p>
      )}
    </div>
  );
}
