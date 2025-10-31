"use client";
import * as React from "react";

export type InlineMultiOption<T = string> = {
  value: T;
  label: string;
  disabled?: boolean;
};

export interface InlineMultiSelectProps<T = string> {
  options: InlineMultiOption<T>[];
  value: T[]; // selected values
  onChange: (next: T[]) => void;
  onSubmit?: () => void;
  showKeyboardHints?: boolean; // default true
  autoFocus?: boolean; // default true
  className?: string;
  ariaLabel?: string;
  ariaDescribedBy?: string;
}

export function InlineMultiSelect<T = string>({
  options,
  value,
  onChange,
  onSubmit,
  showKeyboardHints = true,
  autoFocus = true,
  className,
  ariaLabel,
  ariaDescribedBy,
}: InlineMultiSelectProps<T>) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [isMobile, setIsMobile] = React.useState(false);
  React.useEffect(() => {
    try {
      const mq = window.matchMedia("(max-width: 768px)");
      const apply = () => setIsMobile(mq.matches);
      apply();
      mq.addEventListener("change", apply);
      return () => mq.removeEventListener("change", apply);
    } catch {}
  }, []);
  React.useEffect(() => {
    if (autoFocus) {
      try {
        containerRef.current?.focus();
      } catch {}
    }
  }, [autoFocus]);

  const selectedSet = React.useMemo(
    () => new Set((value ?? []).map((v) => String(v))),
    [value],
  );

  const toggleIndex = React.useCallback(
    (idx: number) => {
      if (idx < 0 || idx >= options.length) return;
      const opt = options[idx]!;
      if (opt.disabled) return;
      const sv = String(opt.value);
      const next = new Set(selectedSet);
      if (next.has(sv)) next.delete(sv);
      else next.add(sv);
      onChange(
        options
          .filter((o) => next.has(String(o.value)))
          .map((o) => o.value as T),
      );
    },
    [options, onChange, selectedSet],
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (isMobile) return; // disable keyboard shortcuts on mobile
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (/^[a-zA-Z]$/.test(e.key)) {
      const idx = e.key.toUpperCase().charCodeAt(0) - 65; // A->0
      if (idx >= 0 && idx < options.length) {
        e.preventDefault();
        toggleIndex(idx);
      }
    } else if (/^[1-9]$/.test(e.key)) {
      const idx = parseInt(e.key, 10) - 1;
      if (idx >= 0 && idx < options.length) {
        e.preventDefault();
        toggleIndex(idx);
      }
    } else if (e.key === "Enter" && onSubmit) {
      // Enter submits selection (no auto-advance on toggle)
      e.preventDefault();
      onSubmit();
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
      className={["space-y-3 outline-none", className]
        .filter(Boolean)
        .join(" ")}
    >
      {options.map((opt, index) => {
        const selected = selectedSet.has(String(opt.value));
        const shortcutKey = String.fromCharCode(65 + index);
        return (
          <div
            key={String(opt.value)}
            role="option"
            aria-selected={selected}
            aria-disabled={Boolean(opt.disabled)}
            tabIndex={-1}
            onClick={() => !opt.disabled && toggleIndex(index)}
            className={[
              "flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer transition-all duration-200",
              selected
                ? "bg-primary/10 border-2 border-primary"
                : "bg-muted/30 border border-border/50 hover:bg-muted/60 hover:border-border",
              opt.disabled ? "opacity-50 cursor-not-allowed" : "",
            ].join(" ")}
          >
            {showKeyboardHints && !isMobile && (
              <div
                className={[
                  "flex items-center justify-center w-8 h-8 rounded text-sm font-semibold",
                  selected
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-primary border border-primary",
                ].join(" ")}
              >
                {shortcutKey}
              </div>
            )}
            <span
              className={[
                "flex-1 text-base",
                selected ? "text-foreground font-medium" : "text-foreground",
              ].join(" ")}
            >
              {opt.label}
            </span>
            {selected && (
              <svg
                className="w-5 h-5 text-primary"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            )}
          </div>
        );
      })}
    </div>
  );
}
