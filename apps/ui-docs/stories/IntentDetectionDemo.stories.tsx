"use client";
import * as React from "react";
import type { Meta, StoryObj } from "@storybook/nextjs";
import {
  PromptInput,
  PromptInputHeader,
  PromptInputTextarea,
  PromptInputSubmit,
} from "@formlink/ui/ai-elements";
import { PromptInputTypedAssist } from "@formlink/runtime/ui/react";

type Story = StoryObj;

const meta: Meta = {
  title: "Chat/Intent Detection Demo",
} as Meta;
export default meta;

export const Demo: Story = {
  render: () => <IntentDemo />,
};

function IntentDemo() {
  const [value, setValue] = React.useState("");
  const [format, setFormat] = React.useState<string | null>(null);
  const formats: Array<string | null> = [
    null,
    "tel",
    "email",
    "url",
    "number",
    "textarea",
    "text",
  ];

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-3">
      <div className="flex items-center gap-2">
        <label className="text-sm">Force format:</label>
        <select
          className="border rounded px-2 py-1 text-sm"
          value={format ?? ""}
          onChange={(e) => setFormat(e.target.value || null)}
        >
          {formats.map((f) => (
            <option key={String(f)} value={f ?? ""}>
              {String(f ?? "(none)")}
            </option>
          ))}
        </select>
      </div>
      <PromptInput onSubmit={() => {}}>
        <PromptInputHeader>
          <div className="flex w-full items-center justify-between">
            <span>Type to test intent detection</span>
            <PromptInputTypedAssist
              expectedFormat={format as any}
              value={value}
              onValueChange={setValue}
            />
          </div>
        </PromptInputHeader>
        <PromptInputTextarea
          value={value}
          onChange={(e) => setValue((e as any).target.value)}
          placeholder="Try: +91 12345 67890, example@example.com, https://example.com, 123.45"
        />
        <PromptInputSubmit />
      </PromptInput>
    </div>
  );
}
