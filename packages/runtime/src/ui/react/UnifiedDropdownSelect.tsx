"use client";
import * as React from "react";
import type { ComponentPropsWithRef } from "react";
import { usePrimitives } from "./primitives/context";

function must<P extends object>(
  name: string,
  comp: React.ComponentType<P> | undefined,
): React.ComponentType<P> {
  if (!comp)
    throw new Error(`ShadCnProvider is missing required primitive: ${name}`);
  return comp;
}

export type FormMode = "chat" | "typeform";

export interface UnifiedDropdownSelectOption<T = string> {
  value: T;
  label: string;
  disabled?: boolean;
}

export interface UnifiedDropdownSelectProps<T = string> {
  mode: FormMode;
  options: UnifiedDropdownSelectOption<T>[];
  value: T | null;
  onChange: (value: T | null) => void;
  onSubmit?: () => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  ariaLabel?: string;
  ariaDescribedBy?: string;
  autoOpenOnMountIfEmpty?: boolean;
  autoFocus?: boolean;
}

export function UnifiedDropdownSelect<T = string>({
  mode,
  options,
  value,
  onChange,
  onSubmit,
  placeholder = "Select an option...",
  disabled = false,
  required = false,
  autoFocus = true,
  className,
  ariaLabel,
  ariaDescribedBy,
  autoOpenOnMountIfEmpty = false,
}: UnifiedDropdownSelectProps<T>) {
  const p = usePrimitives();
  const Button = must<ComponentPropsWithRef<"button"> & { variant?: string }>(
    "Button",
    p.Button as React.ComponentType<
      ComponentPropsWithRef<"button"> & { variant?: string }
    >,
  );
  type PopoverProps = { children?: React.ReactNode } & Record<string, unknown>;
  const PopoverRoot = must<PopoverProps>(
    "PopoverRoot",
    p.PopoverRoot as React.ComponentType<PopoverProps>,
  );
  const PopoverTrigger = must<PopoverProps>(
    "PopoverTrigger",
    p.PopoverTrigger as React.ComponentType<PopoverProps>,
  );
  const PopoverContent = must<PopoverProps>(
    "PopoverContent",
    p.PopoverContent as React.ComponentType<PopoverProps>,
  );
  const CommandRoot = must<PopoverProps>(
    "CommandRoot",
    p.CommandRoot as React.ComponentType<PopoverProps>,
  );
  const CommandList = must<PopoverProps>(
    "CommandList",
    p.CommandList as React.ComponentType<PopoverProps>,
  );
  const CommandItem = must<
    PopoverProps & { value?: string; onSelect?: () => void }
  >(
    "CommandItem",
    p.CommandItem as React.ComponentType<
      PopoverProps & { value?: string; onSelect?: () => void }
    >,
  );
  const CommandEmpty = must<PopoverProps>(
    "CommandEmpty",
    p.CommandEmpty as React.ComponentType<PopoverProps>,
  );
  const CommandGroup = must<PopoverProps>(
    "CommandGroup",
    (p.CommandGroup ?? p.CommandRoot) as React.ComponentType<PopoverProps>,
  );
  const CommandInput = must<
    PopoverProps & { value?: string; onValueChange?: (next: string) => void }
  >(
    "CommandInput",
    p.CommandInput as React.ComponentType<
      PopoverProps & { value?: string; onValueChange?: (next: string) => void }
    >,
  );

  const [open, setOpen] = React.useState<boolean>(
    Boolean(autoOpenOnMountIfEmpty && value == null),
  );
  const [query, setQuery] = React.useState<string>("");
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

  const items = React.useMemo(
    () => options.map((o) => ({ value: String(o.value), label: o.label })),
    [options],
  );
  const selected = React.useMemo(
    () =>
      value == null
        ? null
        : (options.find((o) => String(o.value) === String(value)) ?? null),
    [options, value],
  );
  const filtered = React.useMemo(
    () =>
      query
        ? items.filter((i) =>
            i.label.toLowerCase().includes(query.toLowerCase()),
          )
        : items,
    [items, query],
  );

  const sizeCls = mode === "typeform" ? "h-12 text-base" : "h-10 text-sm";
  const hasValue = Boolean(selected);
  const triggerCls = [
    "w-full justify-between overflow-hidden whitespace-nowrap",
    "cursor-pointer",
    "transform-gpu transition-[background,box-shadow] duration-150 will-change-transform",
    "hover:shadow-sm hover:ring-2 ring-border/60",
    sizeCls,
  ];
  if (hasValue) {
    // Preserve contrast on hover/focus when a value is selected
    triggerCls.push("hover:bg-muted/50 hover:text-foreground hover:shadow-md");
  }

  return (
    <div className={className}>
      <PopoverRoot open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            ref={triggerRef}
            role="combobox"
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-controls={listId}
            aria-label={ariaLabel}
            aria-describedby={ariaDescribedBy}
            variant="outline"
            data-has-value={hasValue || undefined}
            className={triggerCls.join(" ")}
            disabled={disabled}
          >
            {selected ? (
              <span className="truncate">{selected.label}</span>
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
                placeholder="Search..."
                value={query}
                onValueChange={(v: string) => setQuery(v)}
                className="h-10"
              />
            </div>
            <CommandList id={listId}>
              <CommandEmpty>No options found.</CommandEmpty>
              <CommandGroup>
                {filtered.map((item) => (
                  <CommandItem
                    key={item.value}
                    value={item.label}
                    onSelect={() => {
                      const found = options.find((o) => o.label === item.label);
                      onChange(found ? (found.value as T) : null);
                      setOpen(false);
                      if (onSubmit) {
                        window.setTimeout(() => onSubmit(), 150);
                      }
                    }}
                  >
                    {item.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </CommandRoot>
        </PopoverContent>
      </PopoverRoot>
      {required && !value && (
        <p className="text-sm text-destructive mt-2">Please select an option</p>
      )}
    </div>
  );
}
