"use client";
import * as React from "react";

export type TriggerMultiOption<T = string> = { value: T; label: string };

export type UseTriggerMultiSelectOptions<T = string> = {
  options: TriggerMultiOption<T>[];
  value: T[];
  onChange: (v: T[]) => void;
  initialOpen?: boolean;
};

export function useTriggerMultiSelect<T = string>(
  opts: UseTriggerMultiSelectOptions<T>,
) {
  const { options, value, onChange, initialOpen = false } = opts;
  const [open, setOpen] = React.useState<boolean>(Boolean(initialOpen));
  const selectedSet = React.useMemo(
    () => new Set(value.map((v) => String(v))),
    [value],
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
    "aria-multiselectable": true,
  } as const;

  const getItemProps = (index: number) => {
    const opt = options[index]!;
    const sel = selectedSet.has(String(opt.value));
    return {
      role: "option" as const,
      "aria-selected": sel,
      onClick: () => {
        const set = new Set(selectedSet);
        const sv = String(opt.value);
        if (set.has(sv)) set.delete(sv);
        else set.add(sv);
        const next = options
          .filter((o) => set.has(String(o.value)))
          .map((o) => o.value as T);
        onChange(next);
      },
    } as const;
  };

  const isSelected = (index: number) =>
    selectedSet.has(String(options[index]!.value));

  return {
    open,
    setOpen,
    triggerProps,
    listboxProps,
    getItemProps,
    isSelected,
    options,
  } as const;
}
