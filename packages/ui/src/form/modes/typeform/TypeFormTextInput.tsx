import React from 'react';
import { motion } from 'motion/react';
import { BaseTextInput } from '../../primitives/BaseTextInput';
import { useThemeStyles } from '../../../hooks/ui/useTheme';
import { getTypeFormAnimations } from '../shared/animations';
import { cn } from '../../../lib/utils';

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
}: TypeFormTextInputProps) {
  // Use the primitive for all logic
  const base = BaseTextInput({
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
  const styles = useThemeStyles('textInput', 'typeform');
  
  // Handle Enter key for submission (typeform mode specific)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    base.inputProps.onKeyDown?.(e);
    if (e.key === 'Enter' && !e.shiftKey && onSubmit) {
      e.preventDefault();
      onSubmit();
    }
  };
  
  const showError = base.isTouched && base.errors.length > 0;
  
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
          showError && "border-destructive",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      />
      
      {showError && (
        <p className="text-sm text-destructive mt-2">
          {base.errors[0]?.message}
        </p>
      )}
      
      {showEnterHint && !showError && (
        <div className={cn(styles.hint)}>
          Press <kbd className="px-2 py-1 text-xs font-medium bg-muted/50 text-muted-foreground rounded border border-border">
            Enter ↵
          </kbd> to continue
        </div>
      )}
    </motion.div>
  );
}