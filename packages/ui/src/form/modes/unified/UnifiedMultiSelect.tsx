"use client";

import React from "react";
import { motion } from "motion/react";
import {
  BaseMultiSelect,
  type BaseMultiSelectProps,
} from "../../primitives/BaseMultiSelect";
import { cn } from "../../../lib/utils";
import { Button } from "../../../ui/button";
import { ArrowRight } from "lucide-react";
import { getChatAnimations } from "../shared/animations";
import { getTypeFormAnimations } from "../shared/animations";
import { filterMultiSelectContainerProps } from "../../primitives/patches/accessibility-fixes";

export type FormMode = "chat" | "typeform";

export interface UnifiedMultiSelectProps extends BaseMultiSelectProps {
  mode: FormMode;
  onSubmit?: () => void;
  showSelectionCount?: boolean;
  showKeyboardHints?: boolean;
  className?: string;
}

export function UnifiedMultiSelect(props: UnifiedMultiSelectProps) {
  const {
    mode,
    onSubmit,
    showSelectionCount = true,
    className,
    ...baseProps
  } = props;

  const base = BaseMultiSelect<string>({
    enableShortcuts: true,
    enableArrowNavigation: true,
    // Mode-specific behavior: typeform auto-submits, chat requires manual submit
    autoSubmitOnChange: mode === "typeform",
    ...baseProps,
    value: baseProps.value || [],
  });

  // Safe access with fallbacks
  const options = base.options || [];
  const selectedValues = base.value || [];

  // Track if form has been submitted (chat mode only)
  const [isSubmitted, setIsSubmitted] = React.useState(false);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    // Let base handle navigation, only handle Enter for submission
    base.getContainerProps().onKeyDown?.(e);

    if (
      e.key === "Enter" &&
      !e.defaultPrevented &&
      onSubmit &&
      selectedValues.length > 0
    ) {
      e.preventDefault();
      if (mode === "chat") {
        setIsSubmitted(true);
      }
      onSubmit();
    }
  };

  const handleSubmit = () => {
    if (onSubmit && selectedValues.length > 0) {
      if (mode === "chat") {
        setIsSubmitted(true);
      }
      onSubmit();
    }
  };

  // Chat mode: Hide component after submission (show null)
  if (mode === "chat" && isSubmitted) {
    return null;
  }

  if (mode === "typeform") {
    // TypeForm layout and behavior
    const containerProps = base.getContainerProps();
    const {
      "aria-required": ariaRequired,
      "aria-invalid": ariaInvalid,
      "aria-disabled": ariaDisabled,
      "aria-describedby": ariaDescribedBy,
      onKeyDown: _baseKeyDown,
      tabIndex,
      id,
      ..._restContainerProps
    } = containerProps;

    return (
      <div
        id={id}
        tabIndex={tabIndex}
        role="group"
        aria-label={baseProps.ariaLabel}
        aria-describedby={ariaDescribedBy}
        className={cn("space-y-3", className)}
        onKeyDown={handleKeyDown}
      >
        <div
          role="listbox"
          aria-multiselectable="true"
          aria-label={baseProps.ariaLabel}
          aria-required={ariaRequired}
          aria-invalid={ariaInvalid}
          aria-disabled={ariaDisabled}
          className="space-y-3"
        >
          {options.map((option, index) => {
            const shortcutKey = String.fromCharCode(65 + index); // A, B, C, etc.

            return (
              <motion.div
                key={option.value}
                role={option.props.role}
                aria-selected={option.props["aria-selected"]}
                aria-disabled={option.props["aria-disabled"]}
                tabIndex={option.props.tabIndex}
                {...getTypeFormAnimations(index)}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer transition-all duration-200",
                  option.isSelected
                    ? "bg-primary/10 border-2 border-primary"
                    : "bg-muted/30 border border-border/50 hover:bg-muted/60 hover:border-border",
                  option.disabled && "opacity-50 cursor-not-allowed",
                )}
                onClick={() =>
                  !option.disabled && base.toggleOption(option.value)
                }
              >
                {/* Letter indicator */}
                <div
                  className={cn(
                    "flex items-center justify-center w-8 h-8 rounded text-sm font-semibold",
                    option.isSelected
                      ? "bg-primary text-primary-foreground"
                      : "bg-background text-primary border border-primary",
                  )}
                >
                  {shortcutKey}
                </div>

                {/* Option label */}
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

                {/* Check icon for selected */}
                {option.isSelected && (
                  <svg
                    className="w-5 h-5 text-primary"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </motion.div>
            );
          })}
        </div>

        {showSelectionCount && selectedValues.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-muted-foreground text-sm mt-2"
          >
            {selectedValues.length} selected
          </motion.div>
        )}

        {/* TypeForm mode: No manual submit button - auto-submits immediately via autoSubmitOnChange */}
      </div>
    );
  }

  // Chat layout and behavior
  return (
    <div
      {...filterMultiSelectContainerProps(base.getContainerProps())}
      className={cn("space-y-3 focus:outline-none", className)}
      onKeyDown={handleKeyDown}
    >
      {/* Options list */}
      <div className="space-y-3">
        {options.map((option, index) => (
          <motion.button
            key={option.value}
            type="button"
            role="button"
            aria-pressed={option.isSelected}
            aria-disabled={option.disabled}
            disabled={option.disabled}
            onClick={() => !option.disabled && base.toggleOption(option.value)}
            {...getChatAnimations(index)}
            className={cn(
              "group flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all duration-200 w-full text-left",
              option.isSelected
                ? "bg-primary/10 border-primary"
                : "border-border/50 bg-card hover:border-primary/50 hover:bg-muted/50",
              option.isHighlighted &&
                !option.isSelected &&
                "ring-2 ring-primary ring-offset-2",
              option.disabled &&
                "opacity-50 cursor-not-allowed hover:bg-card hover:border-border/50",
            )}
          >
            {/* Custom checkbox-like element */}
            <input
              type="checkbox"
              role="checkbox"
              checked={option.isSelected}
              onChange={() => {}}
              aria-label={option.label}
              className="sr-only"
            />
            <div
              className={cn(
                "flex items-center justify-center w-5 h-5 border-2 rounded transition-all duration-200",
                "group-hover:scale-105",
                option.isSelected
                  ? "bg-primary border-primary"
                  : "border-input bg-transparent group-hover:border-primary/50",
              )}
              aria-hidden="true"
            >
              {option.isSelected && (
                <motion.svg
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.15 }}
                  className="w-3 h-3 text-primary-foreground"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </motion.svg>
              )}
            </div>

            <span
              className={cn(
                "flex-1 text-sm",
                option.disabled && "text-muted-foreground",
              )}
            >
              {option.label}
            </span>
          </motion.button>
        ))}
      </div>

      {/* Selection count */}
      {showSelectionCount && (
        <div className="flex items-center justify-between text-sm text-muted-foreground px-1">
          <span>
            {selectedValues.length} selected
            {props.maxSelections && ` of ${props.maxSelections}`}
          </span>
        </div>
      )}

      {/* Submit button for chat mode */}
      {onSubmit && selectedValues.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex items-center mt-4"
        >
          <Button onClick={handleSubmit} size="lg" className="group">
            Continue
            <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Button>
        </motion.div>
      )}
    </div>
  );
}
