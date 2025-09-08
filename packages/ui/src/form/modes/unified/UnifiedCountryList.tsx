"use client";

import React, { useMemo } from "react";
import { UnifiedMultiSelect } from "./UnifiedMultiSelect";
import { cn } from "../../../lib/utils";
import { getCountries, getCountryCallingCode } from "libphonenumber-js";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import fullMetadata from "libphonenumber-js/metadata.max.json";

export type FormMode = "chat" | "typeform";

interface Country {
  code: string;
  name: string;
  flag: string;
}

const countryList: Country[] = getCountries()
  .map((countryCode) => {
    const countryName =
      new Intl.DisplayNames(["en"], { type: "region" }).of(countryCode) ||
      countryCode;
    const flag = String.fromCodePoint(
      ...countryCode.split("").map((char) => 0x1f1a5 + char.charCodeAt(0)),
    );
    return { code: countryCode, name: countryName, flag };
  })
  .sort((a, b) => a.name.localeCompare(b.name));

export interface UnifiedCountryListProps {
  mode: FormMode;
  value: string | null; // ISO2 code
  onChange: (value: string | null) => void;
  onSubmit?: () => void;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  density?: "compact" | "comfy" | "spacious";
}

export function UnifiedCountryList({
  mode,
  value,
  onChange,
  onSubmit,
  disabled = false,
  required = false,
  className,
  density,
}: UnifiedCountryListProps) {
  const options = useMemo(
    () =>
      countryList.map((c) => ({
        value: c.code,
        label: `${c.flag} ${c.name}`,
      })),
    [],
  );

  const arrValue = useMemo(() => (value ? [value] : []), [value]);

  return (
    <div className={cn("w-full", className)}>
      <UnifiedMultiSelect
        mode={mode}
        options={options}
        value={arrValue}
        maxSelections={1}
        onChange={(vals: string[]) => onChange(vals[0] ?? null)}
        onSubmit={onSubmit}
        enableSearch
        searchableThreshold={6}
        density={density}
      />
    </div>
  );
}
