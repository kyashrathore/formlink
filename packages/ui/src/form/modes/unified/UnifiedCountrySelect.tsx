"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { BaseSelect } from "../../primitives/BaseSelect";
import { cn } from "../../../lib/utils";
import { getCountries, getCountryCallingCode } from "libphonenumber-js";
import type { Option } from "../../primitives/types";
import { ChevronDown, Globe, Check } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "../../../ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "../../../ui/command";

export type FormMode = "chat" | "typeform";

interface Country {
  code: string;
  name: string;
  flag: string;
  dialCode: string;
}

const countryList: Country[] = getCountries()
  .map((countryCode) => {
    const countryName =
      new Intl.DisplayNames(["en"], { type: "region" }).of(countryCode) ||
      countryCode;
    const dialCode = `+${getCountryCallingCode(countryCode)}`;
    // Country flag from regional indicator symbols
    const flag = String.fromCodePoint(
      ...countryCode.split("").map((char) => 0x1f1a5 + char.charCodeAt(0)),
    );
    return { code: countryCode, name: countryName, flag, dialCode };
  })
  .sort((a, b) => a.name.localeCompare(b.name));

export interface UnifiedCountrySelectProps {
  mode: FormMode;
  value: string | null;
  onChange: (value: string | null) => void;
  onSubmit?: () => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  showKeyboardHints?: boolean;
  ariaLabel?: string;
  ariaDescribedBy?: string;
  slim?: boolean;
}

export function UnifiedCountrySelect({
  mode,
  value,
  onChange,
  onSubmit,
  placeholder = "Select a country...",
  disabled = false,
  required = false,
  showKeyboardHints = mode === "typeform",
  ariaLabel,
  ariaDescribedBy,
  slim = false,
}: UnifiedCountrySelectProps) {
  const options: Option[] = useMemo(() => {
    return countryList.map((country) => ({
      value: country.code,
      label: `${country.flag} ${country.name}`,
    }));
  }, []);

  const base = BaseSelect({
    options,
    value,
    onChange,
    disabled,
    required,
    onSubmit,
    placeholder,
    ariaLabel,
    ariaDescribedBy,
    autoFocus: mode === "typeform",
  });

  const showError = base.isTouched && base.errors.length > 0;

  const selected = value
    ? countryList.find((c) => c.code === value)
    : undefined;

  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [triggerWidth, setTriggerWidth] = useState<number | null>(null);

  useEffect(() => {
    const el = triggerRef.current;
    if (!el) return;
    const measure = () => setTriggerWidth(el.getBoundingClientRect().width);
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, []);

  const triggerClasses = cn(
    "flex h-10 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background",
    "placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1",
    slim && "w-24",
    mode === "typeform" && "h-12 text-base",
  );

  const triggerContent = selected ? (
    <div className="flex items-center flex-grow w-0 gap-2 overflow-hidden">
      <span className="shrink-0 text-lg">{selected.flag}</span>
      {!slim && (
        <span className="overflow-hidden text-ellipsis whitespace-nowrap">
          {selected.name}
        </span>
      )}
    </div>
  ) : (
    <span>{slim ? <Globe size={18} /> : placeholder}</span>
  );

  return (
    <div className={cn(mode === "typeform" ? "w-full max-w-2xl" : "w-full")}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          ref={triggerRef}
          className={triggerClasses}
          aria-label={ariaLabel}
          aria-describedby={ariaDescribedBy}
          disabled={disabled}
        >
          {triggerContent}
          <ChevronDown size={16} />
        </PopoverTrigger>
        <PopoverContent
          side="bottom"
          align="start"
          className="p-0 box-border"
          style={{ width: triggerWidth ? `${triggerWidth}px` : undefined }}
        >
          <Command
            className="w-full max-h-[300px]"
            filter={(value, search) => {
              if (value.toLowerCase().includes(search.toLowerCase())) return 1;
              return 0;
            }}
          >
            <CommandList>
              <div className="sticky top-0 z-10 bg-popover">
                <CommandInput placeholder="Search country..." />
              </div>
              <CommandEmpty>No country found.</CommandEmpty>
              <CommandGroup>
                {countryList.map((country) => (
                  <CommandItem
                    key={country.code}
                    value={country.name}
                    onSelect={() => {
                      onChange(country.code);
                      setOpen(false);
                      onSubmit?.();
                    }}
                    className="flex items-center w-full gap-2"
                  >
                    <div className="flex flex-grow w-0 space-x-2 overflow-hidden">
                      <span className="text-lg">{country.flag}</span>
                      <span className="overflow-hidden text-ellipsis whitespace-nowrap">
                        {country.name}
                      </span>
                    </div>
                    <Check
                      className={cn(
                        "ml-auto h-4 w-4 shrink-0",
                        country.code === value ? "opacity-100" : "opacity-0",
                      )}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {showKeyboardHints && !disabled && (
        <div className="mt-2 text-sm text-muted-foreground">
          Type to search, use ↑/↓ to navigate, Enter to select
        </div>
      )}
      {showError && (
        <p className="text-sm text-destructive mt-2">
          {base.errors[0]?.message}
        </p>
      )}
    </div>
  );
}
