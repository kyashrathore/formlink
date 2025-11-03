"use client";
import * as React from "react";

export type UseDateOptions = {
  value: string | Date | null;
  onChange: (v: string | null) => void;
  mode?: "popover" | "native";
  onAutoAdvance?: () => void | Promise<void>;
};

function toStringValue(v: string | Date | null): string {
  if (!v) return "";
  if (typeof v === "string") return v;
  const y = v.getFullYear();
  const m = String(v.getMonth() + 1).padStart(2, "0");
  const d = String(v.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function useDate(opts: UseDateOptions) {
  const { value, onChange, mode = "popover", onAutoAdvance } = opts;
  const [open, setOpen] = React.useState(false);
  const strVal = React.useMemo(() => toStringValue(value), [value]);
  const dateVal = React.useMemo(() => {
    if (!value) return null as Date | null;
    if (value instanceof Date) return value;
    const [y, m, d] = value.split("-").map((s) => parseInt(s, 10));
    if (!y || !m || !d) return null;
    const dt = new Date(y, m - 1, d);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }, [value]);

  const triggerProps = {
    role: "combobox" as const,
    "aria-haspopup": "dialog",
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

  const onSelect = (d?: Date) => {
    if (!d) return;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    onChange(`${y}-${m}-${dd}`);
    setOpen(false);
    if (onAutoAdvance) void onAutoAdvance();
  };

  const inputProps = {
    type: "date",
    value: strVal,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      onChange(e.target.value || null),
  } as const;

  return {
    mode,
    open,
    setOpen,
    triggerProps,
    onSelect,
    inputProps,
    value: strVal,
    date: dateVal,
  } as const;
}
