"use client";

import React, { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { UnifiedDatePicker } from "@formlink/ui";

export interface TypeFormDateProps {
  value: string | null;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  range?: boolean;
  required?: boolean;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
  ariaDescribedBy?: string;
}

// Parse YYYY-MM-DD into a Date (local). Returns null if invalid.
function parseISODateString(s: string | null | undefined): Date | null {
  if (!s || typeof s !== "string") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const [, ys, ms, ds] = m;
  const y = Number(ys);
  const mo = Number(ms) - 1;
  const d = Number(ds);
  const dt = new Date(y, mo, d);
  if (!Number.isFinite(dt.getTime())) return null;
  // guard against JS Date quirks (e.g., overflow)
  if (dt.getFullYear() !== y || dt.getMonth() !== mo || dt.getDate() !== d)
    return null;
  return dt;
}

// Format Date to YYYY-MM-DD (local).
function formatISODate(d: Date | null): string {
  if (!d) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Parse a range string: "YYYY-MM-DD to YYYY-MM-DD"
function parseRange(value: string | null): {
  start: Date | null;
  end: Date | null;
} {
  if (!value) return { start: null, end: null };
  const parts = value.split(" to ");
  if (parts.length !== 2) return { start: null, end: null };
  const [s, e] = parts;
  return { start: parseISODateString(s), end: parseISODateString(e) };
}

export default function TypeFormDate({
  value,
  onChange,
  onSubmit,
  range = false,
  required = false,
  placeholder,
  className,
  ariaLabel,
  ariaDescribedBy,
}: TypeFormDateProps) {
  // Single-date mode: convert string <-> Date for UnifiedDatePicker
  const singleDate = useMemo(() => parseISODateString(value || ""), [value]);

  // Range mode: maintain internal derived state from `value`
  const initialRange = useMemo(() => parseRange(value || ""), [value]);
  const [start, setStart] = useState<Date | null>(initialRange.start);
  const [end, setEnd] = useState<Date | null>(initialRange.end);

  // Keep internal state in sync when prop value changes externally
  useEffect(() => {
    if (range) {
      const { start: s, end: e } = parseRange(value || "");
      setStart(s);
      setEnd(e);
    }
  }, [range, value]);

  // Emit combined range string when both dates are selected
  useEffect(() => {
    if (range) {
      if (start && end) {
        const out = `${formatISODate(start)} to ${formatISODate(end)}`;
        if (out !== (value || "")) onChange(out);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, start, end]);

  if (!range) {
    return (
      <div className={cn("w-full max-w-2xl", className)}>
        <UnifiedDatePicker
          mode="typeform"
          value={singleDate}
          onChange={(d) => onChange(formatISODate(d))}
          onSubmit={onSubmit}
          required={required}
          placeholder={placeholder || "Select date"}
          autoFocus
        />
      </div>
    );
  }

  // Range UI: two date pickers inline (Start, End). Submit only when both present.
  const canSubmit = Boolean(start && end);

  return (
    <div
      className={cn("w-full max-w-3xl", className)}
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <UnifiedDatePicker
            mode="typeform"
            value={start}
            onChange={(d) => setStart(d)}
            onSubmit={canSubmit ? onSubmit : undefined}
            required={required}
            placeholder="Start date"
            autoFocus
          />
        </div>
        <div>
          <UnifiedDatePicker
            mode="typeform"
            value={end}
            onChange={(d) => setEnd(d)}
            onSubmit={canSubmit ? onSubmit : undefined}
            required={required}
            placeholder="End date"
          />
        </div>
      </div>
      {/* Hint text can be managed by parent TypeFormQuestion; this wrapper keeps UI minimal */}
    </div>
  );
}
