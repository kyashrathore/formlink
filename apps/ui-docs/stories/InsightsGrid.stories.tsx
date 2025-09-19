"use client";

import type { Meta, StoryObj } from "@storybook/react";
import React from "react";
import InsightsGrid from "../../formcraft/app/dashboard/forms/[formId]/components/responses/insights/InsightsGrid";

type Item = {
  key: React.Key;
  type: string;
  variant?: string;
  node: React.ReactNode;
};

const meta: Meta = {
  title: "Analytics/InsightsGrid",
} as Meta;

export default meta;
type Story = StoryObj;

function MockTile({
  label,
  tone = "default",
}: {
  label: string;
  tone?: "default" | "a" | "b" | "c";
}) {
  const bg =
    tone === "a"
      ? "#EEF6FF"
      : tone === "b"
        ? "#F5F7FF"
        : tone === "c"
          ? "#FFF6EC"
          : "#F7F7F8";
  const bd =
    tone === "a"
      ? "#BFD9FF"
      : tone === "b"
        ? "#D9DDFD"
        : tone === "c"
          ? "#FDDCB8"
          : "#E5E7EB";
  return (
    <div
      style={{
        height: "100%",
        width: "100%",
        background: bg,
        border: `1px solid ${bd}`,
        borderRadius: 8,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 12,
        color: "#333",
      }}
    >
      {label}
    </div>
  );
}

function item(key: string, variant: "small" | "medium" | "large"): Item {
  return {
    key,
    type: "insight",
    variant,
    node: (
      <MockTile
        label={`${variant.toUpperCase()} • ${key}`}
        tone={variant === "large" ? "a" : variant === "medium" ? "b" : "c"}
      />
    ),
  };
}

export const OnlySmall4: Story = {
  name: "4 small",
  render: () => {
    const items: Item[] = [
      item("s1", "small"),
      item("s2", "small"),
      item("s3", "small"),
      item("s4", "small"),
    ];
    return <InsightsGrid items={items as any} />;
  },
};

export const OnlySmall5: Story = {
  name: "5 small (odd)",
  render: () => {
    const items: Item[] = [
      item("s1", "small"),
      item("s2", "small"),
      item("s3", "small"),
      item("s4", "small"),
      item("s5", "small"),
    ];
    return <InsightsGrid items={items as any} />;
  },
};

export const TwoLarge: Story = {
  name: "2 large",
  render: () => {
    const items: Item[] = [item("l1", "large"), item("l2", "large")];
    return <InsightsGrid items={items as any} />;
  },
};

export const LargeAndSmalls: Story = {
  name: "1 large + 4 small",
  render: () => {
    const items: Item[] = [
      item("l1", "large"),
      item("s1", "small"),
      item("s2", "small"),
      item("s3", "small"),
      item("s4", "small"),
    ];
    return <InsightsGrid items={items as any} />;
  },
};

export const MediumsOnly: Story = {
  name: "4 medium",
  render: () => {
    const items: Item[] = [
      item("m1", "medium"),
      item("m2", "medium"),
      item("m3", "medium"),
      item("m4", "medium"),
    ];
    return <InsightsGrid items={items as any} />;
  },
};

export const MediumPlusSmalls1: Story = {
  name: "1 medium + 5 small (fill)",
  render: () => {
    const items: Item[] = [
      item("m1", "small"),
      item("s1", "small"),
      item("s2", "small"),
      item("s3", "small"),
      item("s4", "small"),
      item("s5", "small"),
    ];
    return <InsightsGrid items={items as any} />;
  },
};

export const LargeMediumPlusSmalls: Story = {
  name: "1 medium + 5 small (fill)",
  render: () => {
    const items: Item[] = [
      item("m1", "medium"),
      item("s1", "small"),
      item("s2", "large"),
      item("s3", "small"),
      item("s4", "medium"),
      item("s5", "small"),
    ];
    return <InsightsGrid items={items as any} />;
  },
};

export const MediumPlusSmalls2: Story = {
  name: "m ss l s ll",
  render: () => {
    const items: Item[] = [
      item("m1", "medium"),
      item("s1", "small"),
      item("s2", "small"),
      item("s3", "large"),
      item("s4", "small"),
      item("s5", "large"),
      item("s6", "large"),
    ];
    return <InsightsGrid items={items as any} />;
  },
};

export const StressMixed: Story = {
  name: "Mixed stress: 2 large + 2 medium + 6 small",
  render: () => {
    const items: Item[] = [
      item("l1", "large"),
      item("l2", "large"),
      item("m1", "medium"),
      item("m2", "medium"),
      item("s1", "small"),
      item("s2", "small"),
      item("s3", "small"),
      item("s4", "small"),
      item("s5", "small"),
      item("s6", "small"),
    ];
    return <InsightsGrid items={items as any} />;
  },
};
