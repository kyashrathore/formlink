"use client";

import { motion } from "motion/react";
import React, { useState, useMemo, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

// Common countries list - ISO 3166-1 alpha-2 codes
const COUNTRIES = [
  { code: "US", name: "United States", flag: "🇺🇸" },
  { code: "CA", name: "Canada", flag: "🇨🇦" },
  { code: "GB", name: "United Kingdom", flag: "🇬🇧" },
  { code: "AU", name: "Australia", flag: "🇦🇺" },
  { code: "DE", name: "Germany", flag: "🇩🇪" },
  { code: "FR", name: "France", flag: "🇫🇷" },
  { code: "JP", name: "Japan", flag: "🇯🇵" },
  { code: "BR", name: "Brazil", flag: "🇧🇷" },
  { code: "IN", name: "India", flag: "🇮🇳" },
  { code: "CN", name: "China", flag: "🇨🇳" },
  { code: "MX", name: "Mexico", flag: "🇲🇽" },
  { code: "IT", name: "Italy", flag: "🇮🇹" },
  { code: "ES", name: "Spain", flag: "🇪🇸" },
  { code: "NL", name: "Netherlands", flag: "🇳🇱" },
  { code: "SE", name: "Sweden", flag: "🇸🇪" },
  { code: "CH", name: "Switzerland", flag: "🇨🇭" },
  { code: "SG", name: "Singapore", flag: "🇸🇬" },
  { code: "KR", name: "South Korea", flag: "🇰🇷" },
  { code: "NZ", name: "New Zealand", flag: "🇳🇿" },
  { code: "NO", name: "Norway", flag: "🇳🇴" },
].sort((a, b) => a.name.localeCompare(b.name));

export interface TypeFormCountrySelectProps {
  value: string | null;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  ariaLabel?: string;
  ariaDescribedBy?: string;
  showEnterHint?: boolean;
}

/**
 * TypeFormCountrySelect - Specialized country selector for TypeForm mode
 *
 * Features:
 * - Searchable dropdown with country flags
 * - Keyboard navigation (arrows + Enter)
 * - Returns ISO 3166-1 alpha-2 country codes
 * - TypeForm-specific styling and behavior
 */
export function TypeFormCountrySelect({
  value,
  onChange,
  onSubmit,
  placeholder = "Search country…",
  disabled = false,
  required = false,
  ariaLabel,
  ariaDescribedBy,
  showEnterHint = true,
}: TypeFormCountrySelectProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Filter countries based on search term
  const filteredCountries = useMemo(() => {
    if (!searchTerm) return COUNTRIES;

    return COUNTRIES.filter(
      (country) =>
        country.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        country.code.toLowerCase().includes(searchTerm.toLowerCase()),
    );
  }, [searchTerm]);

  // Get selected country for display
  const selectedCountry = useMemo(() => {
    return COUNTRIES.find((country) => country.code === value);
  }, [value]);

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setIsOpen(true);
    setFocusedIndex(-1);
  };

  // Handle country selection
  const handleCountrySelect = (countryCode: string) => {
    onChange(countryCode);
    setIsOpen(false);
    setSearchTerm("");
    setFocusedIndex(-1);

    if (onSubmit) {
      onSubmit();
    }
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
        } else {
          setFocusedIndex((prev) =>
            prev < filteredCountries.length - 1 ? prev + 1 : 0,
          );
        }
        break;

      case "ArrowUp":
        e.preventDefault();
        if (isOpen) {
          setFocusedIndex((prev) =>
            prev > 0 ? prev - 1 : filteredCountries.length - 1,
          );
        }
        break;

      case "Enter":
        e.preventDefault();
        if (isOpen && focusedIndex >= 0) {
          handleCountrySelect(filteredCountries[focusedIndex].code);
        } else if (onSubmit && (!required || value)) {
          onSubmit();
        }
        break;

      case "Escape":
        setIsOpen(false);
        setFocusedIndex(-1);
        setSearchTerm("");
        break;
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        inputRef.current &&
        event.target &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSearchTerm("");
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Scroll focused option into view
  useEffect(() => {
    if (focusedIndex >= 0 && listRef.current) {
      const focusedElement = listRef.current.children[
        focusedIndex
      ] as HTMLElement;
      if (focusedElement) {
        focusedElement.scrollIntoView({ block: "nearest" });
      }
    }
  }, [focusedIndex]);

  return (
    <motion.div
      className="w-full max-w-2xl relative"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={
            isOpen
              ? searchTerm
              : selectedCountry
                ? `${selectedCountry.flag} ${selectedCountry.name}`
                : ""
          }
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => !disabled && setIsOpen(true)}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          aria-label={ariaLabel}
          aria-describedby={ariaDescribedBy}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          role="combobox"
          autoFocus
          className={cn(
            // Base TypeForm input styles
            "w-full text-lg md:text-xl lg:text-2xl font-medium",
            "bg-transparent border-none outline-none",
            "text-foreground placeholder:text-muted-foreground",
            "py-3 px-0 pr-8",
            // Focus styles
            "focus:outline-none focus:ring-0",
            // Disabled styles
            disabled && "opacity-50 cursor-not-allowed",
          )}
        />

        {/* Dropdown indicator */}
        <ChevronDown
          className={cn(
            "absolute right-0 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground transition-transform",
            isOpen && "rotate-180",
          )}
        />
      </div>

      {/* Dropdown list */}
      {isOpen && !disabled && (
        <div
          ref={listRef}
          className={cn(
            "absolute top-full left-0 right-0 mt-2 z-50",
            "bg-background border border-border rounded-md shadow-lg",
            "max-h-60 overflow-y-auto",
          )}
          role="listbox"
        >
          {filteredCountries.map((country, index) => (
            <div
              key={country.code}
              onClick={() => handleCountrySelect(country.code)}
              className={cn(
                "flex items-center gap-3 px-4 py-3 cursor-pointer",
                "hover:bg-muted transition-colors",
                index === focusedIndex && "bg-muted",
                value === country.code && "bg-primary/10 text-primary",
              )}
              role="option"
              aria-selected={value === country.code}
            >
              <span className="text-xl">{country.flag}</span>
              <span className="font-medium">{country.name}</span>
              <span className="text-sm text-muted-foreground ml-auto">
                {country.code}
              </span>
            </div>
          ))}

          {filteredCountries.length === 0 && (
            <div className="px-4 py-3 text-muted-foreground text-center">
              No countries found
            </div>
          )}
        </div>
      )}

      {/* Enter hint */}
      {showEnterHint && !isOpen && (
        <div className="mt-2 text-sm text-muted-foreground">
          Press{" "}
          <kbd className="px-1 py-0.5 text-xs border rounded">Enter ↵</kbd> to
          continue
        </div>
      )}
    </motion.div>
  );
}
