"use client";
import * as React from "react";
import type { KeyboardEvent } from "react";
import type { ChoiceOption as Opt } from "@/core/typeform/choice/ChoiceController";

export type SingleChoiceOption<T = string> = Opt<T> & { label: string };

export type UseSingleChoiceOptions<T = string> = {
  options: SingleChoiceOption<T>[];
  value: T | null;
  onChange: (v: T | null) => void;
  showKeyboardHints?: boolean;
  autoAdvance?: boolean;
  onAutoAdvance?: () => void | Promise<void>;
};

export function useSingleChoice<T = string>(opts: UseSingleChoiceOptions<T>) {
  const {
    options,
    value,
    onChange,
    showKeyboardHints = true,
    autoAdvance = true,
    onAutoAdvance,
  } = opts;

  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const optionRefs = React.useRef<Array<HTMLElement | null>>([]);

  const selectedIndex = React.useMemo(
    () => options.findIndex((o) => Object.is(o.value, value)),
    [options, value],
  );

  const focusAt = React.useCallback((idx: number) => {
    const el = optionRefs.current[idx];
    if (el)
      try {
        el.focus();
      } catch {}
  }, []);

  const selectIndex = React.useCallback(
    (idx: number, advance: boolean) => {
      if (idx < 0 || idx >= options.length) return;
      const opt = options[idx]!;
      if (opt.disabled) return;
      onChange(opt.value);
      if (advance && autoAdvance && onAutoAdvance) {
        const t = window.setTimeout(() => void onAutoAdvance(), 150);
        return () => window.clearTimeout(t);
      }
      return;
    },
    [options, onChange, autoAdvance, onAutoAdvance],
  );

  const onItemKeyDown = (index: number) => (e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const lastIdx = options.length - 1;
    const nextEnabled = (start: number, step: number) => {
      let i = start;
      for (let k = 0; k < options.length; k++) {
        if (i < 0) i = lastIdx;
        if (i > lastIdx) i = 0;
        if (!options[i]?.disabled) return i;
        i += step;
      }
      return start;
    };
    switch (e.key) {
      case "ArrowDown":
      case "ArrowRight": {
        e.preventDefault();
        const ni = nextEnabled(index + 1, 1);
        focusAt(ni);
        break;
      }
      case "ArrowUp":
      case "ArrowLeft": {
        e.preventDefault();
        const pi = nextEnabled(index - 1, -1);
        focusAt(pi);
        break;
      }
      case "Home": {
        e.preventDefault();
        const fi = nextEnabled(0, 1);
        focusAt(fi);
        break;
      }
      case "End": {
        e.preventDefault();
        const li = nextEnabled(lastIdx, -1);
        focusAt(li);
        break;
      }
      case "Enter":
      case " ": {
        e.preventDefault();
        selectIndex(index, true);
        break;
      }
    }
  };

  const getItemProps = (index: number) => {
    const opt = options[index]!;
    const selected = index === selectedIndex;
    return {
      ref: (el: HTMLElement | null) => {
        optionRefs.current[index] = el;
      },
      role: "option" as const,
      tabIndex: selected || (selectedIndex < 0 && index === 0) ? 0 : -1,
      "aria-selected": selected,
      "aria-disabled": Boolean(opt.disabled),
      onKeyDown: onItemKeyDown(index),
      onClick: () => {
        if (!opt.disabled) selectIndex(index, true);
      },
    } as const;
  };

  const containerProps = {
    ref: containerRef,
    role: "group" as const,
    tabIndex: 0,
    onFocus: (e: React.FocusEvent) => {
      if (e.currentTarget === e.target) {
        const focusIdx = selectedIndex >= 0 ? selectedIndex : 0;
        focusAt(focusIdx);
      }
    },
    ...(showKeyboardHints ? { "data-fl-hints": "1" } : {}),
  } as const;

  const renderHint = (idx: number) => {
    if (!showKeyboardHints) return null;
    const ch = String.fromCharCode(65 + idx);
    return (
      <kbd className="inline-flex items-center justify-center rounded border px-1.5 py-0.5 text-xs">
        {ch}
      </kbd>
    );
  };

  return { containerProps, getItemProps, renderHint } as const;
}
