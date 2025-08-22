"use client";

import { Input, Label } from "@formlink/ui";
import type { AddressData } from "@formlink/schema";
import type { QuestionResponse } from "@/lib/types";

interface AddressInputProps {
  value: QuestionResponse;
  onChange: (value: AddressData) => void;
  fields?: string[];
  disabled?: boolean;
}

const defaultFields = [
  "street1",
  "street2",
  "city",
  "stateProvince",
  "postalCode",
  "country",
];

const fieldLabels = {
  street1: "Street Address",
  street2: "Apartment, suite, etc. (optional)",
  city: "City",
  stateProvince: "State/Province",
  postalCode: "ZIP/Postal Code",
  country: "Country",
};

const fieldPlaceholders = {
  street1: "123 Main Street",
  street2: "Apt 4B",
  city: "New York",
  stateProvince: "NY",
  postalCode: "10001",
  country: "United States",
};

export default function AddressInput({
  value,
  onChange,
  fields = defaultFields,
  disabled = false,
}: AddressInputProps) {
  // Ensure value is an AddressData object
  const addressValue = (value as AddressData) || {};

  const handleFieldChange = (field: keyof AddressData, fieldValue: string) => {
    const updatedAddress = {
      ...addressValue,
      [field]: fieldValue,
    };
    onChange(updatedAddress);
  };

  return (
    <div className="grid grid-cols-1 gap-4">
      {fields.map((field) => {
        const fieldKey = field as keyof AddressData;
        return (
          <div
            key={field}
            className={field === "street2" ? "grid grid-cols-1" : ""}
          >
            <Label
              htmlFor={`address-${field}`}
              className="text-sm font-medium mb-1"
            >
              {fieldLabels[fieldKey]}
            </Label>
            <Input
              id={`address-${field}`}
              type="text"
              value={addressValue[fieldKey] || ""}
              onChange={(e) => handleFieldChange(fieldKey, e.target.value)}
              placeholder={fieldPlaceholders[fieldKey]}
              disabled={disabled}
              className={
                field === "street1"
                  ? "col-span-full"
                  : field === "street2"
                    ? "col-span-full"
                    : field === "city"
                      ? "col-span-2"
                      : ""
              }
            />
          </div>
        );
      })}

      {/* Layout for city, state, zip */}
      {fields.includes("city") &&
        fields.includes("stateProvince") &&
        fields.includes("postalCode") && (
          <div className="grid grid-cols-6 gap-4 -mt-4">
            {/* City takes more space */}
            <div className="col-span-3">
              <Label
                htmlFor="address-city"
                className="text-sm font-medium mb-1"
              >
                {fieldLabels.city}
              </Label>
              <Input
                id="address-city"
                type="text"
                value={addressValue.city || ""}
                onChange={(e) => handleFieldChange("city", e.target.value)}
                placeholder={fieldPlaceholders.city}
                disabled={disabled}
              />
            </div>

            {/* State */}
            <div className="col-span-2">
              <Label
                htmlFor="address-stateProvince"
                className="text-sm font-medium mb-1"
              >
                {fieldLabels.stateProvince}
              </Label>
              <Input
                id="address-stateProvince"
                type="text"
                value={addressValue.stateProvince || ""}
                onChange={(e) =>
                  handleFieldChange("stateProvince", e.target.value)
                }
                placeholder={fieldPlaceholders.stateProvince}
                disabled={disabled}
              />
            </div>

            {/* ZIP */}
            <div className="col-span-1">
              <Label
                htmlFor="address-postalCode"
                className="text-sm font-medium mb-1"
              >
                ZIP
              </Label>
              <Input
                id="address-postalCode"
                type="text"
                value={addressValue.postalCode || ""}
                onChange={(e) =>
                  handleFieldChange("postalCode", e.target.value)
                }
                placeholder={fieldPlaceholders.postalCode}
                disabled={disabled}
              />
            </div>
          </div>
        )}
    </div>
  );
}
