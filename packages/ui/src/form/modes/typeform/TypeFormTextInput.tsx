import { motion } from "motion/react";
import React from "react";
import { useThemeStyles } from "../../../hooks/ui/useTheme";
import { cn } from "../../../lib/utils";
import { useBaseTextInput } from "../../primitives/useBaseTextInput";
import { getTypeFormAnimations } from "../shared/animations";

export interface TypeFormTextInputProps {
  value: string | null;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  maxLength?: number;
  minLength?: number;
  pattern?: string;
  type?: string;
  showEnterHint?: boolean;
  onValidate?: (value: string) => Array<{ type: string; message: string }>;
  ariaLabel?: string;
  isInvalid?: boolean; // New prop to control submission
}

/**
 * TypeFormTextInput - Thin wrapper around BaseTextInput
 *
 * This component demonstrates the new architecture:
 * - BaseTextInput handles all core logic
 * - This component only adds TypeForm-specific styling and behavior
 * - Minimal code duplication, maximum reusability
 */
export function TypeFormTextInput({
  value,
  onChange,
  onSubmit,
  placeholder = "Type your answer...",
  disabled = false,
  required = false,
  maxLength,
  minLength,
  pattern,
  type = "text",
  showEnterHint = true,
  onValidate,
  ariaLabel,
  isInvalid = false, // Default to false
}: TypeFormTextInputProps) {
  // Use the primitive for all logic
  const base = useBaseTextInput({
    value: value || "", // Convert null to empty string
    onChange,
    disabled,
    required,
    placeholder,
    type,
    maxLength,
    minLength,
    pattern,
    onSubmit,
    onValidate,
    ariaLabel,
    autoFocus: true, // TypeForm mode behavior: auto-focus
    autoSubmitOnChange: true, // TypeForm mode behavior: auto-submit
  });

  // Get typeform mode styles
  const styles = useThemeStyles("textInput", "typeform");

  // Handle Enter key for submission (typeform mode specific)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    base.inputProps.onKeyDown?.(e);
    if (e.key === "Enter" && !e.shiftKey && onSubmit) {
      e.preventDefault();
      // Only submit if the parent component says the input is valid
      if (!isInvalid) {
        onSubmit();
      }
    }
  };

  return (
    <motion.div
      className={cn(styles.container, "w-full max-w-2xl")}
      {...getTypeFormAnimations(0, true)} // Disable hover scale for text input
    >
      <input
        {...base.inputProps}
        onKeyDown={handleKeyDown}
        className={cn(
          styles.input,
          "h-16",
          disabled && "opacity-50 cursor-not-allowed",
        )}
      />
    </motion.div>
  );
}
