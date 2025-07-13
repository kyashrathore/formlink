"use client";

import React, { useMemo } from 'react';
import { BaseSelect } from '../../primitives/BaseSelect';
import { Button } from '../../../ui/button';
import { cn } from '../../../lib/utils';
import { Check } from 'lucide-react';
import { getCountries, getCountryCallingCode } from 'libphonenumber-js';
import { Option } from '../../primitives/types';

interface Country {
  code: string;
  name: string;
  flag: string;
  dialCode: string;
}

// Generate country list
const countryList: Country[] = getCountries()
  .map((countryCode) => {
    const countryName =
      new Intl.DisplayNames(["en"], { type: "region" }).of(countryCode) ||
      countryCode;
    const dialCode = `+${getCountryCallingCode(countryCode)}`;
    const flag = String.fromCodePoint(
      ...countryCode.split("").map((char) => 0x1f1a5 + char.charCodeAt(0))
    );

    return {
      code: countryCode,
      name: countryName,
      flag: flag,
      dialCode: dialCode,
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name));

export interface ChatCountrySelectProps {
  value: string | null;
  onChange: (value: string | null) => void;
  onSubmit?: () => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  showKeyboardHints?: boolean;
}

export function ChatCountrySelect({
  value,
  onChange,
  onSubmit,
  placeholder = "Select a country...",
  disabled = false,
  required = false,
  showKeyboardHints = false,
}: ChatCountrySelectProps) {
  // Convert countries to SelectOption format
  const options: Option[] = useMemo(() => {
    return countryList.map(country => ({
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
  });

  const showError = base.isTouched && base.errors.length > 0;

  return (
    <div className="space-y-3">
      <div {...base.containerProps} className="relative">
        <div className="grid gap-2 max-h-[300px] overflow-y-auto">
          {base.options.map((option, index) => {
            const country = countryList.find(c => c.code === option.value);
            const isSelected = value === option.value;
            const isHighlighted = base.highlightedIndex === index;
            
            return (
              <Button
                key={option.value}
                {...base.getOptionProps(index)}
                variant="ghost"
                className={cn(
                  "justify-start h-auto py-2 px-3 text-left",
                  isSelected && "bg-primary text-primary-foreground",
                  isHighlighted && !isSelected && "bg-muted",
                  disabled && "opacity-50 cursor-not-allowed"
                )}
              >
                <span className="mr-2 text-lg">{country?.flag}</span>
                <span className="flex-1">{country?.name}</span>
                {isSelected && <Check className="h-4 w-4 ml-2" />}
              </Button>
            );
          })}
        </div>
      </div>
      
      {showError && (
        <p className="text-sm text-destructive text-center">
          {base.errors[0]?.message}
        </p>
      )}
      
      {showKeyboardHints && !disabled && (
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          Type to search or use{' '}
          <kbd className="px-1.5 py-0.5 text-xs bg-muted text-muted-foreground rounded">
            ↑↓
          </kbd>{' '}
          to navigate
        </div>
      )}
    </div>
  );
}