"use client";

import { Check, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "../../../lib/utils";
import { Badge } from "../../../components/ui/badge";
import { CommandItem } from "../../../components/ui/command";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxList,
  ComboboxTrigger,
} from "../../../components/kibo-ui/combobox";

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
    const current = (value ?? []) as string[];
    const newValues = isSelected
      ? current.filter((v) => v !== valStr)
      : [...current, valStr];
    onChange(newValues as unknown as T[]);
  };

  // Measure-fit logic for badges: show +N only when they don't fit in one line
  const containerRef = useRef<HTMLDivElement>(null);
  const overflowRef = useRef<HTMLSpanElement>(null);
  const [overflowAmount, setOverflowAmount] = useState(0);

  const recalcOverflow = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const overflowEl = overflowRef.current;
    if (overflowEl) overflowEl.style.display = "none";
    const items = el.querySelectorAll<HTMLElement>("[data-selected-item]");
    items.forEach((child) => child.style.removeProperty("display"));

    let amount = 0;
    for (let i = items.length - 1; i >= 0; i--) {
      if (el.scrollWidth <= el.clientWidth) break;
      amount = items.length - i;
      const child = items[i]!;
      child.style.display = "none";
      if (overflowEl) overflowEl.style.removeProperty("display");
    }
    setOverflowAmount(amount);
  }, []);

  useEffect(() => {
    recalcOverflow();
  }, [selectedLabels, recalcOverflow]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => recalcOverflow());
    ro.observe(el);
    return () => ro.disconnect();
  }, [recalcOverflow]);

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
            mode === "typeform" ? "h-12 text-base" : "h-10 text-sm",
            "w-full justify-between overflow-hidden whitespace-nowrap",
          )}
          onClick={(e) => {
            // Let popover toggle via combobox; no-op
          }}
        >
          {selectedLabels.length > 0 ? (
            <div
              ref={containerRef}
              className="flex items-center gap-1.5 overflow-hidden"
            >
              {selectedLabels.map((label) => (
                <Badge
                  key={label}
                  variant="outline"
                  className="flex items-center gap-1 p-2"
                  data-selected-item
                >
                  <span className="max-w-[160px] truncate">{label}</span>
                  {!disabled && (
                    // Use a non-button element to avoid nesting a button inside the Combobox trigger button
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleByLabel(label);
                      }}
                      aria-label={`Remove ${label}`}
                      className="opacity-70 hover:opacity-100 cursor-pointer"
                      role="presentation"
                    >
                      <X className="w-3.5 h-3.5" aria-hidden="true" />
                    </span>
                  )}
                </Badge>
              ))}
              <Badge
                ref={overflowRef}
                variant="outline"
                style={{ display: overflowAmount > 0 ? "inline-flex" : "none" }}
                className="text-xs text-muted-foreground p-2"
              >
                +{overflowAmount}
              </Badge>
            </div>
          ) : (
            placeholder
          )}
        </ComboboxTrigger>
        <ComboboxContent>
          <ComboboxInput className="h-10" />
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
