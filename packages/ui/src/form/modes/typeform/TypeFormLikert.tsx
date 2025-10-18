"use client";

import { motion } from "motion/react";
import { cn } from "../../../lib/utils";
import { useBaseSelect } from "../../primitives/useBaseSelect";
import { getTypeFormAnimations } from "../shared/animations";

/**
 * TypeFormLikert
 * - Renders labeled Likert options (e.g., Strongly Disagree ... Strongly Agree) as large selectable rows
 * - Uses BaseSelect for a11y/keyboard/selection logic
 * - Auto-advances when onSubmit provided (Typeform pattern)
 */
export interface TypeFormLikertProps {
  options: string[];
  value: string | null;
  onChange: (value: string | null) => void;
  onSubmit?: () => void;
  disabled?: boolean;
  required?: boolean;
  showKeyboardHints?: boolean;
  className?: string;
}

export function TypeFormLikert(props: TypeFormLikertProps) {
  const {
    options,
    value,
    onChange,
    onSubmit,
    disabled = false,
    required = false,
    showKeyboardHints = true,
    className,
  } = props;

  const base = useBaseSelect({
    options: options.map((label) => ({ value: label, label })),
    value,
    onChange,
    disabled,
    required,
    // We control auto-advance manually to sync with Typeform animations
    autoSubmitOnChange: false,
    a11yContainerRole: "group",
    a11yHasPopup: false,
    a11yIncludeExpanded: false,
  });

  const processedOptions = base.options || [];

  const handleOptionClick = (val: string) => {
    base.selectOption(val);
    if (onSubmit) {
      setTimeout(() => onSubmit(), 300);
    }
  };

  const containerProps = base.getContainerProps();

  return (
    <div
      {...containerProps}
      className={cn("space-y-3 w-full max-w-2xl", className)}
    >
      {processedOptions.map((option, index) => {
        // Number key shortcuts (1..N) - for visual hint only
        const shortcutKey = index < 9 ? (index + 1).toString() : null;

        return (
          <motion.button
            key={option.value}
            type="button"
            {...getTypeFormAnimations(index)}
            className={cn(
              "w-full text-left px-4 py-3 rounded-lg border transition-all duration-200",
              option.isSelected
                ? "bg-primary/10 border-2 border-primary"
                : "bg-muted/30 border border-border/50 hover:bg-muted/60 hover:border-border",
              option.disabled && "opacity-50 cursor-not-allowed",
              "flex items-center gap-3",
            )}
            onClick={() =>
              !option.disabled && handleOptionClick(String(option.value))
            }
            aria-selected={option.isSelected}
            aria-disabled={option.disabled}
            tabIndex={option.props.tabIndex}
          >
            {showKeyboardHints && shortcutKey && (
              <span
                className={cn(
                  "inline-flex items-center justify-center w-6 h-6 rounded text-xs font-semibold",
                  option.isSelected
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-primary border border-primary",
                )}
              >
                {shortcutKey}
              </span>
            )}
            <span
              className={cn(
                "flex-1 text-base",
                option.isSelected
                  ? "text-foreground font-medium"
                  : "text-foreground",
              )}
            >
              {option.label}
            </span>
          </motion.button>
        );
      })}
      {base.isTouched && base.errors.length > 0 && (
        <p className="text-sm text-destructive">{base.errors[0]?.message}</p>
      )}
    </div>
  );
}
