"use client";

import type { Meta, StoryObj } from "@storybook/react";
import React, { useState } from "react";
import {
  UnifiedRating,
  UnifiedLinearScale,
  UnifiedMultiSelect,
  UnifiedDatePicker,
  UnifiedPhoneInput,
  UnifiedCountrySelect,
  UnifiedAddressInput,
  UnifiedFileUpload,
  UnifiedLikert,
} from "@formlink/ui";

const meta: Meta = {
  title: "Form/Density Demo",
} as Meta;

export default meta;
type Story = StoryObj;

const options = [
  { value: "a", label: "Option A" },
  { value: "b", label: "Option B" },
  { value: "c", label: "Option C" },
];

export const Densities: Story = {
  render: () => {
    const [r1, setR1] = useState<number | null>(0);
    const [r2, setR2] = useState<number | null>(0);
    const [r3, setR3] = useState<number | null>(0);

    const [ms1, setMs1] = useState<string[]>([]);
    const [ms2, setMs2] = useState<string[]>([]);
    const [ms3, setMs3] = useState<string[]>([]);

    const [d1, setD1] = useState<Date | null>(null);
    const [d2, setD2] = useState<Date | null>(null);
    const [d3, setD3] = useState<Date | null>(null);

    return (
      <div style={{ padding: 24 }}>
        <h3>Chat mode (compact / comfy / spacious)</h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 16,
          }}
        >
          <UnifiedRating
            mode="chat"
            density="compact"
            value={r1 || 0}
            onChange={setR1}
          />
          <UnifiedRating
            mode="chat"
            density="comfy"
            value={r2 || 0}
            onChange={setR2}
          />
          <UnifiedRating
            mode="chat"
            density="spacious"
            value={r3 || 0}
            onChange={setR3}
          />

          <UnifiedMultiSelect
            mode="chat"
            density="compact"
            options={options}
            value={ms1}
            onChange={setMs1}
          />
          <UnifiedMultiSelect
            mode="chat"
            density="comfy"
            options={options}
            value={ms2}
            onChange={setMs2}
          />
          <UnifiedMultiSelect
            mode="chat"
            density="spacious"
            options={options}
            value={ms3}
            onChange={setMs3}
          />

          <UnifiedDatePicker
            mode="chat"
            density="compact"
            value={d1}
            onChange={setD1}
          />
          <UnifiedDatePicker
            mode="chat"
            density="comfy"
            value={d2}
            onChange={setD2}
          />
          <UnifiedDatePicker
            mode="chat"
            density="spacious"
            value={d3}
            onChange={setD3}
          />
        </div>

        <h3 className="mt-6">Typeform mode (compact / comfy / spacious)</h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 16,
          }}
        >
          <UnifiedCountrySelect
            mode="typeform"
            className="w-full"
            value={null}
            onChange={() => {}}
          />
          <UnifiedPhoneInput mode="typeform" value="" onChange={() => {}} />
          <UnifiedAddressInput
            mode="typeform"
            value={null}
            onChange={() => {}}
          />

          <UnifiedFileUpload mode="typeform" density="compact" />
          <UnifiedFileUpload mode="typeform" density="comfy" />
          <UnifiedFileUpload mode="typeform" density="spacious" />

          <UnifiedLikert
            mode="typeform"
            density="compact"
            options={["A", "B", "C"]}
            value={null}
            onChange={() => {}}
          />
          <UnifiedLikert
            mode="typeform"
            density="comfy"
            options={["A", "B", "C"]}
            value={null}
            onChange={() => {}}
          />
          <UnifiedLikert
            mode="typeform"
            density="spacious"
            options={["A", "B", "C"]}
            value={null}
            onChange={() => {}}
          />
        </div>
      </div>
    );
  },
};
