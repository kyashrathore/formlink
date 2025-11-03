"use client";
import * as React from "react";

export type UseLinearScaleOptions = {
  value: number | null;
  onChange: (v: number | null) => void;
  start: number;
  end: number;
  step?: number;
  showKeyboardHints?: boolean;
  autoAdvanceOnClick?: boolean;
  onAutoAdvance?: () => void | Promise<void>;
};

function buildValues(start: number, end: number, step: number): number[] {
  const vals: number[] = [];
  if (step <= 0) return vals;
  if (start <= end) {
    for (let x = start; x <= end; x += step) vals.push(x);
  } else {
    for (let x = start; x >= end; x -= step) vals.push(x);
  }
  return vals;
}

export function useLinearScale(opts: UseLinearScaleOptions) {
  const {
    value,
    onChange,
    start,
    end,
    step = 1,
    showKeyboardHints = true,
    autoAdvanceOnClick = true,
    onAutoAdvance,
  } = opts;
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const btnRefs = React.useRef<Array<HTMLButtonElement | null>>([]);
  const values = React.useMemo(
    () => buildValues(start, end, step),
    [start, end, step],
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
    role: "radiogroup" as const,
    tabIndex: 0,
    onFocus: (e: React.FocusEvent) => {
      if (e.currentTarget === e.target) {
        const idx = value !== null ? Math.max(0, values.indexOf(value)) : 0;
        try {
          btnRefs.current[idx]?.focus();
        } catch {}
      }
    },
    ...(showKeyboardHints ? { "data-fl-hints": "1" } : {}),
  } as const;

  const getItemProps = (idx: number) => {
    const n = values[idx]!;
    const selected = value === n;
    return {
      ref: (el: HTMLButtonElement | null) => {
        btnRefs.current[idx] = el;
      },
      role: "radio" as const,
      "aria-checked": selected,
      tabIndex: value ? (selected ? 0 : -1) : idx === 0 ? 0 : -1,
      onClick: () => select(n, true),
      onKeyDown: (e: React.KeyboardEvent) => {
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        switch (e.key) {
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
          case "ArrowRight":
          case "ArrowDown": {
            e.preventDefault();
            e.stopPropagation();
            const ni = Math.min(values.length - 1, idx + 1);
            try {
              btnRefs.current[ni]?.focus();
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
              btnRefs.current[values.length - 1]?.focus();
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

  const getValueLabelProps = (idx: number) =>
    ({
      "data-fl-value": values[idx],
    }) as const;

  const renderHint = (idx: number) => {
    if (!showKeyboardHints) return null;
    const n = values[idx]!;
    const txt = n >= 1 && n <= 9 ? String(n) : "";
    return txt ? (
      <kbd className="inline-flex items-center justify-center rounded border px-1.5 py-0.5 text-xs">
        {txt}
      </kbd>
    ) : null;
  };

  return {
    values,
    containerProps,
    getItemProps,
    getValueLabelProps,
    renderHint,
  } as const;
}
