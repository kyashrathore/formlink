"use client";
import * as React from "react";
import { useRating } from "@/headless/react/hooks/useRating";

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
  const rt = useRating({
    value,
    onChange,
    max,
    showKeyboardHints,
    autoAdvanceOnClick: autoAdvance,
    onAutoAdvance: onSubmit,
  });

  return (
    <div
      {...rt.containerProps}
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
      className={["w-full max-w-2xl outline-none focus:outline-none", className]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="flex gap-3">
        {Array.from({ length: max }, (_, i) => i + 1).map((n, idx) => {
          const active = (value ?? 0) >= n;
          return (
            <button
              {...rt.getStarProps(idx)}
              key={n}
              type="button"
              className="group p-2 transition-transform hover:scale-105 focus:outline-none focus:scale-105"
            >
              <div className="flex flex-col items-center">
                <svg
                  className={[
                    "w-10 h-10 transition-all duration-200",
                    active
                      ? "text-primary"
                      : "text-muted-foreground/50 group-focus:text-primary/60",
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
