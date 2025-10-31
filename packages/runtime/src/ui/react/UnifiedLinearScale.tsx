"use client";

import * as React from "react";
import { useIsMobile } from "./hooks/use-mobile";

export type FormMode = "chat" | "typeform";

export interface LinearScaleConfig {
  start: number;
  end: number;
  step: number;
  startLabel?: string;
  endLabel?: string;
}

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

type Density = NonNullable<UnifiedLinearScaleProps["density"]>;

function cx(...classes: Array<string | null | undefined | false>): string {
  return classes.filter(Boolean).join(" ");
}

function getDensitySpacing(density: Density | undefined, mode: FormMode) {
  const resolved =
    density ??
    (mode === "chat" ? ("compact" as Density) : ("comfy" as Density));
  switch (resolved) {
    case "compact":
      return {
        container: "space-y-3",
        buttonSize: "min-w-[36px] h-10 px-2 text-base",
      };
    case "comfy":
      return {
        container: "space-y-4",
        buttonSize: "min-w-[48px] h-12 px-3 text-base",
      };
    case "spacious":
    default:
      return {
        container: "space-y-6",
        buttonSize: "min-w-[64px] h-16 px-4 text-lg",
      };
  }
}

function buildScaleValues(config: LinearScaleConfig): number[] {
  const { start, end, step } = config;
  if (step <= 0) return [];
  const values: number[] = [];
  if (start <= end) {
    for (let current = start; current <= end; current += step) {
      values.push(current);
    }
  } else {
    for (let current = start; current >= end; current -= step) {
      values.push(current);
    }
  }
  return values;
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
  const isMobile = useIsMobile();
  const submitOnChange =
    autoSubmitOnChange !== undefined ? autoSubmitOnChange : mode === "typeform";
  const { container, buttonSize } = getDensitySpacing(density, mode);

  const scaleValues = React.useMemo(() => buildScaleValues(config), [config]);

  const [touched, setTouched] = React.useState(false);

  const showError =
    required && touched && (value === null || !scaleValues.includes(value));

  const containerRef = React.useRef<HTMLDivElement | null>(null);

  const handleSelect = (nextValue: number) => {
    if (disabled) return;
    setTouched(true);
    onChange(nextValue);
    if (submitOnChange) {
      setTimeout(() => onSubmit?.(), 16);
    }
  };

  const handleContainerKeyDown = (
    event: React.KeyboardEvent<HTMLDivElement>,
  ) => {
    if (disabled) return;
    const currentIndex = value !== null ? scaleValues.indexOf(value) : -1;
    switch (event.key) {
      case "ArrowLeft":
      case "ArrowUp": {
        event.preventDefault();
        const next =
          currentIndex > 0
            ? scaleValues[currentIndex - 1]
            : scaleValues[scaleValues.length - 1];
        if (next !== undefined) handleSelect(next);
        break;
      }
      case "ArrowRight":
      case "ArrowDown": {
        event.preventDefault();
        const next =
          currentIndex >= 0 && currentIndex < scaleValues.length - 1
            ? scaleValues[currentIndex + 1]
            : scaleValues[0];
        if (next !== undefined) handleSelect(next);
        break;
      }
      case "Escape": {
        event.preventDefault();
        setTouched(true);
        onChange(null);
        break;
      }
      default: {
        if (/^[0-9]$/.test(event.key)) {
          const numeric = Number(event.key);
          if (scaleValues.includes(numeric)) {
            event.preventDefault();
            handleSelect(numeric);
          }
        }
      }
    }
  };

  const buttonBaseClass =
    "relative rounded-lg font-medium transition-all border border-border/50 bg-card/50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 flex items-center justify-center hover:border-primary/50 hover:bg-card/80";

  const shouldShowHints =
    mode === "chat" &&
    (showKeyboardHints ?? true) &&
    !disabled &&
    !isMobile &&
    scaleValues.length > 0;

  return (
    <div
      className={cx(container, className)}
      data-unified-linear-scale-mode={mode}
    >
      <div
        ref={containerRef}
        role="radiogroup"
        aria-required={required}
        aria-disabled={disabled}
        tabIndex={0}
        onKeyDown={handleContainerKeyDown}
        className="flex flex-col gap-4"
      >
        <div className="flex gap-2 sm:gap-3 justify-start flex-wrap">
          {scaleValues.map((scaleValue) => {
            const isSelected = value === scaleValue;
            return (
              <button
                key={scaleValue}
                type="button"
                role="radio"
                aria-checked={isSelected}
                disabled={disabled}
                className={cx(
                  buttonBaseClass,
                  buttonSize,
                  mode === "typeform" ? "h-14 min-w-[56px] text-base" : null,
                  isSelected
                    ? "border-primary bg-primary/10 hover:bg-primary/15"
                    : null,
                  disabled
                    ? "opacity-50 cursor-not-allowed hover:bg-card/50 hover:border-border/50"
                    : null,
                )}
                onClick={() => handleSelect(scaleValue)}
              >
                {scaleValue}
              </button>
            );
          })}
        </div>

        {(config.startLabel || config.endLabel) && (
          <div className="flex justify-between text-sm text-muted-foreground px-2 sm:px-4">
            <span>{config.startLabel}</span>
            <span className="text-right">{config.endLabel}</span>
          </div>
        )}
      </div>

      {showError && (
        <p className="text-sm text-destructive mt-2">
          Please choose a value to continue
        </p>
      )}

      {shouldShowHints && (
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
