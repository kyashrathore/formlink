import { getCountries, getCountryCallingCode } from "libphonenumber-js";

export function iso2ToFlag(iso2: string): string {
  if (!iso2 || iso2.length !== 2) return "";
  const s = iso2.toUpperCase();
  const base = 0x1f1e6; // Regional Indicator Symbol Letter A
  const ca = base + (s.charCodeAt(0) - 65);
  const cb = base + (s.charCodeAt(1) - 65);
  try {
    return String.fromCodePoint(ca) + String.fromCodePoint(cb);
  } catch {
    return "";
  }
}

export function buildCountryOptions(locale: string = "en"): {
  code: string;
  name: string;
  flag: string;
  dialCode: string;
}[] {
  const dn = ((): Intl.DisplayNames | null => {
    try {
      return new Intl.DisplayNames([locale], { type: "region" });
    } catch {
      return null;
    }
  })();

  const list = getCountries()
    .map((code) => {
      const name = (dn?.of(code) as string) || code;
      const flag = iso2ToFlag(code);
      const dialCode = `+${getCountryCallingCode(code)}`;
      return { code, name, flag, dialCode };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
  return list;
}
