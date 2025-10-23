"use client";

import type { CountryCode } from "libphonenumber-js";
import {
  AsYouType,
  getCountries,
  getCountryCallingCode,
  isValidPhoneNumber,
  parsePhoneNumberFromString,
} from "libphonenumber-js";
import { ChevronDown } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "../../../lib/utils";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "../../../ui/command";
import { Input } from "../../../ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "../../../ui/popover";

export type FormMode = "chat" | "typeform";

export interface UnifiedPhoneInputProps {
  mode: FormMode;
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  ariaLabel?: string;
  ariaDescribedBy?: string;
  showKeyboardHints?: boolean;
  country?: CountryCode | null; // ISO 3166-1 alpha-2
  defaultCountry?: CountryCode; // Pre-seed with this region's dial code when empty
  onCountryChange?: (iso2: CountryCode | null) => void;
  showFlag?: boolean;
  showCountrySelector?: boolean;
  showContinueButton?: boolean;
}

export function UnifiedPhoneInput({
  mode,
  value,
  onChange,
  onSubmit,
  placeholder = "Enter phone number",
  disabled = false,
  required = false,
  ariaLabel,
  ariaDescribedBy,
  showKeyboardHints = mode === "typeform",
  country,
  defaultCountry,
  onCountryChange,
  showFlag = mode === "typeform",
  showCountrySelector = mode === "typeform",
  showContinueButton = mode === "chat",
}: UnifiedPhoneInputProps) {
  const [selectedISO2, setSelectedISO2] = useState<CountryCode | null>(
    country || defaultCountry || null,
  );
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (country) setSelectedISO2(country);
  }, [country]);

  const region: CountryCode | undefined = useMemo(() => {
    return (
      selectedISO2 ||
      country ||
      defaultCountry ||
      (mode === "typeform" ? ("US" as CountryCode) : undefined)
    );
  }, [selectedISO2, country, defaultCountry, mode]);

  // Derived state: validity using libphonenumber-js
  const isValid = useMemo(() => {
    try {
      // If value includes a leading +, use international parsing; else region-based
      if (!value || value.trim() === "") return !required;
      if (value.trim().startsWith("+")) return isValidPhoneNumber(value);
      if (region) return isValidPhoneNumber(value, region);
      return isValidPhoneNumber(value);
    } catch {
      return false;
    }
  }, [value, required, region]);

  const [flagISO2, setFlagISO2] = useState<CountryCode | null>(null);
  const [countryOpen, setCountryOpen] = useState(false);
  const commandInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const scrollSelectedIntoView = () => {
    const container = listRef.current;
    if (!container) return;
    const el = container.querySelector(
      '[cmdk-item][data-selected="true"]',
    ) as HTMLElement | null;
    if (el) el.scrollIntoView({ block: "nearest" });
  };
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [triggerWidth, setTriggerWidth] = useState<number | null>(null);
  useEffect(() => {
    if (countryOpen) {
      const t = setTimeout(() => commandInputRef.current?.focus(), 0);
      const s = setTimeout(() => {
        if (listRef.current) listRef.current.scrollTop = 0;
        scrollSelectedIntoView();
      }, 0);
      return () => {
        clearTimeout(t);
        clearTimeout(s);
      };
    }
  }, [countryOpen]);

  // Measure trigger width to size the popover content appropriately
  useEffect(() => {
    const el = triggerRef.current;
    if (!el) return;
    const measure = () => setTriggerWidth(el.getBoundingClientRect().width);
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, []);

  // Seed value with default region dial code when empty
  useEffect(() => {
    if (!value && defaultCountry) {
      try {
        // If using libphonenumber-js metadata availability is limited here; we can safely prepend '+' if missing
        const initial = "+";
        onChange(initial);
      } catch {
        // Default formatting failed, ignore
      }
    }
  }, [defaultCountry]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value;
    // Normalize to start with '+'; convert leading '00' to '+'
    if (raw && !raw.startsWith("+")) {
      raw = raw.startsWith("00") ? "+" + raw.slice(2) : "+" + raw;
    }

    const formatter = region ? new AsYouType(region) : new AsYouType();
    const formatted = formatter.input(raw);
    onChange(formatted);

    // Infer country from formatted number and update flag/callback
    const parsed = parsePhoneNumberFromString(formatted, region);
    const iso2 = (parsed?.country as CountryCode | undefined) ?? null;
    setFlagISO2(iso2);
    onCountryChange?.(iso2);
  };

  const countries = useMemo(() => getCountries(), []);
  const getFlagFromISO2 = (iso?: CountryCode | null) =>
    iso
      ? String.fromCodePoint(
          ...(iso || "")
            .toUpperCase()
            .split("")
            .map((c) => 0x1f1a5 + c.charCodeAt(0)),
        )
      : "🌐";
  const selectedFlag = getFlagFromISO2(selectedISO2 || flagISO2);
  const selectedDial = useMemo(() => {
    try {
      return selectedISO2 ? `+${getCountryCallingCode(selectedISO2)}` : "+";
    } catch {
      return "+";
    }
  }, [selectedISO2]);

  const handleSelectCountry = (iso2: CountryCode) => {
    setSelectedISO2(iso2);
    onCountryChange?.(iso2);
    setCountryOpen(false);
    // Reset touched state when country changes to avoid immediate red validation
    setTouched(false);

    if (!value || value.trim() === "") {
      // Seed with dial code
      try {
        const dial = `+${getCountryCallingCode(iso2)} `;
        onChange(dial);
      } catch {
        onChange("+");
      }
    }

    // Focus the phone input after country selection
    setTimeout(() => {
      const phoneInput = document.querySelector(
        'input[type="tel"]',
      ) as HTMLInputElement;
      if (phoneInput && mode === "typeform") {
        phoneInput.focus();
        // Position cursor at end
        phoneInput.setSelectionRange(
          phoneInput.value.length,
          phoneInput.value.length,
        );
      }
    }, 100);
  };

  if (mode === "typeform") {
    return (
      <div className="w-full max-w-2xl">
        <div className="flex items-center h-12 border-0 border-b-2 border-border/30 focus-within:border-primary transition-colors duration-200">
          {showCountrySelector && (
            <Popover open={countryOpen} onOpenChange={setCountryOpen}>
              <PopoverTrigger
                ref={triggerRef}
                className="flex items-center gap-2 px-0 h-full text-2xl md:text-3xl font-light bg-transparent border-0 hover:opacity-70 transition-opacity duration-200"
              >
                <span className="text-2xl">{selectedFlag}</span>
                <ChevronDown size={16} className="opacity-60" />
              </PopoverTrigger>
              <PopoverContent
                className="p-0 box-border"
                side="bottom"
                align="start"
                style={{
                  width: triggerWidth ? Math.max(triggerWidth, 256) : undefined,
                }}
              >
                <Command>
                  <CommandList ref={listRef}>
                    <div className="sticky top-0 z-10 bg-popover">
                      <CommandInput
                        ref={commandInputRef}
                        placeholder="Search country..."
                        onValueChange={() => {
                          if (listRef.current) listRef.current.scrollTop = 0;
                          requestAnimationFrame(scrollSelectedIntoView);
                        }}
                      />
                    </div>
                    <CommandEmpty>No country found.</CommandEmpty>
                    <CommandGroup>
                      {countries.map((code) => {
                        const name =
                          new Intl.DisplayNames(["en"], { type: "region" }).of(
                            code,
                          ) || code;
                        return (
                          <CommandItem
                            key={code}
                            value={`${name} ${code} +${getCountryCallingCode(code)}`}
                            onSelect={() => handleSelectCountry(code)}
                            className="flex items-center gap-2"
                          >
                            <span className="text-lg">
                              {getFlagFromISO2(code)}
                            </span>
                            <span className="flex-1">{name}</span>
                            <span className="text-xs text-muted-foreground">
                              +{getCountryCallingCode(code)}
                            </span>
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          )}
          <input
            type="tel"
            value={value}
            onChange={handleChange}
            aria-label={ariaLabel}
            aria-describedby={ariaDescribedBy}
            className={cn(
              "w-full text-2xl md:text-3xl font-light h-full",
              "bg-transparent border-0 focus:outline-none",
              "text-foreground placeholder:text-muted-foreground/50",
              "px-0",
              disabled && "opacity-50 cursor-not-allowed",
              !isValid && value && touched && "text-destructive",
            )}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && onSubmit) {
                e.preventDefault();
                // Validate before submit
                if (isValid) onSubmit();
              }
            }}
            onBlur={() => setTouched(true)}
            placeholder={placeholder}
            autoFocus
            required={required}
            disabled={disabled}
          />
        </div>
      </div>
    );
  }

  // Chat styling
  return (
    <div className="space-y-3">
      <div
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && onSubmit) {
            e.preventDefault();
            if (isValid) onSubmit?.();
          }
        }}
      >
        <div className="flex items-center gap-2">
          {showCountrySelector && (
            <Popover open={countryOpen} onOpenChange={setCountryOpen}>
              <PopoverTrigger
                ref={triggerRef}
                className="flex items-center gap-1 px-2 py-1 rounded-md border text-sm"
              >
                <span className="text-base">{selectedFlag}</span>
                <span className="text-muted-foreground">{selectedDial}</span>
                <ChevronDown size={14} className="opacity-60" />
              </PopoverTrigger>
              <PopoverContent
                className="p-0 box-border"
                side="bottom"
                align="start"
                style={{
                  width: triggerWidth ? Math.max(triggerWidth, 256) : undefined,
                }}
              >
                <Command>
                  <CommandList ref={listRef}>
                    <div className="sticky top-0 z-10 bg-popover">
                      <CommandInput
                        ref={commandInputRef}
                        placeholder="Search country..."
                        onValueChange={() => {
                          if (listRef.current) listRef.current.scrollTop = 0;
                          requestAnimationFrame(scrollSelectedIntoView);
                        }}
                      />
                    </div>
                    <CommandEmpty>No country found.</CommandEmpty>
                    <CommandGroup>
                      {countries.map((code) => {
                        const name =
                          new Intl.DisplayNames(["en"], { type: "region" }).of(
                            code,
                          ) || code;
                        return (
                          <CommandItem
                            key={code}
                            value={`${name} ${code} +${getCountryCallingCode(code)}`}
                            onSelect={() => handleSelectCountry(code)}
                            className="flex items-center gap-2"
                          >
                            <span className="text-lg">
                              {getFlagFromISO2(code)}
                            </span>
                            <span className="flex-1">{name}</span>
                            <span className="text-xs text-muted-foreground">
                              +{getCountryCallingCode(code)}
                            </span>
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          )}
          <Input
            type="tel"
            value={value}
            onChange={handleChange}
            aria-label={ariaLabel}
            aria-describedby={ariaDescribedBy}
            className={cn(
              "w-full px-4 py-3 rounded-lg border-2 border-border bg-background text-foreground placeholder:text-muted-foreground transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:border-primary hover:border-border",
              !isValid &&
                value &&
                touched &&
                "border-destructive focus:ring-destructive",
              disabled && "opacity-50 cursor-not-allowed",
            )}
            placeholder={placeholder}
            required={required}
            disabled={disabled}
            onBlur={() => setTouched(true)}
          />
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between">
        {!isValid && value && touched && (
          <p className="text-sm text-destructive">Invalid phone number</p>
        )}
        {showContinueButton && onSubmit && isValid && (
          <button
            type="button"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground hover:opacity-90"
            onClick={() => onSubmit?.()}
          >
            Continue
          </button>
        )}
      </div>
    </div>
  );
}
