"use client";
import * as React from "react";
import { AsYouType, parsePhoneNumberFromString } from "libphonenumber-js";

// Rich country option used by the phone controller. `label` is a human name,
// `code` is ISO2, and optional `flag`/`dialCode` provide UX details.
export type CountryOption = {
  code: string;
  label: string;
  flag?: string;
  dialCode?: string; // e.g. "+1"
};

export type UsePhoneOptions = {
  value: string;
  onChange: (v: string | null) => void;
  onSubmit?: () => void | Promise<void>;
  preventInvalidSubmit?: boolean;
  defaultCountry?: string; // ISO2
  showCountrySelector?: boolean;
  countryOptions: CountryOption[];
};

export function usePhone(opts: UsePhoneOptions) {
  const {
    value,
    onChange,
    onSubmit,
    preventInvalidSubmit = true,
    defaultCountry,
    showCountrySelector = true,
    countryOptions,
  } = opts;

  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [country, setCountry] = React.useState<string | null>(
    defaultCountry ?? null,
  );

  React.useEffect(() => {
    if (defaultCountry && !country) setCountry(defaultCountry);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultCountry]);

  // Normalize to "+" prefix (00 -> +) for consistent parsing/formatting
  const ensurePlus = React.useCallback((s: string) => {
    if (!s) return "";
    if (s.startsWith("+")) return s;
    if (s.startsWith("00")) return "+" + s.slice(2);
    return "+" + s;
  }, []);

  const formatted = React.useMemo(() => {
    try {
      const plusForm = ensurePlus((value || "").trim());
      const ayt = new AsYouType();
      return ayt.input(plusForm);
    } catch {
      return value || "";
    }
  }, [value, ensurePlus]);

  const parsed = React.useMemo(() => {
    try {
      const plusForm = ensurePlus((value || "").trim());
      const p = parsePhoneNumberFromString(plusForm || "");
      return p ?? null;
    } catch {
      return null;
    }
  }, [value, ensurePlus]);

  const isValid = React.useMemo(() => Boolean(parsed?.isValid?.()), [parsed]);

  const inputProps = {
    type: "tel" as const,
    value: formatted,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value || "";
      const plusForm = ensurePlus(raw.trim());
      // As-you-type formatting (no region bias for parity with previous impl)
      let next = plusForm;
      try {
        const ayt = new AsYouType();
        next = ayt.input(plusForm);
      } catch {}
      onChange(next || null);
      // Guess country based on the updated value
      guessFromValue(next);
    },
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (!preventInvalidSubmit || isValid) void onSubmit?.();
      }
    },
  } as const;

  const triggerProps = showCountrySelector
    ? ({
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
      } as const)
    : ({} as const);

  const filteredCountries = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return countryOptions;
    return countryOptions.filter((c) => c.label.toLowerCase().includes(q));
  }, [countryOptions, query]);

  const getItemProps = (index: number) => {
    const opt = filteredCountries[index]!;
    return {
      role: "option" as const,
      "aria-selected": country === opt.code,
      onClick: () => {
        // On country pick, replace the current dial prefix with the selected one
        // while keeping the rest of the digits. Parity with previous impl.
        const rest = (value || "").replace(/^(?:\+|00)?\d{1,4}\s?/, "");
        const dial = opt.dialCode ?? "";
        const next = dial ? `${dial}${rest ? " " + rest : ""}` : rest;
        setCountry(opt.code);
        setOpen(false);
        onChange(next.length ? next : null);
      },
    } as const;
  };

  const selectedCountryLabel = React.useMemo(() => {
    const found = countryOptions.find((c) => c.code === country);
    return found?.label ?? null;
  }, [countryOptions, country]);

  // --- NANP (+1) heuristics and dial prefix matching ---
  const dialToCodes = React.useMemo(() => {
    const map = new Map<string, string[]>();
    for (const c of countryOptions) {
      const dial = (c.dialCode ?? "").replace("+", "");
      if (!dial) continue;
      const arr = map.get(dial) ?? [];
      arr.push(c.code);
      map.set(dial, arr);
    }
    return map;
  }, [countryOptions]);
  const sortedDials = React.useMemo(
    () => Array.from(dialToCodes.keys()).sort((a, b) => b.length - a.length),
    [dialToCodes],
  );

  // NANP territories map and Canada area codes (subset sufficient for UX parity)
  const NANP_TERRITORIES = React.useRef<Record<string, string>>({
    "242": "BS",
    "246": "BB",
    "264": "AI",
    "268": "AG",
    "284": "VG",
    "340": "VI",
    "345": "KY",
    "441": "BM",
    "473": "GD",
    "649": "TC",
    "664": "MS",
    "670": "MP",
    "671": "GU",
    "684": "AS",
    "721": "SX",
    "758": "LC",
    "767": "DM",
    "784": "VC",
    "787": "PR",
    "939": "PR",
    "809": "DO",
    "829": "DO",
    "849": "DO",
    "868": "TT",
    "869": "KN",
    "876": "JM",
  }).current;
  const CA_AREACODES = React.useRef(
    new Set<string>([
      "403",
      "587",
      "780",
      "825",
      "368",
      "236",
      "250",
      "604",
      "672",
      "778",
      "204",
      "431",
      "584",
      "474",
      "506",
      "428",
      "709",
      "782",
      "902",
      "867",
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
      "367",
      "418",
      "438",
      "450",
      "468",
      "514",
      "579",
      "581",
      "873",
      "306",
      "639",
    ]),
  ).current;

  const guessFromValue = React.useCallback(
    (nv: string) => {
      if (!nv) return;
      const plusForm = ensurePlus((nv || "").trim());
      const digits = plusForm.slice(1).replace(/\D/g, "");
      if (!digits) return;

      // NANP first to prevent flicker between US/CA while typing
      if (digits.startsWith("1") && digits.length >= 4) {
        const area = digits.slice(1, 4);
        const terr = NANP_TERRITORIES[area];
        if (terr) {
          if (terr !== country) setCountry(terr);
          return;
        }
        if (CA_AREACODES.has(area)) {
          if (country !== "CA") setCountry("CA");
          return;
        }
        if (country !== "US") setCountry("US");
        return;
      }

      // libphonenumber country inference
      try {
        const p = parsePhoneNumberFromString(plusForm);
        const c = (p?.country as string | undefined) ?? null;
        if (c && c !== country) {
          setCountry(c);
          return;
        }
      } catch {}

      // Fallback: longest matching dial prefix
      const matchDial = sortedDials.find((d) => digits.startsWith(d));
      if (!matchDial) return;
      const list = dialToCodes.get(matchDial);
      if (!list || list.length === 0) return;
      const pick = list[0];
      if (pick && pick !== country) setCountry(pick);
    },
    [
      ensurePlus,
      country,
      sortedDials,
      dialToCodes,
      NANP_TERRITORIES,
      CA_AREACODES,
    ],
  );

  // React to external value changes by re‑guessing country (and keep validity fresh)
  React.useEffect(() => {
    if (value) guessFromValue(value);
  }, [value, guessFromValue]);

  return {
    inputProps,
    isValid,
    country,
    setCountry,
    open,
    setOpen,
    query,
    setQuery,
    triggerProps,
    options: filteredCountries,
    getItemProps,
    selectedCountryLabel,
  } as const;
}
