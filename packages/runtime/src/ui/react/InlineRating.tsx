"use client";
import * as React from "react";

export interface InlineRatingProps {
  value: number | null;
  onChange: (next: number | null) => void;
  onSubmit?: () => void;
  max?: number;
  showKeyboardHints?: boolean;
  autoAdvance?: boolean;
  autoFocus?: boolean;
  className?: string;
  ariaLabel?: string;
  ariaDescribedBy?: string;
}

export function InlineRating({
  value,
  onChange,
  onSubmit,
  max = 5,
  showKeyboardHints = true,
  autoAdvance = true,
  autoFocus = true,
  className,
  ariaLabel,
  ariaDescribedBy,
}: InlineRatingProps) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    if (autoFocus) {
      try {
        containerRef.current?.focus();
      } catch {}
    }
  }, [autoFocus]);

  const select = (n: number) => {
    onChange(n);
    if (autoAdvance && onSubmit) {
      const t = window.setTimeout(() => onSubmit(), 150);
      return () => window.clearTimeout(t);
    }
  };

  // Global listener: allow 1..max anywhere unless typing in inputs
  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const tag = target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable)
        return;
      if (/^[0-9]$/.test(e.key)) {
        const n = parseInt(e.key, 10);
        if (!Number.isNaN(n) && n >= 1 && n <= max) {
          e.preventDefault();
          select(n);
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [max]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (/^[0-9]$/.test(e.key)) {
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= max) {
        e.preventDefault();
        select(n);
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
      className={["w-full max-w-2xl outline-none focus:outline-none", className]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="flex gap-3">
        {Array.from({ length: max }, (_, i) => i + 1).map((n) => {
          const active = (value ?? 0) >= n;
          return (
            <button
              key={n}
              type="button"
              aria-pressed={active}
              onClick={() => select(n)}
              className="p-2 transition-transform hover:scale-105 focus:outline-none focus:scale-105"
            >
              <div className="flex flex-col items-center">
                <svg
                  className={[
                    "w-10 h-10 transition-all duration-200",
                    active ? "text-primary" : "text-muted-foreground/50",
                  ].join(" ")}
                  viewBox="0 0 24 24"
                  fill={active ? "currentColor" : "none"}
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
                {showKeyboardHints && (
                  <kbd className="mt-1 text-xs text-muted-foreground">{n}</kbd>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
