"use client";
/**
 * UnifiedPhoneInput — Typeform‑style phone input with:
 * - Country selector (flag + dial code) using host shadcn primitives
 * - As‑you‑type formatting via libphonenumber‑js
 * - Best‑effort geoguessing for +1 (NANP) based on first 3 digits (area code)
 *
 * Design constraints and caveats
 * - No direct dependency on @formlink/ui (runtime must be portable)
 * - We avoid shipping heavy metadata; we use libphonenumber‑js default metadata
 * - For +1 ambiguity (US/CA/territories), libphonenumber may remain undecided
 *   until enough digits are present. To keep UX responsive, we apply a small
 *   heuristic:
 *   - If input is +1 and first 3 digits match a known NANP territory (e.g. PR/DO),
 *     pick that territory immediately and STOP.
 *   - Else if first 3 digits are in the Canadian area‑codes set, pick CA and STOP.
 *   - Else pick US and STOP.
 *   Doing this first prevents flip‑flopping between US and CA while typing.
 * - This list may drift over time. See TODO near CA_AREACODES to source from
 *   an upstream dataset (e.g. react‑international‑phone countryData) at build‑time.
 */
import { usePhone } from "@/headless/react/hooks/usePhone";
import type {
  ComponentPropsWithRef,
  HTMLAttributes,
  InputHTMLAttributes,
  Ref,
} from "react";
import * as React from "react";
import { buildCountryOptions } from "./country-utils";
import { useUiComponents } from "./primitives/context";

type WindowWithDebug = Window & { __FL_DEBUG_PHONE?: unknown };
type GlobalWithProcess = typeof globalThis & {
  process?: { env?: Record<string, unknown> };
};

type CommandRootProps = {
  children?: React.ReactNode;
  value?: string;
  onValueChange?: (value: string) => void;
  className?: string;
};

type CommandListProps = HTMLAttributes<HTMLDivElement>;
type CommandItemProps = HTMLAttributes<HTMLDivElement> & {
  value?: string;
  onSelect?: (value: string) => void;
};
type CommandInputProps = {
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
};
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

export interface UnifiedPhoneInputProps {
  mode: FormMode;
  value: string;
  onChange: (value: string | null) => void;
  onSubmit?: () => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  ariaLabel?: string;
  ariaDescribedBy?: string;
  showCountrySelector?: boolean;
  defaultCountry?: string; // ISO2
  autoFocus?: boolean;
  onValidityChange?: (isValid: boolean) => void;
  preventInvalidSubmit?: boolean;
}

export function UnifiedPhoneInput({
  mode,
  value,
  onChange,
  onSubmit,
  placeholder = "Enter phone number",
  disabled,
  required,
  className,
  ariaLabel,
  ariaDescribedBy,
  showCountrySelector = true,
  defaultCountry,
  autoFocus,
  onValidityChange,
  preventInvalidSubmit = true,
}: UnifiedPhoneInputProps) {
  // Debug logger — enable by setting window.__FL_DEBUG_PHONE = true in console
  const DEBUG = (() => {
    if (typeof window !== "undefined") {
      const win = window as WindowWithDebug;
      if ("__FL_DEBUG_PHONE" in win) {
        return Boolean(win.__FL_DEBUG_PHONE);
      }
    }
    if (typeof globalThis !== "undefined") {
      const globalRef = globalThis as GlobalWithProcess;
      const envNode = globalRef.process?.env?.NODE_ENV;
      if (typeof envNode === "string") {
        return envNode !== "production";
      }
    }
    return false;
  })();

  const dbg = (...args: unknown[]) => {
    if (DEBUG) console.log("[UnifiedPhoneInput]", ...args);
  };

  const p = useUiComponents();
  const Input = p.Input as
    | React.ComponentType<
        InputHTMLAttributes<HTMLInputElement> & {
          ref?: Ref<HTMLInputElement>;
        }
      >
    | undefined;
  const Button = p.Button as
    | React.ComponentType<
        ComponentPropsWithRef<"button"> & {
          variant?: string;
          ref?: Ref<HTMLButtonElement>;
        }
      >
    | undefined;
  const PopoverRoot = p.PopoverRoot as
    | React.ComponentType<PopoverRootProps>
    | undefined;
  const PopoverTrigger = p.PopoverTrigger as
    | React.ComponentType<PopoverTriggerProps>
    | undefined;
  const PopoverContent = p.PopoverContent as
    | React.ComponentType<PopoverContentProps>
    | undefined;
  const CommandRoot = p.CommandRoot as
    | React.ComponentType<CommandRootProps>
    | undefined;
  const CommandList = p.CommandList as
    | React.ComponentType<CommandListProps>
    | undefined;
  const CommandItem = p.CommandItem as
    | React.ComponentType<CommandItemProps>
    | undefined;
  const CommandEmptyComp =
    (p.CommandEmpty as React.ComponentType<HTMLAttributes<HTMLDivElement>>) ??
    ((props: HTMLAttributes<HTMLDivElement>) => <div {...props} />);
  const CommandGroupComp =
    (p.CommandGroup as React.ComponentType<HTMLAttributes<HTMLDivElement>>) ??
    ((props: HTMLAttributes<HTMLDivElement>) => <div {...props} />);
  const CommandInput = p.CommandInput as
    | React.ComponentType<CommandInputProps>
    | undefined;

  const sizeCls =
    mode === "typeform" ? "h-16 text-2xl md:text-3xl" : "h-10 text-sm";
  // Headless phone logic (formatting, validity, country selection)
  const countryOptions = React.useMemo(
    () =>
      buildCountryOptions().map((c) => ({
        code: c.code,
        label: c.name,
        flag: c.flag,
        dialCode: c.dialCode,
      })),
    [],
  );
  const phone = usePhone({
    value,
    onChange,
    onSubmit,
    preventInvalidSubmit,
    defaultCountry,
    showCountrySelector,
    countryOptions,
  });

  const open = phone.open;
  const setOpen = phone.setOpen;
  const query = phone.query;
  const setQuery = phone.setQuery;
  const listId = React.useId();
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  const [triggerWidth, setTriggerWidth] = React.useState<number | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  // Focus input on mount if requested (default true in typeform mode)
  const shouldAutoFocus = autoFocus ?? mode === "typeform";

  React.useEffect(() => {
    if (!shouldAutoFocus) return;
    try {
      inputRef.current?.focus();
      const len = inputRef.current?.value?.length ?? 0;
      inputRef.current?.setSelectionRange?.(len, len);
    } catch {}
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

  const countries = React.useMemo(() => buildCountryOptions(), []);

  const selected = React.useMemo(
    () =>
      countries.find(
        (c) => c.code.toUpperCase() === (phone.country ?? "").toUpperCase(),
      ) ?? null,
    [countries, phone.country],
  );

  const focusInputEnd = (nextValue?: string) => {
    requestAnimationFrame(() => {
      try {
        inputRef.current?.focus();
        const len = (nextValue ?? (value || "")).length;
        inputRef.current?.setSelectionRange?.(len, len);
      } catch {}
    });
  };

  const handleSelectCountry = (code: string, dialCode?: string) => {
    // Compose next value by swapping leading dial prefix, preserving rest
    const dc =
      dialCode ?? countries.find((x) => x.code === code)?.dialCode ?? "";
    const rest = (value || "").replace(/^(?:\+|00)?\d{1,4}\s?/, "");
    const next = `${dc}${rest ? " " + rest : ""}`;
    phone.setCountry(code);
    onChange(next);
    setOpen(false);
    focusInputEnd(next);
  };

  // Guessing logic moved into usePhone hook.

  // Notify validity changes from hook to parent when requested
  React.useEffect(() => {
    if (onValidityChange)
      onValidityChange(phone.isValid || (!value && !required));
  }, [phone.isValid, onValidityChange, value, required]);

  const inputProps: InputHTMLAttributes<HTMLInputElement> = {
    ...phone.inputProps,
    placeholder,
    disabled,
    "aria-label": ariaLabel,
    "aria-describedby": ariaDescribedBy,
    "aria-invalid": (() => {
      if (!value) return required ? true : undefined;
      return phone.isValid ? undefined : true;
    })(),
    className: [
      "w-full",
      mode === "typeform"
        ? [
            "px-0 py-3 font-light",
            sizeCls,
            "bg-transparent border-0 border-b-2 border-border/30 focus:border-primary focus:outline-none",
            "placeholder:text-muted-foreground/50",
          ].join(" ")
        : sizeCls,
      className,
    ]
      .filter(Boolean)
      .join(" "),
  };

  const renderNativeInput = () => <input ref={inputRef} {...inputProps} />;

  const renderPrimitiveInput = () => {
    if (!Input) return renderNativeInput();
    const Component = Input;
    return <Component ref={inputRef} {...inputProps} />;
  };

  // If no selector primitives are provided, fall back to a plain input
  if (
    !showCountrySelector ||
    !PopoverRoot ||
    !PopoverTrigger ||
    !PopoverContent ||
    !CommandRoot ||
    !CommandList ||
    !CommandItem ||
    !CommandInput
  ) {
    // In typeform mode, render native input to ensure exact bottom-border styling
    if (mode === "typeform") return renderNativeInput();
    return renderPrimitiveInput();
  }

  return (
    <div className={["w-full max-w-2xl", className].filter(Boolean).join(" ")}>
      <div className="flex items-center gap-3">
        <PopoverRoot open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              ref={triggerRef}
              type="button"
              className="inline-flex h-16 items-center gap-2 text-base bg-transparent outline-none focus:outline-none border-b border-input font-light"
              {...phone.triggerProps}
            >
              {selected ? (
                <span className="flex items-center gap-2 text-2xl">
                  <span>{selected.flag}</span>
                </span>
              ) : (
                <span className="text-sm text-muted-foreground text-xl">
                  +1
                </span>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className="p-0"
            style={{
              width:
                triggerWidth && triggerWidth > 0
                  ? Math.max(triggerWidth, 280)
                  : 280,
            }}
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
                <CommandEmptyComp>No results</CommandEmptyComp>
                <CommandGroupComp>
                  {phone.options.map((opt, idx) => (
                    <CommandItem
                      key={opt.code}
                      value={opt.label}
                      onSelect={() => {
                        handleSelectCountry(opt.code, opt.dialCode);
                      }}
                    >
                      <span className="flex items-center gap-2 truncate">
                        <span>{opt.flag}</span>
                        <span className="truncate">{opt.label}</span>
                        <span className="ml-auto text-muted-foreground">
                          {opt.dialCode}
                        </span>
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroupComp>
              </CommandList>
            </CommandRoot>
          </PopoverContent>
        </PopoverRoot>
        {mode === "typeform" ? renderNativeInput() : renderPrimitiveInput()}
      </div>
    </div>
  );
}
