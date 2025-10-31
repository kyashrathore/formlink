"use client";
import * as React from "react";
import { useIsMobile } from "./hooks/use-mobile";

export type Option<T = string> = {
  value: T;
  label: string;
  disabled?: boolean;
};

export interface InlineSelectProps<T = string> {
  options: Option<T>[];
  value: T | null;
  onChange: (value: T | null) => void;
  onSubmit?: () => void;
  autoAdvance?: boolean; // default true
  showKeyboardHints?: boolean; // default true
  autoFocus?: boolean; // default true
  className?: string;
  ariaLabel?: string;
  ariaDescribedBy?: string;
}

export function InlineSelect<T = string>({
  options,
  value,
  onChange,
  onSubmit,
  autoAdvance = true,
  showKeyboardHints = true,
  autoFocus = true,
  className,
  ariaLabel,
  ariaDescribedBy,
}: InlineSelectProps<T>) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const isMobile = useIsMobile();

  React.useEffect(() => {
    if (autoFocus) {
      try {
        containerRef.current?.focus();
      } catch {}
    }
  }, [autoFocus]);

  const handleSelectIndex = React.useCallback(
    (index: number) => {
      if (index < 0 || index >= options.length) return;
      const opt = options[index]!;
      if (opt.disabled) return;
      onChange(opt.value);
      if (autoAdvance && onSubmit) {
        const t = window.setTimeout(() => onSubmit(), 150);
        return () => window.clearTimeout(t);
      }
      return;
    },
    [options, onChange, autoAdvance, onSubmit],
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (isMobile) return; // hide keyboard behavior on mobile
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (/^[a-zA-Z]$/.test(e.key)) {
      const idx = e.key.toUpperCase().charCodeAt(0) - 65; // A->0
      if (idx >= 0 && idx < options.length) {
        e.preventDefault();
        handleSelectIndex(idx);
      }
    } else if (/^[1-9]$/.test(e.key)) {
      const idx = parseInt(e.key, 10) - 1;
      if (idx >= 0 && idx < options.length) {
        e.preventDefault();
        handleSelectIndex(idx);
      }
    }
  };

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      role="group"
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
      onKeyDown={onKeyDown}
      className={["space-y-3 outline-none", className]
        .filter(Boolean)
        .join(" ")}
    >
      {options.map((opt, index) => {
        const selected = value === opt.value;
        const shortcutKey = String.fromCharCode(65 + index);
        return (
          <div
            key={String(opt.value)}
            role="option"
            aria-selected={selected}
            aria-disabled={Boolean(opt.disabled)}
            tabIndex={-1}
            onClick={() => !opt.disabled && handleSelectIndex(index)}
            className={[
              "flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer transition-all duration-200",
              selected
                ? "bg-primary/10 border-2 border-primary"
                : "bg-muted/30 border border-border/50 hover:bg-muted/60 hover:border-border",
              opt.disabled ? "opacity-50 cursor-not-allowed" : "",
            ].join(" ")}
          >
            {showKeyboardHints && !isMobile && (
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
