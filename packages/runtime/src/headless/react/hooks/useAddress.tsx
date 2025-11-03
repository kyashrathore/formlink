"use client";
import * as React from "react";
import type { AddressData } from "@/schema";

export type UseAddressOptions = {
  value?: AddressData | null;
  onChange: (v: AddressData | null) => void;
  onSubmit?: () => void | Promise<void>;
  required?: boolean;
  requiredFields?: (keyof AddressData)[];
};

export const FIELD_ORDER: (keyof AddressData)[] = [
  "street1",
  "street2",
  "city",
  "stateProvince",
  "postalCode",
  "country",
];

function cloneAddress(a: AddressData | null | undefined): AddressData | null {
  if (!a) return null;
  return {
    street1: a.street1 ?? "",
    street2: a.street2 ?? "",
    city: a.city ?? "",
    stateProvince: a.stateProvince ?? "",
    postalCode: a.postalCode ?? "",
    country: a.country ?? "",
  };
}

function normalizeAddress(a: AddressData): AddressData {
  return {
    street1: (a.street1 ?? "").trim(),
    street2: (a.street2 ?? "").trim(),
    city: (a.city ?? "").trim(),
    stateProvince: (a.stateProvince ?? "").trim(),
    postalCode: (a.postalCode ?? "").trim(),
    country: (a.country ?? "").trim(),
  };
}

export function useAddress(opts: UseAddressOptions) {
  const {
    value,
    onChange,
    onSubmit,
    required,
    requiredFields = FIELD_ORDER,
  } = opts;
  const [local, setLocal] = React.useState<AddressData | null>(
    cloneAddress(value),
  );
  const requiredSet = React.useMemo(
    () => new Set<keyof AddressData>(requiredFields),
    [requiredFields],
  );
  const [touched, setTouched] = React.useState<
    Partial<Record<keyof AddressData, boolean>>
  >({});

  React.useEffect(() => {
    setLocal(cloneAddress(value));
  }, [value]);

  const allRequiredFilled = React.useMemo(() => {
    if (!required) return true;
    const current = local ?? ({} as AddressData);
    for (const f of requiredSet) {
      const v = current[f];
      if (typeof v !== "string" || v.trim().length === 0) return false;
    }
    return true;
  }, [local, required, requiredSet]);

  const setField = (field: keyof AddressData, val: string) => {
    setLocal((prev) => {
      const next = normalizeAddress({
        ...(prev ?? ({} as AddressData)),
        [field]: val,
      });
      onChange(next);
      return next;
    });
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const getValue = (field: keyof AddressData): string => local?.[field] ?? "";

  const onFieldKeyDown =
    (field: keyof AddressData, isLast: boolean, focusNext: () => void) =>
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key !== "Enter" || e.shiftKey) return;
      e.preventDefault();
      if (isLast) {
        if (!required || allRequiredFilled) void onSubmit?.();
      } else {
        focusNext();
      }
    };

  const showAnyError = Boolean(
    required && FIELD_ORDER.some((f) => touched[f]) && !allRequiredFilled,
  );

  return {
    fields: FIELD_ORDER,
    getValue,
    setField,
    onFieldKeyDown,
    requiredSet,
    allRequiredFilled,
    showAnyError,
  } as const;
}
