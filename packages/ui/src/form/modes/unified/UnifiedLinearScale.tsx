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
}: UnifiedLinearScaleProps) {
  // Set default showKeyboardHints based on mode
  const shouldShowKeyboardHints =
    showKeyboardHints ?? (mode === "typeform" ? true : false);

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
    // Mode-specific behavior: typeform auto-submits, chat requires manual submit
    autoSubmitOnChange: mode === "typeform",
  });

  const showError = isTouched && errors.length > 0;

  // Chat mode: Handle container-level keyboard navigation
  const handleContainerKeyDown = (e: React.KeyboardEvent) => {
    if (disabled || mode !== "chat") return;

    const currentIndex = value !== null ? scaleValues.indexOf(value) : -1;
    let newValue: number | null = null;

    switch (e.key) {
      case "ArrowLeft":
      case "ArrowUp":
        e.preventDefault();
        if (currentIndex > 0) {
          newValue = scaleValues[currentIndex - 1];
        } else if (currentIndex === -1 && scaleValues.length > 0) {
          newValue = scaleValues[0];
        }
        break;
      case "ArrowRight":
      case "ArrowDown":
        e.preventDefault();
        if (currentIndex < scaleValues.length - 1 && currentIndex !== -1) {
          newValue = scaleValues[currentIndex + 1];
        } else if (currentIndex === -1 && scaleValues.length > 0) {
          newValue = scaleValues[0];
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

  // Mode-specific styling
  const containerClass = mode === "chat" ? "space-y-4" : "w-full max-w-2xl";
  const innerContainerClass =
    mode === "chat" ? "flex flex-col gap-4" : "flex flex-col gap-6";
  const buttonsContainerClass =
    mode === "chat" ? "flex gap-2 justify-center" : "flex gap-3 justify-start";
  const buttonClass =
    mode === "chat"
      ? cn(
          "relative min-w-[48px] h-12 px-3 rounded-lg font-medium transition-all",
          "border-2 border-border/50 bg-card/50",
          "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
          "flex items-center justify-center text-base",
          "hover:border-primary/50 hover:bg-card/80",
        )
      : cn(
          "relative min-w-[64px] h-16 px-4 rounded-lg font-medium transition-all text-lg",
          "border-2 border-border/50 bg-card/50",
          "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
          "flex items-center justify-center",
          "hover:border-primary/50 hover:bg-card/80",
        );
  const labelsClass =
    mode === "chat"
      ? "flex justify-between text-sm text-muted-foreground px-2"
      : "flex justify-between text-sm text-muted-foreground px-4";
  const errorClass =
    mode === "chat"
      ? "text-sm text-destructive text-center"
      : "text-sm text-destructive text-left mt-4";

  return (
    <div className={containerClass}>
      <div
        {...containerProps}
        onKeyDown={
          mode === "chat" ? handleContainerKeyDown : containerProps.onKeyDown
        }
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
      {mode === "chat" && shouldShowKeyboardHints && !disabled && (
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
