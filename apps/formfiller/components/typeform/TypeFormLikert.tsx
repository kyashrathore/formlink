"use client";

import { cn } from "@/lib";

export interface TypeFormLikertProps {
  options: string[];
  value: string | null;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  disabled?: boolean;
  required?: boolean;
  showKeyboardHints?: boolean;
  className?: string;
}

/**
 * Local Typeform Likert for Phase 0
 * - Simple, accessible list of large option rows
 * - No dependency on @formlink/ui internals to avoid cross-package type build issues
 */
export default function TypeFormLikert({
  options,
  value,
  onChange,
  onSubmit,
  disabled = false,
  required = false,
  showKeyboardHints = true,
  className,
}: TypeFormLikertProps) {
  const handleSelect = (val: string) => {
    if (disabled) return;
    onChange(val);
    if (onSubmit) {
      setTimeout(() => onSubmit(), 250);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // Numeric shortcuts 1..9 map to options[0..8]
    if (e.key >= "1" && e.key <= "9") {
      const index = parseInt(e.key, 10) - 1;
      const label = options[index];
      if (label && !disabled) {
        e.preventDefault();
        handleSelect(label);
      }
    }
  };

  return (
    <div
      className={cn(
        "space-y-3 w-full max-w-2xl pointer-events-auto",
        className,
      )}
      role="listbox"
      aria-multiselectable={false}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
    >
      {options.map((label, index) => {
        const isSelected = value === label;
        const shortcutKey = index < 9 ? String(index + 1) : null;

        return (
          <button
            key={label}
            type="button"
            onClick={() => handleSelect(label)}
            disabled={disabled}
            className={cn(
              "w-full text-left px-4 py-3 rounded-lg border transition-all duration-200 flex items-center gap-3",
              isSelected
                ? "bg-primary/10 border-2 border-primary"
                : "bg-muted/30 border border-border/50 hover:bg-muted/60 hover:border-border",
              disabled && "opacity-50 cursor-not-allowed",
            )}
            aria-selected={isSelected}
            aria-disabled={disabled || undefined}
          >
            {showKeyboardHints && shortcutKey && (
              <span
                className={cn(
                  "inline-flex items-center justify-center w-6 h-6 rounded text-xs font-semibold",
                  isSelected
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-primary border border-primary",
                )}
              >
                {shortcutKey}
              </span>
            )}
            <span
              className={cn("flex-1 text-base", isSelected && "font-medium")}
            >
              {label}
            </span>
          </button>
        );
      })}
      {required && !value && (
        <p className="text-sm text-muted-foreground">
          Please select one option to continue.
        </p>
      )}
    </div>
  );
}
