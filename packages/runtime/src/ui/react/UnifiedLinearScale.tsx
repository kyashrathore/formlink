"use client";

import { useLinearScale } from "@/headless/react/hooks/useLinearScale";
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

  // Avoid passing `null` to Array.includes which expects `number`.
  const selectedValid = value !== null && scaleValues.includes(value);
  const showError = required && touched && !selectedValid;

  const ls = useLinearScale({
    value,
    onChange: (n) => {
      if (disabled) return;
      setTouched(true);
      onChange(n);
    },
    start: config.start,
    end: config.end,
    step: config.step,
    showKeyboardHints:
      mode !== "typeform"
        ? (showKeyboardHints ?? true)
        : (showKeyboardHints ?? false),
    autoAdvanceOnClick: submitOnChange,
    onAutoAdvance: onSubmit,
  });

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
        {...ls.containerProps}
        aria-required={required}
        aria-disabled={disabled}
        className="flex flex-col gap-4"
      >
        <div className="flex gap-2 sm:gap-3 justify-start flex-wrap">
          {scaleValues.map((scaleValue, idx) => {
            const isSelected = value === scaleValue;
            return (
              <button
                {...ls.getItemProps(idx)}
                key={scaleValue}
                type="button"
                aria-checked={isSelected}
                disabled={disabled}
                className={cx(
                  buttonBaseClass,
                  buttonSize,
                  mode === "typeform" ? "h-14 min-w-[56px] text-base" : null,
                  isSelected
                    ? "border-primary bg-primary/10 hover:bg-primary/15"
                    : "group",
                  disabled
                    ? "opacity-50 cursor-not-allowed hover:bg-card/50 hover:border-border/50"
                    : null,
                )}
              >
                <span
                  className={cx(
                    "px-1 pb-0.5 border-b-2 border-transparent",
                    // underline on focus
                    "group-focus:border-primary",
                    isSelected ? "border-primary" : null,
                  )}
                >
                  {scaleValue}
                </span>
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
