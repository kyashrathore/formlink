"use client";

import React from "react";
import {
  BaseLinearScale,
  LinearScaleConfig,
} from "../../primitives/BaseLinearScale";
import { cn } from "../../../lib/utils";

export type FormMode = "chat" | "typeform";

export interface UnifiedLinearScaleProps {
  mode: FormMode;
  value: number | null;
  onChange: (value: number | null) => void;
  onSubmit?: () => void;
  config: LinearScaleConfig;
  disabled?: boolean;
  required?: boolean;
  showKeyboardHints?: boolean;
  className?: string;
  density?: "compact" | "comfy" | "spacious";
  autoSubmitOnChange?: boolean;
}

export function UnifiedLinearScale({
  mode,
  value,
  onChange,
  onSubmit,
  config,
  disabled = false,
  required = false,
  showKeyboardHints,
  className,
  density,
  autoSubmitOnChange,
}: UnifiedLinearScaleProps) {
  const resolvedDensity = density ?? (mode === "chat" ? "compact" : "comfy");
  const shouldShowKeyboardHints = showKeyboardHints ?? mode === "typeform";

  const {
    scaleValues,
    getOptionProps,
    isSelected,
    errors,
    isTouched,
    containerProps,
  } = BaseLinearScale({
    value,
    onChange,
    disabled,
    required,
    config,
    onSubmit,
    autoSubmitOnChange: autoSubmitOnChange ?? mode === "typeform",
  });

  const showError = isTouched && errors.length > 0;

  // Handle container-level keyboard navigation (unified)
  const handleContainerKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    const currentIndex = value !== null ? scaleValues.indexOf(value) : -1;
    let newValue: number | null = null;

    switch (e.key) {
      case "ArrowLeft":
      case "ArrowUp":
        e.preventDefault();
        if (currentIndex > 0) {
          newValue = scaleValues[currentIndex - 1] ?? null;
        } else if (currentIndex === -1 && scaleValues.length > 0) {
          newValue = scaleValues[0] ?? null;
        }
        break;
      case "ArrowRight":
      case "ArrowDown":
        e.preventDefault();
        if (currentIndex < scaleValues.length - 1 && currentIndex !== -1) {
          newValue = scaleValues[currentIndex + 1] ?? null;
        } else if (currentIndex === -1 && scaleValues.length > 0) {
          newValue = scaleValues[0] ?? null;
        }
        break;
      default: {
        // Handle number keys
        const num = parseInt(e.key);
        if (!isNaN(num) && scaleValues.includes(num)) {
          e.preventDefault();
          newValue = num;
        }
        break;
      }
    }

    if (newValue !== null) {
      onChange(newValue);
    }
  };

  // Unified styling driven by density
  const containerClass = cn(
    resolvedDensity === "compact"
      ? "space-y-3"
      : resolvedDensity === "comfy"
        ? "space-y-4"
        : "space-y-6",
  );
  const innerContainerClass = "flex flex-col gap-4";
  const buttonsContainerClass = "flex gap-2 sm:gap-3 justify-start flex-wrap";
  const buttonClass = cn(
    "relative rounded-lg font-medium transition-all",
    "border-2 border-border/50 bg-card/50",
    "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
    "flex items-center justify-center",
    "hover:border-primary/50 hover:bg-card/80",
    resolvedDensity === "compact" && "min-w-[36px] h-10 px-2 text-base",
    resolvedDensity === "comfy" && "min-w-[48px] h-12 px-3 text-base",
    resolvedDensity === "spacious" && "min-w-[64px] h-16 px-4 text-lg",
  );
  const labelsClass =
    "flex justify-between text-sm text-muted-foreground px-2 sm:px-4";
  const errorClass = "text-sm text-destructive mt-2";

  return (
    <div className={cn(containerClass, className)}>
      <div
        {...containerProps}
        onKeyDown={handleContainerKeyDown}
        className={innerContainerClass}
      >
        {/* Scale buttons */}
        <div className={buttonsContainerClass}>
          {scaleValues.map((scaleValue) => (
            <button
              key={scaleValue}
              {...getOptionProps(scaleValue)}
              className={cn(
                buttonClass,
                isSelected(scaleValue) &&
                  "border-primary bg-primary/10 hover:bg-primary/15",
                disabled &&
                  "opacity-50 cursor-not-allowed hover:bg-card/50 hover:border-border/50",
              )}
            >
              {scaleValue}
            </button>
          ))}
        </div>

        {/* Labels */}
        {(config.startLabel || config.endLabel) && (
          <div className={labelsClass}>
            {config.startLabel && <span>{config.startLabel}</span>}
            {config.endLabel && (
              <span className="text-right">{config.endLabel}</span>
            )}
          </div>
        )}
      </div>

      {showError && errors[0] && (
        <p className={errorClass}>{errors[0].message}</p>
      )}

      {/* Chat mode: Keyboard hints */}
      {mode === "chat" && shouldShowKeyboardHints && !disabled && !isMobile && (
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          Use{" "}
          <kbd className="px-1.5 py-0.5 text-xs bg-muted text-muted-foreground rounded border border-border/50">
            ←→
          </kbd>{" "}
          or{" "}
          <kbd className="px-1.5 py-0.5 text-xs bg-muted text-muted-foreground rounded border border-border/50">
            1-{scaleValues.length}
          </kbd>
        </div>
      )}
    </div>
  );
}
