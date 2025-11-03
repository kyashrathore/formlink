"use client";
import { useMultiChoice } from "@/headless/react/hooks/useMultiChoice";
import * as React from "react";
import { useIsMobile } from "./hooks/use-mobile";

export type InlineMultiOption<T = string> = {
  value: T;
  label: string;
  disabled?: boolean;
};

export interface InlineMultiSelectProps<T = string> {
  options: InlineMultiOption<T>[];
  value: T[]; // selected values
  onChange: (next: T[]) => void;
  onSubmit?: () => void;
  showKeyboardHints?: boolean; // default true
  autoFocus?: boolean; // default true
  className?: string;
  ariaLabel?: string;
  ariaDescribedBy?: string;
}

export function InlineMultiSelect<T = string>({
  options,
  value,
  onChange,
  onSubmit,
  showKeyboardHints = true,
  autoFocus = true,
  className,
  ariaLabel,
  ariaDescribedBy,
}: InlineMultiSelectProps<T>) {
  const mc = useMultiChoice({ options, value, onChange, showKeyboardHints });
  const isMobile = useIsMobile();

  // Keep Enter submit at container level for multi-choice
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && onSubmit) {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <div
      {...mc.containerProps}
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
      onKeyDown={onKeyDown}
      className={["space-y-3 outline-none", className]
        .filter(Boolean)
        .join(" ")}
    >
      {options.map((opt, index) => {
        const selected = value.includes(opt.value);
        const shortcutKey = String.fromCharCode(65 + index);
        return (
          <div
            {...mc.getItemProps(index)}
            key={String(opt.value)}
            className={[
              "flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer transition-all duration-200",
              selected
                ? "bg-primary/10 border-2 border-primary"
                : "bg-muted/30 border border-border/50 hover:bg-muted/60 hover:border-border",
              opt.disabled ? "opacity-50 cursor-not-allowed" : "",
            ].join(" ")}
          >
            {showKeyboardHints && (
              <div
                className={[
                  "flex items-center justify-center w-8 h-8 rounded text-sm font-semibold",
                  selected
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-primary border border-primary",
                ].join(" ")}
              >
                {shortcutKey}
              </div>
            )}
            <span
              className={[
                "flex-1 text-base",
                selected ? "text-foreground font-medium" : "text-foreground",
              ].join(" ")}
            >
              {opt.label}
            </span>
            {selected && (
              <svg
                className="w-5 h-5 text-primary"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            )}
          </div>
        );
      })}
    </div>
  );
}
