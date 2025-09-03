"use client";

import { motion } from "motion/react";
import React from "react";
import { cn } from "@/lib/utils";
import { useThemeStyles, BaseTextInput } from "@formlink/ui";

export interface TypeFormPhoneInputProps {
  value: string | null;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  ariaLabel?: string;
  ariaDescribedBy?: string;
  showEnterHint?: boolean;
  onValidate?: (value: string) => Array<{ type: string; message: string }>;
}

/**
 * TypeFormPhoneInput - Specialized phone input for TypeForm mode
 *
 * Features:
 * - Tel input type with simple digit masking
 * - Country code hint display (US +1 by default)
 * - Validation: minimum 7 digits
 * - TypeForm-specific styling and behavior
 */
export function TypeFormPhoneInput({
  value,
  onChange,
  onSubmit,
  placeholder = "(555) 123-4567",
  disabled = false,
  required = false,
  ariaLabel,
  ariaDescribedBy,
  showEnterHint = true,
}: TypeFormPhoneInputProps) {
  // Simple phone number formatting - just clean and format digits
  const formatPhoneNumber = (input: string) => {
    // Remove all non-digits
    const digits = input.replace(/\D/g, "");

    // Limit to 11 digits (for US: 1 + 10 digits)
    const limited = digits.slice(0, 11);

    // Format based on length
    if (limited.length <= 3) {
      return limited;
    } else if (limited.length <= 6) {
      return `(${limited.slice(0, 3)}) ${limited.slice(3)}`;
    } else if (limited.length <= 10) {
      return `(${limited.slice(0, 3)}) ${limited.slice(3, 6)}-${limited.slice(6)}`;
    } else {
      // Handle country code (11 digits)
      return `+${limited.slice(0, 1)} (${limited.slice(1, 4)}) ${limited.slice(4, 7)}-${limited.slice(7, 11)}`;
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    onChange(formatted);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey && onSubmit) {
      e.preventDefault();

      // Simple validation: at least 7 digits
      const digitCount = (value || "").replace(/\D/g, "").length;
      if (!required || digitCount >= 7) {
        onSubmit();
      }
    }
  };

  // Validation state
  const digitCount = (value || "").replace(/\D/g, "").length;
  const isValid = !required || digitCount >= 7;

  return (
    <motion.div
      className="w-full max-w-2xl"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className="relative">
        <input
          type="tel"
          value={value || ""}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          aria-label={ariaLabel}
          aria-describedby={ariaDescribedBy}
          autoFocus
          className={cn(
            // Base TypeForm input styles
            "w-full text-lg md:text-xl lg:text-2xl font-medium",
            "bg-transparent border-none outline-none",
            "text-foreground placeholder:text-muted-foreground",
            "py-3 px-0",
            // Focus styles
            "focus:outline-none focus:ring-0",
            // Disabled styles
            disabled && "opacity-50 cursor-not-allowed",
            // Validation styles
            !isValid && value && "text-destructive",
          )}
        />

        {/* Country code hint */}
        <div className="absolute right-0 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
          🇺🇸 +1
        </div>
      </div>

      {/* Enter hint */}
      {showEnterHint && (
        <div className="mt-2 text-sm text-muted-foreground">
          Press{" "}
          <kbd className="px-1 py-0.5 text-xs border rounded">Enter ↵</kbd> to
          continue
        </div>
      )}

      {/* Validation hint */}
      {!isValid && value && (
        <div className="mt-2 text-sm text-muted-foreground">
          {digitCount < 7 &&
            `At least 7 digits required (${digitCount} entered)`}
        </div>
      )}
    </motion.div>
  );
}
