"use client";
import * as React from "react";

export type UseRatingOptions = {
  value: number | null;
  onChange: (v: number | null) => void;
  min?: number;
  max?: number;
  showKeyboardHints?: boolean;
  autoAdvanceOnClick?: boolean;
  onAutoAdvance?: () => void | Promise<void>;
};

export function useRating(opts: UseRatingOptions) {
  const {
    value,
    onChange,
    min = 1,
    max = 5,
    showKeyboardHints = true,
    autoAdvanceOnClick = true,
    onAutoAdvance,
  } = opts;
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const btnRefs = React.useRef<Array<HTMLButtonElement | null>>([]);
  const numbers = React.useMemo(
    () => Array.from({ length: max - min + 1 }, (_, i) => min + i),
    [min, max],
  );

  const select = (n: number, advance: boolean) => {
    onChange(n);
    if (advance && autoAdvanceOnClick && onAutoAdvance) {
      const t = window.setTimeout(() => void onAutoAdvance(), 150);
      return () => window.clearTimeout(t);
    }
    return;
  };

  const containerProps = {
    ref: containerRef,
    role: "group" as const,
    tabIndex: 0,
    onFocus: (e: React.FocusEvent) => {
      if (e.currentTarget === e.target) {
        const idx = value ? Math.min(value - min, numbers.length - 1) : 0;
        try {
          btnRefs.current[idx]?.focus();
        } catch {}
      }
    },
    ...(showKeyboardHints ? { "data-fl-hints": "1" } : {}),
  } as const;

  const getStarProps = (idx: number) => {
    const n = numbers[idx]!;
    const active = (value ?? 0) >= n;
    return {
      ref: (el: HTMLButtonElement | null) => {
        btnRefs.current[idx] = el;
      },
      role: "button" as const,
      tabIndex: value ? (value === n ? 0 : -1) : idx === 0 ? 0 : -1,
      "aria-pressed": active,
      onClick: () => select(n, true),
      onKeyDown: (e: React.KeyboardEvent) => {
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        const last = numbers.length - 1;
        switch (e.key) {
          case "ArrowRight":
          case "ArrowDown": {
            e.preventDefault();
            e.stopPropagation();
            const ni = Math.min(last, idx + 1);
            try {
              btnRefs.current[ni]?.focus();
            } catch {}
            break;
          }
          case "ArrowLeft":
          case "ArrowUp": {
            e.preventDefault();
            e.stopPropagation();
            const pi = Math.max(0, idx - 1);
            try {
              btnRefs.current[pi]?.focus();
            } catch {}
            break;
          }
          case "Home": {
            e.preventDefault();
            e.stopPropagation();
            try {
              btnRefs.current[0]?.focus();
            } catch {}
            break;
          }
          case "End": {
            e.preventDefault();
            e.stopPropagation();
            try {
              btnRefs.current[last]?.focus();
            } catch {}
            break;
          }
          case " ":
          case "Enter": {
            e.preventDefault();
            e.stopPropagation();
            onChange(n);
            break;
          }
        }
      },
    } as const;
  };

  const renderHint = (idx: number) => {
    if (!showKeyboardHints) return null;
    const n = numbers[idx]!;
    return (
      <kbd className="inline-flex items-center justify-center rounded border px-1.5 py-0.5 text-xs">
        {n}
      </kbd>
    );
  };

  return { containerProps, getStarProps, renderHint } as const;
}
