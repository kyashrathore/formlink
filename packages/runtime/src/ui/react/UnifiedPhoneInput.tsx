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
import { AsYouType, parsePhoneNumberFromString } from "libphonenumber-js";
import * as React from "react";
import { buildCountryOptions } from "./country-utils";
import { usePrimitives } from "./primitives/context";

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
  const DEBUG =
    typeof window !== "undefined" &&
    (window as any).__FL_DEBUG_PHONE !== undefined
      ? Boolean((window as any).__FL_DEBUG_PHONE)
      : typeof globalThis !== "undefined" &&
        (globalThis as any).process &&
        (globalThis as any).process.env &&
        (globalThis as any).process.env.NODE_ENV !== "production";

  const dbg = (...args: any[]) => {
    if (DEBUG) console.log("[UnifiedPhoneInput]", ...args);
  };

  const p = usePrimitives();
  const { Input } = p;
  const PopoverRoot = p.PopoverRoot;
  const PopoverTrigger = p.PopoverTrigger;
  const PopoverContent = p.PopoverContent;
  const CommandRoot = p.CommandRoot;
  const CommandList = p.CommandList;
  const CommandItem = p.CommandItem;
  const CommandEmptyComp = (p.CommandEmpty ||
    ((props: any) => <div {...props} />)) as React.ComponentType<any>;
  const CommandGroupComp = (p.CommandGroup ||
    p.CommandRoot ||
    ((props: any) => <div {...props} />)) as React.ComponentType<any>;
  const CommandInput = p.CommandInput;

  const sizeCls =
    mode === "typeform" ? "h-16 text-2xl md:text-3xl" : "h-10 text-sm";
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
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
  // NANP heuristics: explicit mapping for non-US/CA territories and CA area codes.
  // NOTE: We only touch +1 cases here. All other codes rely on libphonenumber
  // parsing (and dial prefix fallback) without special‑casing.
  const NANP_TERRITORIES: Record<string, string> = {
    // Caribbean and others (non-exhaustive but broad coverage)
    "242": "BS", // Bahamas
    "246": "BB", // Barbados
    "264": "AI", // Anguilla
    "268": "AG", // Antigua and Barbuda
    "284": "VG", // British Virgin Islands
    "340": "VI", // U.S. Virgin Islands
    "345": "KY", // Cayman Islands
    "441": "BM", // Bermuda
    "473": "GD", // Grenada
    "649": "TC", // Turks and Caicos Islands
    "664": "MS", // Montserrat
    "670": "MP", // Northern Mariana Islands
    "671": "GU", // Guam
    "684": "AS", // American Samoa
    "721": "SX", // Sint Maarten
    "758": "LC", // Saint Lucia
    "767": "DM", // Dominica
    "784": "VC", // Saint Vincent and the Grenadines
    "787": "PR", // Puerto Rico
    "939": "PR", // Puerto Rico overlay
    "809": "DO", // Dominican Republic
    "829": "DO",
    "849": "DO",
    "868": "TT", // Trinidad and Tobago
    "869": "KN", // Saint Kitts and Nevis
    "876": "JM", // Jamaica
  };
  const CA_AREACODES = new Set<string>([
    // Canada — exhaustive list (as of 2025; see TODO below to auto‑sync)
    // AB
    "403",
    "587",
    "780",
    "825",
    "368", // 368 in AB (overlay)
    // BC
    "236",
    "250",
    "604",
    "672",
    "778",
    // MB
    "204",
    "431",
    "584",
    "474",
    // NB
    "506",
    "428", // 428 (overlay)
    // NL
    "709",
    // NS/PE
    "782",
    "902",
    // NT/NU/YT
    "867",
    // ON (many overlays)
    "226",
    "249",
    "263",
    "289",
    "343",
    "354",
    "365",
    "416",
    "437",
    "519",
    "548",
    "613",
    "647",
    "705",
    "742",
    "753",
    "807",
    "905",
    // QC
    "367",
    "418",
    "438",
    "450",
    "468",
    "514",
    "579",
    "581",
    "873",
    // SK
    "306",
    "639",
  ]);
  // TODO: Consider generating CA_AREACODES (and NANP_TERRITORIES) during build
  // from a vetted source (e.g. react‑international‑phone/countryData) to avoid
  // drift. Our heuristic only runs when digits start with '1' and digits.length>=4.
  const dialToCodes = React.useMemo(() => {
    const map = new Map<string, string[]>();
    for (const c of countries) {
      const dial = c.dialCode.replace("+", "");
      const arr = map.get(dial) ?? [];
      arr.push(c.code);
      map.set(dial, arr);
    }
    return map;
  }, [countries]);
  const sortedDials = React.useMemo(
    () => Array.from(dialToCodes.keys()).sort((a, b) => b.length - a.length),
    [dialToCodes],
  );
  const [country, setCountry] = React.useState<string | null>(
    defaultCountry ?? "US",
  );
  React.useEffect(() => {
    if (!country && defaultCountry) setCountry(defaultCountry);
  }, [defaultCountry, country]);
  const selected = React.useMemo(
    () =>
      country
        ? (countries.find(
            (c) => c.code.toUpperCase() === country.toUpperCase(),
          ) ?? null)
        : null,
    [countries, country],
  );

  const handleSelectCountry = (code: string) => {
    const c = countries.find((x) => x.code === code);
    if (code !== country) dbg("setCountry(select)", country, "->", code);
    setCountry(code);
    if (c) {
      const rest = value.replace(/^(?:\+|00)?\d{1,4}\s?/, "");
      const next = `${c.dialCode}${rest ? " " + rest : ""}`;
      dbg("onSelect compose", { prev: value, next, selected: code });
      onChange(next);
      // move focus to input end
      requestAnimationFrame(() => {
        try {
          inputRef.current?.focus();
          const len = next.length;
          inputRef.current?.setSelectionRange?.(len, len);
        } catch {}
      });
    }
  };

  const guessFromValue = React.useCallback(
    (nv: string) => {
      if (!nv) return;
      const raw = nv.trim();
      const plusForm = raw.startsWith("+")
        ? raw
        : raw.startsWith("00")
          ? `+${raw.slice(2)}`
          : `+${raw}`;
      const digitsOnly = plusForm.slice(1).replace(/\D/g, "");
      if (!digitsOnly) return;
      dbg("guess", { raw, plusForm, digitsOnly, current: country });
      // NANP first: +1 area‑based resolution to avoid flicker
      if (digitsOnly.startsWith("1") && digitsOnly.length >= 4) {
        const area = digitsOnly.slice(1, 4);
        const terr = NANP_TERRITORIES[area];
        if (terr) {
          if (terr !== country) {
            dbg("nanp-territory", area, "->", terr);
            setCountry(terr);
          }
          return; // territory decided; do not fall through
        }
        if (CA_AREACODES.has(area)) {
          if (country !== "CA") {
            dbg("nanp-ca", area, "CA");
            setCountry("CA");
          }
          return; // canada decided; do not fall through
        }
        // Neither territory nor CA: default US
        if (country !== "US") {
          dbg("nanp-default-us", area, "US");
          setCountry("US");
        }
        return;
      }
      // Then try libphonenumber
      try {
        const parsed = parsePhoneNumberFromString(plusForm);
        const c = parsed?.country as string | undefined;
        if (c && c !== country) {
          dbg("lib-country", c);
          setCountry(c);
          return;
        }
      } catch {}
      // Fallback to longest dial prefix match
      const matchDial = sortedDials.find((d) => digitsOnly.startsWith(d));
      if (!matchDial) return;
      const list = dialToCodes.get(matchDial);
      if (!list || list.length === 0) return;
      const pick = list[0];
      if (pick && pick !== country) {
        dbg("prefix-match", matchDial, "->", pick);
        setCountry(pick);
      }
    },
    [sortedDials, dialToCodes, country],
  );

  // Validity tracking and geoguess on value change
  React.useEffect(() => {
    dbg("onValueChange", value);
    if (value) guessFromValue(value);
    // compute validity
    const ensurePlus = (s: string) =>
      s.startsWith("+")
        ? s
        : s.startsWith("00")
          ? `+${s.slice(2)}`
          : s
            ? `+${s}`
            : "";
    const plusForm = ensurePlus((value || "").trim());
    let valid = false;
    if (!plusForm) valid = !required;
    else {
      try {
        const parsed = parsePhoneNumberFromString(plusForm);
        valid = Boolean(parsed?.isValid());
      } catch {
        valid = false;
      }
    }
    onValidityChange?.(valid);
  }, [value, guessFromValue, onValidityChange, required]);

  const inputProps = {
    type: "tel",
    value: value || "",
    placeholder,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      const nv = e.target.value || "";
      guessFromValue(nv);
      // Format as user types using libphonenumber-js AsYouType.
      // Caveats:
      // - Using default metadata: formatting may lag early digits; this is OK.
      // - We normalize 00XX -> +XX for consistent parsing/formatting.
      const ensurePlus = (s: string) =>
        s.startsWith("+")
          ? s
          : s.startsWith("00")
            ? `+${s.slice(2)}`
            : s
              ? `+${s}`
              : "";
      const plusForm = ensurePlus(nv.trim());
      let formatted = plusForm;
      try {
        const typer = new AsYouType();
        formatted = typer.input(plusForm);
      } catch {
        // keep plusForm on formatting errors
      }
      onChange(formatted || null);
    },
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        // prevent advancing when invalid
        const ensurePlus = (s: string) =>
          s.startsWith("+")
            ? s
            : s.startsWith("00")
              ? `+${s.slice(2)}`
              : s
                ? `+${s}`
                : "";
        const plusForm = ensurePlus((value || "").trim());
        let valid = false;
        if (!plusForm) valid = !required;
        else {
          try {
            const parsed = parsePhoneNumberFromString(plusForm);
            valid = Boolean(parsed?.isValid());
          } catch {
            valid = false;
          }
        }
        if (preventInvalidSubmit && !valid) {
          e.preventDefault();
          return;
        }
        onSubmit?.();
      }
    },
    disabled,
    "aria-label": ariaLabel,
    "aria-describedby": ariaDescribedBy,
    ref: inputRef,
    "aria-invalid": (() => {
      const trimmed = (value || "").trim();
      if (!trimmed) return required ? true : undefined;
      const ensurePlus = (s: string) =>
        s.startsWith("+")
          ? s
          : s.startsWith("00")
            ? `+${s.slice(2)}`
            : s
              ? `+${s}`
              : "";
      const plusForm = ensurePlus(trimmed);
      try {
        const parsed = parsePhoneNumberFromString(plusForm);
        return parsed?.isValid() ? undefined : true;
      } catch {
        return true;
      }
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
  } as const;

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
    if (mode === "typeform") return <input {...(inputProps as any)} />;
    if (Input) return <Input {...(inputProps as any)} />;
    return <input {...(inputProps as any)} />;
  }

  return (
    <div className={["w-full max-w-2xl", className].filter(Boolean).join(" ")}>
      <div className="flex items-center gap-3">
        <PopoverRoot open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              ref={triggerRef as any}
              type="button"
              className="inline-flex h-16 items-center gap-2 text-base bg-transparent outline-none focus:outline-none border-b border-input font-light"
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
                  {(query
                    ? countries.filter((c) =>
                        c.name.toLowerCase().includes(query.toLowerCase()),
                      )
                    : countries
                  ).map((c) => (
                    <CommandItem
                      key={c.code}
                      value={c.name}
                      onSelect={() => {
                        handleSelectCountry(c.code);
                        setOpen(false);
                      }}
                    >
                      <span className="flex items-center gap-2 truncate">
                        <span>{c.flag}</span>
                        <span className="truncate">{c.name}</span>
                        <span className="ml-auto text-muted-foreground">
                          {c.dialCode}
                        </span>
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroupComp>
              </CommandList>
            </CommandRoot>
          </PopoverContent>
        </PopoverRoot>
        {mode === "typeform" ? (
          <input {...(inputProps as any)} />
        ) : Input ? (
          <Input {...(inputProps as any)} />
        ) : (
          <input {...(inputProps as any)} />
        )}
      </div>
    </div>
  );
}
