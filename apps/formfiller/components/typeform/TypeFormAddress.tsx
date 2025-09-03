"use client";

import { AddressData } from "@formlink/schema";
import { useEffect, useRef, useState } from "react";
import { TypeFormAddressInput } from "./TypeFormAddressInput";

interface TypeFormAddressProps {
  value: AddressData | null;
  onChange?: (value: AddressData | null) => void;
  onCompleteChange?: (value: AddressData | null) => void;
  onSubmit?: () => void;
  required?: boolean;
}

/**
 * TypeFormAddress
 * - A stateful wrapper for UnifiedAddressInput to stabilize its state in Typeform mode.
 * - It maintains a local copy of the address data and syncs with the parent store,
 *   preventing input fields from losing focus or resetting on re-renders.
 * - It calls the parent onChange on every change to keep the main store updated,
 *   but relies on its local state for rendering, providing a stable user experience.
 */
export default function TypeFormAddress({
  value,
  onChange,
  onCompleteChange,
  onSubmit,
  required,
}: TypeFormAddressProps) {
  const [localAddress, setLocalAddress] = useState<AddressData | null>(value);
  const lastCompletedAddressRef = useRef<string | null>(null);

  // Sync local state with parent prop, avoiding unnecessary re-renders
  useEffect(() => {
    if (JSON.stringify(value) !== JSON.stringify(localAddress)) {
      setLocalAddress(value);
    }
  }, [value, localAddress]);

  // Check for address completion and notify parent
  useEffect(() => {
    if (onCompleteChange) {
      const requiredFields: (keyof AddressData)[] = [
        "street1",
        "city",
        "stateProvince",
        "postalCode",
        "country",
      ];
      const isComplete = requiredFields.every(
        (field) => localAddress && localAddress[field],
      );

      const currentAddressString = JSON.stringify(localAddress);

      if (
        isComplete &&
        currentAddressString !== lastCompletedAddressRef.current
      ) {
        onCompleteChange(localAddress);
        lastCompletedAddressRef.current = currentAddressString;
      }
    }
  }, [localAddress, onCompleteChange]);

  const handleLocalChange = (newAddress: AddressData) => {
    setLocalAddress(newAddress);
    onChange?.(newAddress);
  };

  return (
    <TypeFormAddressInput
      value={localAddress}
      onChange={handleLocalChange}
      onSubmit={onSubmit}
      required={required}
    />
  );
}
