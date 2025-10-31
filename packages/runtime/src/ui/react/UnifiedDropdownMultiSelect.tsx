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

export interface UnifiedDropdownMultiSelectOption<T = string> {
  value: T;
  label: string;
  disabled?: boolean;
}

export interface UnifiedDropdownMultiSelectProps<T = string> {
  mode: FormMode;
  options: UnifiedDropdownMultiSelectOption<T>[];
  value: T[];
  onChange: (value: T[]) => void;
  onSubmit?: () => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  ariaLabel?: string;
  ariaDescribedBy?: string;
  autoFocus?: boolean;
}

export function UnifiedDropdownMultiSelect<T = string>({
  mode,
  options,
  value,
  onChange,
  onSubmit,
  placeholder = "Select options...",
  disabled = false,
  required = false,
  className,
  ariaLabel,
  ariaDescribedBy,
  autoFocus = true,
}: UnifiedDropdownMultiSelectProps<T>) {
  const p = usePrimitives();
  type ButtonProps = ComponentPropsWithRef<"button"> & {
    variant?: string;
    [key: string]: unknown;
  };
  const Button = must<ButtonProps>(
    "Button",
    p.Button as React.ComponentType<ButtonProps>,
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
  type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
    variant?: string;
    [key: string]: unknown;
  };
  const Badge =
    (p.Badge as React.ComponentType<BadgeProps>) ??
    ((props: BadgeProps) => <span {...props} />);

  const [open, setOpen] = React.useState<boolean>(false);
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

  const valueSet = React.useMemo(() => new Set<T>(value), [value]);
  const selectedLabels = React.useMemo(
    () => options.filter((o) => valueSet.has(o.value)).map((o) => o.label),
    [options, valueSet],
  );
  const filtered = React.useMemo(
    () =>
      query
        ? options.filter((opt) =>
            opt.label.toLowerCase().includes(query.toLowerCase()),
          )
        : options,
    [options, query],
  );

  function toggleByLabel(label: string) {
    const opt = options.find((o) => o.label === label);
    if (!opt) return;
    const exists = value.some((item) => Object.is(item, opt.value));
    const next = exists
      ? value.filter((item) => !Object.is(item, opt.value))
      : [...value, opt.value];
    onChange(next);
  }

  const sizeCls = mode === "typeform" ? "h-12 text-base" : "h-10 text-sm";
  const hasValue = (selectedLabels?.length ?? 0) > 0;
  const triggerCls = [
    "w-full justify-between overflow-hidden whitespace-nowrap",
    "cursor-pointer",
    "transform-gpu transition-[background,box-shadow] duration-150 will-change-transform",
    "hover:shadow-sm hover:ring-2 ring-border/60",
    sizeCls,
  ];
  if (hasValue) {
    // Keep badges and selected text at full contrast on hover
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
            {selectedLabels.length > 0 ? (
              <span className="flex items-center gap-1.5 overflow-hidden">
                {selectedLabels.map((label) => (
                  <Badge
                    key={label}
                    variant="outline"
                    className="flex items-center gap-1 px-2 py-2"
                  >
                    <span className="max-w-[160px] truncate">{label}</span>
                    {!disabled && (
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleByLabel(label);
                        }}
                        aria-label={`Remove ${label}`}
                        className="opacity-70 hover:opacity-100 cursor-pointer"
                        role="presentation"
                      >
                        ×
                      </span>
                    )}
                  </Badge>
                ))}
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
                placeholder="Search..."
                value={query}
                onValueChange={(v: string) => setQuery(v)}
                className="h-10"
              />
            </div>
            <CommandList id={listId}>
              <CommandEmpty>No options found.</CommandEmpty>
              <CommandGroup>
                {filtered.map((option) => (
                  <CommandItem
                    key={String(option.value)}
                    value={option.label}
                    onSelect={() => toggleByLabel(option.label)}
                  >
                    {option.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </CommandRoot>
        </PopoverContent>
      </PopoverRoot>
      <div className="flex items-center justify-between text-sm text-muted-foreground mt-2">
        <span>
          {selectedLabels.length} selected
          {required && selectedLabels.length === 0 && " (required)"}
        </span>
        {/* No internal continue button in typeform mode; use page-level footer */}
      </div>
      {required && (!value || value.length === 0) && (
        <p className="text-sm text-destructive mt-2">
          Please select at least one option
        </p>
      )}
    </div>
  );
}
