import React from "react";
import { motion } from "motion/react";
import { BaseSelect, type BaseSelectProps } from "../../primitives/BaseSelect";
import { getTypeFormAnimations } from "../shared/animations";

export interface TypeFormSelectProps extends BaseSelectProps {
  onSubmit?: () => void;
  autoAdvance?: boolean;
  showKeyboardHints?: boolean;
}

export function TypeFormSelect(props: TypeFormSelectProps) {
  const { onSubmit, autoAdvance = true, ...baseProps } = props;

  // Don't pass onSubmit to BaseSelect if we want to control auto-advance
  const safeBaseProps = {
    enableShortcuts: true,
    enableArrowNavigation: true,
    autoSubmitOnChange: true, // TypeForm mode uses auto-submission
    ...baseProps,
    onSubmit: autoAdvance ? undefined : onSubmit, // Only pass onSubmit if not auto-advancing
  };

  const base = BaseSelect(safeBaseProps);

  // Safe access with fallbacks
  const processedOptions = base.options || [];

  const handleOptionClick = (value: string | number) => {
    base.selectOption(value); // This will update the value but NOT call onSubmit

    if (autoAdvance && onSubmit) {
      // Auto-advance after selection with animation delay
      setTimeout(() => onSubmit(), 300);
    }
  };

  // Get container props and ensure proper ARIA attributes
  const containerProps = base.getContainerProps();

  return (
    <div {...containerProps} className="space-y-3">
      {processedOptions.map((option, index) => {
        const shortcutKey = String.fromCharCode(65 + index); // A, B, C, etc.

        return (
          <motion.div
            key={option.value}
            role={option.props.role}
            aria-selected={option.props["aria-selected"]}
            aria-disabled={option.props["aria-disabled"]}
            tabIndex={option.props.tabIndex}
            {...getTypeFormAnimations(index)}
            className={`
              flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer transition-all duration-200
              ${
                option.isSelected
                  ? "bg-primary/10 border-2 border-primary"
                  : "bg-muted/30 border border-border/50 hover:bg-muted/60 hover:border-border"
              }
              ${option.disabled ? "opacity-50 cursor-not-allowed" : ""}
            `}
            onClick={() => !option.disabled && handleOptionClick(option.value)}
          >
            {/* Letter indicator */}
            <div
              className={`
              flex items-center justify-center w-8 h-8 rounded text-sm font-semibold
              ${
                option.isSelected
                  ? "bg-primary text-primary-foreground"
                  : "bg-background text-primary border border-primary"
              }
            `}
            >
              {shortcutKey}
            </div>

            {/* Option label */}
            <span
              className={`
              flex-1 text-base
              ${option.isSelected ? "text-foreground font-medium" : "text-foreground"}
            `}
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
  );
}
