"use client";

import * as React from "react";
import { motion } from "motion/react";

export type FormMode = "chat" | "typeform";

export interface UnifiedLikertProps {
  mode: FormMode;
  options: string[];
  value: string | null;
  onChange: (value: string | null) => void;
  onSubmit?: () => void;
  disabled?: boolean;
  required?: boolean;
  showKeyboardHints?: boolean;
  className?: string;
  density?: "compact" | "comfy" | "spacious";
  debug?: boolean;
}

type Density = NonNullable<UnifiedLikertProps["density"]>;

function cx(...classes: Array<string | null | undefined | false>): string {
  return classes.filter(Boolean).join(" ");
}

function getPadding(mode: FormMode, density: Density): string {
  if (mode === "typeform") {
    switch (density) {
      case "compact":
        return "py-2 px-3";
      case "comfy":
        return "py-3 px-4";
      case "spacious":
      default:
        return "py-4 px-5";
    }
  }
  switch (density) {
    case "compact":
      return "py-2 px-3";
    case "comfy":
      return "py-3 px-4";
    case "spacious":
    default:
      return "py-4 px-5";
  }
}

function getResolvedDensity(mode: FormMode, density?: Density): Density {
  if (density) return density;
  return mode === "chat" ? "compact" : "spacious";
}

export function UnifiedLikert({
  mode,
  options,
  value,
  onChange,
  onSubmit,
  disabled = false,
  required = false,
  showKeyboardHints,
  className,
  density,
  debug = false,
}: UnifiedLikertProps) {
  const resolvedDensity = getResolvedDensity(mode, density);
  const hints = showKeyboardHints ?? mode === "typeform";
  const [touched, setTouched] = React.useState(false);
  const [highlightedIndex, setHighlightedIndex] = React.useState<number | null>(
    null,
  );
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!value) {
      setHighlightedIndex(null);
      return;
    }
    const idx = options.findIndex((opt) => opt === value);
    setHighlightedIndex(idx === -1 ? null : idx);
  }, [options, value]);

  const logDebug = React.useCallback(
    (message: string, payload?: Record<string, unknown>) => {
      if (!debug) return;
      try {
        console.debug(`[UnifiedLikert][${mode}] ${message}`, payload);
      } catch {
        /* ignore logging failures */
      }
    },
    [debug, mode],
  );

  const selectIndex = React.useCallback(
    (index: number) => {
      const option = options[index];
      if (!option || disabled) return;
      setTouched(true);
      logDebug("select", { index, option });
      onChange(option);
      if (mode === "typeform") {
        // Allow the UI to render selection before submit
        setTimeout(() => onSubmit?.(), 16);
      }
    },
    [disabled, logDebug, mode, onChange, onSubmit, options],
  );

  const clearSelection = React.useCallback(() => {
    if (disabled) return;
    setTouched(true);
    onChange(null);
  }, [disabled, onChange]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    const currentIndex = value ? options.indexOf(value) : -1;
    switch (event.key) {
      case "ArrowUp":
      case "ArrowLeft": {
        event.preventDefault();
        const nextIndex =
          currentIndex > 0 ? currentIndex - 1 : options.length - 1;
        selectIndex(Math.max(0, nextIndex));
        break;
      }
      case "ArrowDown":
      case "ArrowRight": {
        event.preventDefault();
        const nextIndex =
          currentIndex >= 0 && currentIndex < options.length - 1
            ? currentIndex + 1
            : 0;
        selectIndex(nextIndex);
        break;
      }
      case "Escape": {
        event.preventDefault();
        clearSelection();
        break;
      }
      default: {
        if (/^[0-9]$/.test(event.key)) {
          const numericIndex = Number(event.key) - 1;
          if (numericIndex >= 0 && numericIndex < options.length) {
            event.preventDefault();
            selectIndex(numericIndex);
          }
        }
      }
    }
  };

  const radiusClass =
    mode === "typeform" ? "rounded-lg" : "rounded-lg border-2";

  const containerClass =
    mode === "typeform" ? "w-full max-w-2xl space-y-3" : "space-y-2";

  const showError =
    required && touched && (!value || value.trim().length === 0);

  return (
    <div
      ref={containerRef}
      role="radiogroup"
      aria-required={required}
      aria-disabled={disabled}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className={cx(containerClass, className)}
      data-unified-likert-mode={mode}
    >
      {options.map((option, index) => {
        const isSelected = option === value;
        const isHighlighted =
          highlightedIndex !== null && highlightedIndex === index;
        const padding = getPadding(mode, resolvedDensity);
        const motionProps =
          mode === "typeform"
            ? { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 } }
            : { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 } };
        return (
          <motion.button
            key={option}
            type="button"
            {...motionProps}
            transition={{ delay: index * 0.05, duration: 0.2 }}
            role="radio"
            aria-checked={isSelected}
            aria-disabled={disabled}
            disabled={disabled}
            className={cx(
              "w-full text-left transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
              radiusClass,
              padding,
              mode === "typeform"
                ? isSelected
                  ? "bg-primary/10 border-2 border-primary"
                  : "bg-muted/30 border border-border/50 hover:bg-muted/60 hover:border-border"
                : isSelected
                  ? "bg-primary/10 border-primary"
                  : "border-border/50 bg-card hover:border-primary/50 hover:bg-muted/50",
              mode !== "typeform" && isHighlighted && !isSelected
                ? "border-primary"
                : null,
              disabled ? "opacity-50 cursor-not-allowed" : null,
            )}
            onMouseEnter={() => {
              if (disabled) return;
              setHighlightedIndex(index);
            }}
            onMouseLeave={() => {
              if (disabled) return;
              setHighlightedIndex(null);
            }}
            onClick={() => selectIndex(index)}
          >
            <span
              className={cx(
                "block text-sm",
                isSelected ? "font-medium text-foreground" : "text-foreground",
              )}
            >
              {option}
            </span>
          </motion.button>
        );
      })}
      {hints && !disabled && (
        <div className="text-sm text-muted-foreground">
          Use number keys or arrow keys to select
        </div>
      )}
      {showError && (
        <p className="text-sm text-destructive">
          Please choose an option to continue
        </p>
      )}
    </div>
  );
}
