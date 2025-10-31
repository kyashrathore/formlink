"use client";
import * as React from "react";
import type { ComponentPropsWithRef, Ref } from "react";
import { usePrimitives } from "./primitives/context";

type PopoverRootProps = {
  children?: React.ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type PopoverTriggerProps = {
  children?: React.ReactNode;
  asChild?: boolean;
};

type PopoverContentProps = {
  children?: React.ReactNode;
  align?: string;
  className?: string;
  style?: React.CSSProperties;
};

export type FormMode = "chat" | "typeform";

export interface UnifiedDatePickerProps {
  mode: FormMode;
  value: string | Date | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  ariaLabel?: string;
  ariaDescribedBy?: string;
  autoFocus?: boolean;
}

export function UnifiedDatePicker({
  mode,
  value,
  onChange,
  placeholder = "Select date",
  disabled,
  required,
  className,
  ariaLabel,
  ariaDescribedBy,
  autoFocus,
}: UnifiedDatePickerProps) {
  const primitives = usePrimitives();
  const Input = primitives.Input as
    | React.ComponentType<
        React.InputHTMLAttributes<HTMLInputElement> & {
          ref?: Ref<HTMLInputElement>;
        }
      >
    | undefined;
  const Button = primitives.Button as
    | React.ComponentType<
        React.ComponentPropsWithRef<"button"> & {
          variant?: string;
          ref?: Ref<HTMLButtonElement>;
        }
      >
    | undefined;
  type CalendarProps = {
    mode: "single";
    selected?: Date;
    onSelect?: (date?: Date) => void;
    initialFocus?: boolean;
  } & Record<string, unknown>;
  const Calendar = primitives.Calendar as
    | React.ComponentType<CalendarProps>
    | undefined;
  const PopoverRoot = primitives.PopoverRoot as
    | React.ComponentType<PopoverRootProps>
    | undefined;
  const PopoverTrigger = primitives.PopoverTrigger as
    | React.ComponentType<PopoverTriggerProps>
    | undefined;
  const PopoverContent = primitives.PopoverContent as
    | React.ComponentType<PopoverContentProps>
    | undefined;
  const sizeCls =
    mode === "typeform" ? "h-16 text-2xl md:text-3xl" : "h-10 text-sm";
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const shouldAutoFocus = React.useMemo(
    () => (typeof autoFocus === "boolean" ? autoFocus : mode === "typeform"),
    [autoFocus, mode],
  );
  React.useEffect(() => {
    if (shouldAutoFocus) {
      try {
        inputRef.current?.focus();
      } catch {}
    }
  }, [shouldAutoFocus]);
  const strVal = React.useMemo(() => {
    if (!value) return "";
    if (typeof value === "string") return value;
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }, [value]);
  const dateVal = React.useMemo(() => {
    if (!value) return null as Date | null;
    if (value instanceof Date) return value;
    // assume yyyy-mm-dd
    const [y, m, d] = value.split("-").map((s) => parseInt(s, 10));
    if (!y || !m || !d) return null;
    const dt = new Date(y, m - 1, d);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }, [value]);

  // If host provides Calendar + Popover, render a popover calendar picker
  if (Calendar && Button && PopoverRoot && PopoverTrigger && PopoverContent) {
    const [open, setOpen] = React.useState(false);
    const onSelectDate = (d: Date | undefined) => {
      if (!d) return;
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      onChange(`${yyyy}-${mm}-${dd}`);
      setOpen(false);
    };
    // Typeform mode: present as a bottom-border clickable control
    if (mode === "typeform") {
      return (
        <div
          className={["w-full max-w-2xl", className].filter(Boolean).join(" ")}
        >
          <PopoverRoot open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label={ariaLabel}
                aria-describedby={ariaDescribedBy}
                disabled={disabled}
                onClick={() => setOpen((s) => !s)}
                className={[
                  "w-full px-0 py-3 text-left",
                  sizeCls,
                  "bg-transparent border-0 border-b-2 border-border/30 focus:border-primary focus:outline-none",
                  "placeholder:text-muted-foreground/50",
                ].join(" ")}
              >
                {strVal || (
                  <span className="text-muted-foreground/50">
                    {placeholder}
                  </span>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="p-2">
              {/* shadcn Calendar signature: mode="single" selected={date} onSelect={fn} */}
              <Calendar
                mode="single"
                selected={dateVal ?? undefined}
                onSelect={onSelectDate}
                initialFocus
              />
            </PopoverContent>
          </PopoverRoot>
        </div>
      );
    }
    // Classic/chat: render Button-like trigger
    return (
      <div className={className}>
        <PopoverRoot open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              aria-label={ariaLabel}
              aria-describedby={ariaDescribedBy}
              className={["justify-start w-full", sizeCls].join(" ")}
              disabled={disabled}
            >
              {strVal || placeholder}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="p-2">
            <Calendar
              mode="single"
              selected={dateVal ?? undefined}
              onSelect={onSelectDate}
              initialFocus
            />
          </PopoverContent>
        </PopoverRoot>
      </div>
    );
  }
  // In typeform mode, render a plain input with bottom-border styling to match text input
  if (mode === "typeform") {
    return (
      <div
        className={["w-full max-w-2xl", className].filter(Boolean).join(" ")}
      >
        <input
          ref={inputRef}
          type="date"
          value={strVal}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value || null)}
          disabled={disabled}
          aria-label={ariaLabel}
          aria-describedby={ariaDescribedBy}
          className={[
            "w-full px-0 py-3",
            sizeCls,
            "bg-transparent border-0 border-b-2 border-border/30 focus:border-primary focus:outline-none",
            "placeholder:text-muted-foreground/50",
          ].join(" ")}
        />
      </div>
    );
  }
  const inputProps: React.InputHTMLAttributes<HTMLInputElement> = {
    type: "date",
    value: strVal,
    placeholder,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      onChange(e.target.value || null),
    disabled,
    "aria-label": ariaLabel,
    "aria-describedby": ariaDescribedBy,
    className: ["w-full", sizeCls, className].filter(Boolean).join(" "),
  };
  if (Input) return <Input {...inputProps} />;
  return <input {...inputProps} />;
}
