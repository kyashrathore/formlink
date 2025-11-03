"use client";
import * as React from "react";
import type { KeyboardEvent } from "react";
import type { ChoiceOption as Opt } from "@/core/typeform/choice/ChoiceController";

export type MultiChoiceOption<T = string> = Opt<T> & { label: string };

export type UseMultiChoiceOptions<T = string> = {
  options: MultiChoiceOption<T>[];
  value: T[];
  onChange: (v: T[]) => void;
  showKeyboardHints?: boolean;
};

export function useMultiChoice<T = string>(opts: UseMultiChoiceOptions<T>) {
  const { options, value, onChange, showKeyboardHints = true } = opts;
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const optionRefs = React.useRef<Array<HTMLElement | null>>([]);
  const selectedSet = React.useMemo(
    () => new Set(value.map((v) => String(v))),
    [value],
  );

  const focusAt = React.useCallback((idx: number) => {
    const el = optionRefs.current[idx];
    if (el)
      try {
        el.focus();
      } catch {}
  }, []);

  const toggleIndex = React.useCallback(
    (idx: number) => {
      if (idx < 0 || idx >= options.length) return;
      const opt = options[idx]!;
      if (opt.disabled) return;
      const sv = String(opt.value);
      const next = new Set(selectedSet);
      if (next.has(sv)) next.delete(sv);
      else next.add(sv);
      const arr = options
        .filter((o) => next.has(String(o.value)))
        .map((o) => o.value as T);
      onChange(arr);
    },
    [options, selectedSet, onChange],
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
        e.stopPropagation();
        toggleIndex(index);
        break;
      }
    }
  };

  const getItemProps = (index: number) => {
    const opt = options[index]!;
    const selected = selectedSet.has(String(opt.value));
    return {
      ref: (el: HTMLElement | null) => {
        optionRefs.current[index] = el;
      },
      role: "option" as const,
      tabIndex: index === 0 ? 0 : -1,
      "aria-selected": selected,
      "aria-disabled": Boolean(opt.disabled),
      onKeyDown: onItemKeyDown(index),
      onClick: () => {
        if (!opt.disabled) toggleIndex(index);
      },
    } as const;
  };

  const containerProps = {
    ref: containerRef,
    role: "group" as const,
    tabIndex: 0,
    onFocus: (e: React.FocusEvent) => {
      if (e.currentTarget === e.target) focusAt(0);
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
