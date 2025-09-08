"use client";

import { cn } from "@/lib/utils";
import { motion } from "motion/react";
import React, { useCallback } from "react";

export interface TypeFormLinearScaleProps {
  value: number | null;
  onChange: (value: number) => void;
  onSubmit?: () => void;
  config: {
    start: number;
    end: number;
    step: number;
    startLabel?: string;
    endLabel?: string;
  };
  disabled?: boolean;
  required?: boolean;
  ariaLabel?: string;
  ariaDescribedBy?: string;
  showKeyboardHints?: boolean;
}

/**
 * TypeFormLinearScale - Specialized linear scale input for TypeForm mode
 *
 * Key challenge solved: Precise label alignment
 * - startLabel aligns exactly with the first number's center
 * - endLabel aligns exactly with the last number's center
 * - Uses absolute positioning within a relative wrapper
 * - Labels positioned independently of flex/grid layout
 */
export function TypeFormLinearScale({
  value,
  onChange,
  onSubmit,
  config,
  disabled = false,
  required = false,
  ariaLabel,
  ariaDescribedBy,
  showKeyboardHints = true,
}: TypeFormLinearScaleProps) {
  const { start, end, step, startLabel, endLabel } = config;

  // Generate scale values
  const values: number[] = [];
  for (let i = start; i <= end; i += step) {
    values.push(i);
  }

  const handleValueChange = useCallback(
    (newValue: number) => {
      onChange(newValue);
      // REMOVED: No longer calls onSubmit directly.
      // The parent component's useEffect will handle auto-advancing.
    },
    [onChange],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (disabled) return;

      let newValue: number | null = null;

      switch (e.key) {
        case "Home":
          e.preventDefault();
          newValue = start;
          break;

        case "End":
          e.preventDefault();
          newValue = end;
          break;

        case "Enter":
        case " ":
          e.preventDefault();
          if (onSubmit && value !== null) {
            onSubmit();
          }
          break;

        default:
          // Number key shortcuts (1-9, 0)
          const numKey = parseInt(e.key);
          if (!isNaN(numKey) && numKey >= 0 && numKey <= 9) {
            e.preventDefault();
            // Map number keys to scale values when reasonable
            if (values.length <= 10) {
              const targetIndex = numKey === 0 ? 9 : numKey - 1;
              if (
                targetIndex < values.length &&
                values[targetIndex] !== undefined
              ) {
                newValue = values[targetIndex];
              }
            }
          }
          break;
      }

      if (newValue !== null) {
        handleValueChange(newValue);
      }
    },
    [disabled, value, start, end, step, values, handleValueChange, onSubmit],
  );

  return (
    <motion.div
      className="w-full max-w-2xl"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="slider"
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
        aria-valuemin={start}
        aria-valuemax={end}
        aria-valuenow={value || undefined}
        aria-disabled={disabled}
        className={cn(
          "outline-none focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-4 rounded-xl",
          disabled && "opacity-50 cursor-not-allowed",
        )}
      >
        {/* Scale buttons with individual containers for precise label alignment */}
        <div className="py-4">
          <div className="flex items-center justify-start gap-2 md:gap-3">
            {values.map((scaleValue, index) => {
              const isFirst = index === 0;
              const isLast = index === values.length - 1;
              const shouldShowStartLabel = isFirst && startLabel;
              const shouldShowEndLabel = isLast && endLabel;

              return (
                <div
                  key={scaleValue}
                  className="relative flex flex-col items-center"
                >
                  {/* Button */}
                  <button
                    type="button"
                    onClick={() => !disabled && handleValueChange(scaleValue)}
                    disabled={disabled}
                    className={cn(
                      // Base styles
                      "flex items-center justify-center",
                      "w-12 h-12 md:w-14 md:h-14 lg:w-16 lg:h-16",
                      "rounded-lg border-2 transition-all duration-200",
                      "text-lg md:text-xl lg:text-2xl font-medium",

                      // State styles
                      value === scaleValue
                        ? "bg-primary text-primary-foreground border-primary shadow-md"
                        : "bg-background text-foreground border-border hover:border-primary/50 hover:bg-muted",

                      // Disabled styles
                      disabled && "opacity-50 cursor-not-allowed",

                      // Focus styles
                      "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
                    )}
                    aria-pressed={value === scaleValue}
                    aria-label={`${scaleValue}${shouldShowStartLabel ? ` - ${startLabel}` : ""}${shouldShowEndLabel ? ` - ${endLabel}` : ""}`}
                  >
                    {scaleValue}
                  </button>

                  {/* Label positioned to align with button edges, not center */}
                  {(shouldShowStartLabel || shouldShowEndLabel) && (
                    <div
                      className={cn(
                        "absolute top-full mt-3 text-xs text-muted-foreground leading-tight",
                        shouldShowStartLabel && "left-0",
                        shouldShowEndLabel && "right-0",
                      )}
                    >
                      {shouldShowStartLabel && (
                        <div className="whitespace-nowrap">{startLabel}</div>
                      )}
                      {shouldShowEndLabel && (
                        <div className="whitespace-nowrap">{endLabel}</div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Keyboard hints */}
      {showKeyboardHints && (
        <div className="mt-4 text-sm text-muted-foreground">
          Use <kbd className="px-1 py-0.5 text-xs border rounded">1</kbd>-
          {Math.min(values.length, 9)} for quick selection, or{" "}
          <kbd className="px-1 py-0.5 text-xs border rounded">Enter ↵</kbd> to
          continue
        </div>
      )}
    </motion.div>
  );
}
