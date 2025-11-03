"use client";
import * as React from "react";

export type TriggerSelectOption<T = string> = { value: T; label: string };

export type UseTriggerSelectOptions<T = string> = {
  options: TriggerSelectOption<T>[];
  value: T | null;
  onChange: (v: T | null) => void;
  onAutoAdvance?: () => void | Promise<void>;
  initialOpen?: boolean;
};

export function useTriggerSelect<T = string>(opts: UseTriggerSelectOptions<T>) {
  const { options, value, onChange, onAutoAdvance, initialOpen = false } = opts;
  const [open, setOpen] = React.useState<boolean>(
    Boolean(initialOpen && value == null),
  );
  const selected = React.useMemo(
    () => options.find((o) => Object.is(o.value, value)) ?? null,
    [options, value],
  );

  const triggerProps = {
    role: "combobox" as const,
    "aria-haspopup": "listbox",
    "aria-expanded": open,
    "data-fl-keyscope-stop": true,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        e.stopPropagation();
        setOpen((prev) => !prev);
      }
    },
    onClick: () => setOpen((prev) => !prev),
  } as const;

  const listboxProps = {
    role: "listbox" as const,
  } as const;

  const getItemProps = (index: number) => {
    const opt = options[index]!;
    return {
      role: "option" as const,
      "aria-selected": Object.is(opt.value, value),
      onClick: () => {
        onChange(opt.value as T);
        setOpen(false);
        if (onAutoAdvance) {
          window.setTimeout(() => void onAutoAdvance(), 150);
        }
      },
    } as const;
  };

  return {
    open,
    setOpen,
    triggerProps,
    listboxProps,
    getItemProps,
    selectedLabel: selected?.label ?? null,
    options,
  } as const;
}
