"use client";
import * as React from "react";
import { usePrimitives } from "./primitives/context";

function must<T extends React.ComponentType<any> | undefined>(
  name: string,
  comp: T,
): NonNullable<T> {
  if (!comp)
    throw new Error(`ShadCnProvider is missing required primitive: ${name}`);
  return comp as NonNullable<T>;
}

export type FormMode = "chat" | "typeform";

export type CountryOption = {
  code: string;
  name: string;
  flag?: string;
};

export interface UnifiedCountrySelectProps {
  mode: FormMode;
  value: string | null; // ISO2
  onChange: (value: string | null) => void;
  onSubmit?: () => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  options: CountryOption[]; // host-provided list
  className?: string;
  ariaLabel?: string;
  ariaDescribedBy?: string;
  autoFocus?: boolean; // default false: avoid accidental auto-open perception
}

export function UnifiedCountrySelect({
  mode,
  value,
  onChange,
  onSubmit,
  placeholder = "Select a country...",
  disabled,
  required,
  options,
  className,
  ariaLabel,
  ariaDescribedBy,
  autoFocus,
}: UnifiedCountrySelectProps) {
  const p = usePrimitives();
  const Button = must("Button", p.Button);
  const PopoverRoot = must("PopoverRoot", p.PopoverRoot);
  const PopoverTrigger = must("PopoverTrigger", p.PopoverTrigger);
  const PopoverContent = must("PopoverContent", p.PopoverContent);
  const CommandRoot = must("CommandRoot", p.CommandRoot);
  const CommandList = must("CommandList", p.CommandList);
  const CommandItem = must("CommandItem", p.CommandItem);
  const CommandEmpty = must("CommandEmpty", p.CommandEmpty);
  const CommandGroup = must("CommandGroup", p.CommandGroup ?? p.CommandRoot);
  const CommandInput = must("CommandInput", p.CommandInput);

  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const listId = React.useId();
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  const [triggerWidth, setTriggerWidth] = React.useState<number | null>(null);
  const shouldAutoFocus = React.useMemo(
    () => (typeof autoFocus === "boolean" ? autoFocus : mode === "typeform"),
    [autoFocus, mode],
  );
  React.useEffect(() => {
    if (shouldAutoFocus) {
      try {
        triggerRef.current?.focus();
      } catch {}
    }
  }, [shouldAutoFocus]);
  React.useLayoutEffect(() => {
    if (!open) return;
    const el = triggerRef.current;
    if (!el) return;
    const update = () => setTriggerWidth(el.offsetWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [open]);

  const selected = React.useMemo(
    () =>
      value
        ? (options.find((o) => o.code.toUpperCase() === value.toUpperCase()) ??
          null)
        : null,
    [options, value],
  );
  const filtered = React.useMemo(
    () =>
      query
        ? options.filter((o) =>
            o.name.toLowerCase().includes(query.toLowerCase()),
          )
        : options,
    [options, query],
  );
  const hasValue = Boolean(selected);
  const sizeCls = mode === "typeform" ? "h-12 text-base" : "h-10 text-sm";
  const triggerCls = [
    "flex w-full items-center justify-between overflow-hidden whitespace-nowrap",
    "cursor-pointer",
    "transform-gpu transition-[background,box-shadow] duration-150 will-change-transform",
    "hover:shadow-sm hover:ring-2 ring-border/60",
    sizeCls,
  ];
  if (hasValue) {
    triggerCls.push("hover:bg-muted/50 hover:text-foreground hover:shadow-md");
  }

  return (
    <div className={className}>
      <PopoverRoot open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            ref={triggerRef as any}
            role="combobox"
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-controls={listId}
            variant="outline"
            data-has-value={hasValue || undefined}
            className={triggerCls.join(" ")}
            aria-label={ariaLabel}
            aria-describedby={ariaDescribedBy}
            disabled={disabled}
          >
            {selected ? (
              <span className="flex items-center gap-2 overflow-hidden">
                {selected.flag && (
                  <span className="inline-block">{selected.flag}</span>
                )}
                <span className="truncate">{selected.name}</span>
              </span>
            ) : (
              <span className="truncate text-muted-foreground">
                {placeholder}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="p-0"
          style={triggerWidth ? { width: triggerWidth } : undefined}
        >
          <CommandRoot>
            <div className="sticky top-0 z-10 bg-popover">
              <CommandInput
                placeholder="Search country..."
                value={query}
                onValueChange={(v: string) => setQuery(v)}
                className="h-10"
              />
            </div>
            <CommandList id={listId}>
              <CommandEmpty>No country found.</CommandEmpty>
              <CommandGroup>
                {filtered.map((country) => (
                  <CommandItem
                    key={country.code}
                    value={country.name}
                    onSelect={() => {
                      onChange(country.code);
                      setOpen(false);
                      onSubmit?.();
                    }}
                  >
                    <span className="flex items-center gap-2 truncate">
                      {country.flag && <span>{country.flag}</span>}
                      <span className="truncate">{country.name}</span>
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </CommandRoot>
        </PopoverContent>
      </PopoverRoot>
      {required && !value && (
        <p className="text-sm text-destructive mt-2">Please select a country</p>
      )}
    </div>
  );
}
