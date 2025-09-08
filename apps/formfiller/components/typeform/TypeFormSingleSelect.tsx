"use client";

import { cn } from "@/lib";
import { useEffect, useRef } from "react";

export interface SingleOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface TypeFormSingleSelectProps {
  options: SingleOption[];
  value: string | null;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  disabled?: boolean;
  required?: boolean;
  showKeyboardHints?: boolean;
  className?: string;
}

/**
 * Local Typeform Single Select (Phase 0 fallback)
 * - Large, accessible option rows
 * - No dependency on @formlink/ui internals to avoid the current selection issue
 */
export default function TypeFormSingleSelect({
  options,
  value,
  onChange,
  onSubmit,
  disabled = false,
  required = false,
  showKeyboardHints = true,
  className,
}: TypeFormSingleSelectProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Ensure focus is maintained for keyboard interactions
  useEffect(() => {
    if (containerRef.current && !disabled) {
      containerRef.current.focus();
    }
  }, [disabled]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // Numeric shortcuts 1..9 map to options[0..8]
    if (e.key >= "1" && e.key <= "9") {
      const index = parseInt(e.key, 10) - 1;
      const opt = options[index];
      if (opt && !opt.disabled && !disabled) {
        e.preventDefault();
        handleSelect(opt.value, opt.disabled);
      }
    }
  };
  const handleSelect = (val: string, isDisabled?: boolean) => {
    if (disabled || isDisabled) return;
    onChange(val);
    // Auto-advance for Typeform behavior if provided
    onSubmit?.();
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        "space-y-3 w-full max-w-2xl pointer-events-auto outline-none",
        className,
      )}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
    >
      {options.map((opt, index) => {
        const isSelected = value === opt.value;
        const shortcutKey = index < 9 ? String(index + 1) : null;

        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => handleSelect(opt.value, opt.disabled)}
            disabled={disabled || opt.disabled}
            className={cn(
              "w-full text-left px-4 py-3 rounded-lg border transition-all duration-200 flex items-center gap-3",
              isSelected
                ? "bg-primary/10 border-2 border-primary"
                : "bg-muted/30 border border-border/50 hover:bg-muted/60 hover:border-border",
              (disabled || opt.disabled) && "opacity-50 cursor-not-allowed",
            )}
            aria-selected={isSelected}
            aria-disabled={disabled || opt.disabled || undefined}
            role="option"
          >
            {showKeyboardHints && shortcutKey && (
              <span
                className={cn(
                  "inline-flex items-center justify-center w-6 h-6 rounded text-xs font-semibold",
                  isSelected
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-primary border border-primary",
                )}
              >
                {shortcutKey}
              </span>
            )}

            <span
              className={cn("flex-1 text-base", isSelected && "font-medium")}
            >
              {opt.label}
            </span>
          </button>
        );
      })}

      {required && !value && (
        <p className="text-sm text-muted-foreground">
          Please select an option.
        </p>
      )}
    </div>
  );
}
