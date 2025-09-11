"use client";

import type { Meta, StoryObj } from "@storybook/react";
import React, { useState } from "react";
import { ChatTemplate } from "./components/ChatTemplate";
import { TypeformTemplate } from "./components/TypeformTemplate";
import {
  ChatSelect,
  UnifiedMultiSelect,
  UnifiedLinearScale,
  UnifiedRating,
  TypeFormTextInput,
} from "@formlink/ui";

const meta: Meta = {
  title: "Form/Templates Demo",
} as Meta;

export default meta;
type Story = StoryObj;

const options = [
  { value: "a", label: "Option A" },
  { value: "b", label: "Option B" },
  { value: "c", label: "Option C" },
];

export const ChatTemplateShowcase: Story = {
  render: () => {
    const [single, setSingle] = useState<string>("");
    const [multi, setMulti] = useState<string[]>([]);
    const [linear, setLinear] = useState<number | null>(null);
    const [rating, setRating] = useState<number | null>(0);

    return (
      <ChatTemplate
        title="Pick one option"
        description="This is a sample question rendered in chat UI."
      >
        <div className="space-y-6">
          <ChatSelect
            options={options}
            value={single}
            onChange={(v) => setSingle(v ?? "")}
            onSubmit={() => console.log("selected", single)}
          />
          <UnifiedMultiSelect
            mode="chat"
            options={options}
            value={multi}
            onChange={setMulti}
            onSubmit={() => console.log("multi", multi)}
          />
          <UnifiedLinearScale
            mode="chat"
            value={linear}
            onChange={setLinear}
            onSubmit={() => console.log("linear", linear)}
            config={{
              start: 1,
              end: 5,
              step: 1,
              startLabel: "Low",
              endLabel: "High",
            }}
          />
          <UnifiedRating
            mode="chat"
            value={rating || 0}
            onChange={setRating}
            onSubmit={() => console.log("rating", rating)}
          />
        </div>
      </ChatTemplate>
    );
  },
};

export const TypeformTemplateShowcase: Story = {
  render: () => {
    const [text, setText] = useState<string>("");
    const [linear, setLinear] = useState<number | null>(null);
    const [rating, setRating] = useState<number | null>(0);

    return (
      <TypeformTemplate
        title="Tell us about yourself"
        description="Typeform-style wrapper around any input"
      >
        <div className="space-y-6">
          <TypeFormTextInput
            value={text}
            onChange={setText}
            onSubmit={() => console.log("text", text)}
            placeholder="Type here..."
          />
          <UnifiedLinearScale
            mode="typeform"
            value={linear}
            onChange={setLinear}
            config={{
              start: 1,
              end: 5,
              step: 1,
              startLabel: "Low",
              endLabel: "High",
            }}
          />
          <UnifiedRating
            mode="typeform"
            value={rating || 0}
            onChange={setRating}
          />
        </div>
      </TypeformTemplate>
    );
  },
};
