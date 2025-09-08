"use client";

import type { Meta, StoryObj } from "@storybook/nextjs";
import React, { useState } from "react";
import {
  UnifiedRating,
  UnifiedLinearScale,
  UnifiedMultiSelect,
  UnifiedDatePicker,
  UnifiedAddressInput,
  UnifiedFileUpload,
  UnifiedCountrySelect,
  UnifiedPhoneInput,
  UnifiedRanking,
} from "@formlink/ui";
import { UnifiedLikert, TypeFormTextInput } from "@formlink/ui";
import { ChatTextInputImproved } from "@formlink/ui";

const meta: Meta = {
  title: "Form/Modes Gallery",
} as Meta;

export default meta;
type Story = StoryObj;

const options = [
  { value: "a", label: "Option A" },
  { value: "b", label: "Option B" },
  { value: "c", label: "Option C" },
];

const likertOptions = [
  "Strongly disagree",
  "Disagree",
  "Neutral",
  "Agree",
  "Strongly agree",
];

export const All: Story = {
  render: () => {
    // Chat state
    const [ratingChat, setRatingChat] = useState<number | null>(0);
    const [linearChat, setLinearChat] = useState<number | null>(null);
    const [singleChat, setSingleChat] = useState<string | null>(null);
    const [multiChat, setMultiChat] = useState<string[]>([]);
    const [likertChat, setLikertChat] = useState<string | null>(null);
    const [dateChat, setDateChat] = useState<Date | null>(null);
    const [addressChat, setAddressChat] = useState<any>({
      street1: "",
      street2: "",
      city: "",
      stateProvince: "",
      postalCode: "",
      country: "",
    });
    const [countryChat, setCountryChat] = useState<string | null>(null);
    const [phoneChat, setPhoneChat] = useState<string>("");
    const [rankChat, setRankChat] = useState<string[]>([]);

    // Typeform state
    const [ratingTF, setRatingTF] = useState<number | null>(0);
    const [linearTF, setLinearTF] = useState<number | null>(null);
    const [multiTF, setMultiTF] = useState<string[]>([]);
    const [likertTF, setLikertTF] = useState<string | null>(null);
    const [dateTF, setDateTF] = useState<Date | null>(null);
    const [addressTF, setAddressTF] = useState<any>({
      street1: "",
      street2: "",
      city: "",
      stateProvince: "",
      postalCode: "",
      country: "",
    });
    const [countryTF, setCountryTF] = useState<string | null>(null);
    const [phoneTF, setPhoneTF] = useState<string>("");
    const [rankTF, setRankTF] = useState<string[]>([]);
    const [textTF, setTextTF] = useState<string>("");
    const [textChat, setTextChat] = useState<string>("");

    return (
      <div style={{ padding: 24 }}>
        <h2 style={{ fontSize: 20, margin: "8px 0 16px" }}>Chat Mode</h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: 16,
            marginBottom: 32,
          }}
        >
          <div>
            <h4>Text (indicator)</h4>
            {/* <ChatTextInputImproved
              value={textChat}
              onChange={setTextChat as any}
              label="Your answer"
              placeholder="Type in the chat input below"
            /> */}
            <div>
              ChatTextInputImproved temporarily disabled due to type conflicts
            </div>
          </div>
          <div>
            <h4>Rating</h4>
            <UnifiedRating
              mode="chat"
              value={ratingChat || 0}
              onChange={setRatingChat}
              onSubmit={() => alert(`Chat rating: ${ratingChat}`)}
            />
          </div>
          <div>
            <h4>Linear Scale</h4>
            <UnifiedLinearScale
              mode="chat"
              value={linearChat}
              onChange={setLinearChat}
              onSubmit={() => alert(`Chat scale: ${linearChat}`)}
              config={{
                start: 1,
                end: 5,
                step: 1,
                startLabel: "Low",
                endLabel: "High",
              }}
            />
          </div>
          <div>
            <h4>Single Select</h4>
            <UnifiedMultiSelect
              mode="chat"
              options={options}
              value={singleChat ? [singleChat] : []}
              maxSelections={1}
              onChange={(vals) => setSingleChat(vals[0] || null)}
            />
          </div>
          <div>
            <h4>Multi Select</h4>
            <UnifiedMultiSelect
              mode="chat"
              options={options}
              value={multiChat}
              onChange={setMultiChat}
              onSubmit={() => alert(`Chat multi: ${multiChat.join(", ")}`)}
            />
          </div>
          <div>
            <h4>Likert</h4>
            <UnifiedLikert
              mode="chat"
              options={likertOptions}
              value={likertChat}
              onChange={(v) => setLikertChat(v || null)}
            />
          </div>
          <div>
            <h4>Date</h4>
            <UnifiedDatePicker
              mode="chat"
              value={dateChat}
              onChange={setDateChat}
              onSubmit={() => alert(`Chat date: ${dateChat?.toISOString()}`)}
            />
          </div>
          <div>
            <h4>Address</h4>
            <UnifiedAddressInput
              mode="chat"
              value={addressChat}
              onChange={setAddressChat}
              onSubmit={() => alert(`Chat address set`)}
            />
          </div>
          <div>
            <h4>Country</h4>
            <UnifiedCountrySelect
              mode="chat"
              value={countryChat}
              onChange={setCountryChat}
            />
          </div>
          <div>
            <h4>Phone</h4>
            <UnifiedPhoneInput
              mode="chat"
              value={phoneChat}
              onChange={setPhoneChat}
            />
          </div>
          <div>
            <h4>Ranking</h4>
            <UnifiedRanking
              mode="chat"
              options={options}
              value={rankChat}
              onChange={setRankChat}
              onSubmit={() => alert(`Chat ranking: ${rankChat.join(", ")}`)}
            />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <h4>File Upload</h4>
            <UnifiedFileUpload
              mode="chat"
              value={[]}
              onChange={() => {}}
              onFileUpload={async () => {}}
              onSubmit={() => alert("Chat files submitted")}
            />
          </div>
        </div>

        <h2 style={{ fontSize: 20, margin: "8px 0 16px" }}>Typeform Mode</h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: 16,
          }}
        >
          <div style={{ gridColumn: "1 / -1" }}>
            <h4>Text</h4>
            <TypeFormTextInput
              value={textTF}
              onChange={setTextTF}
              onSubmit={() => console.log("submit text")}
              placeholder="Type your answer..."
            />
          </div>
          <div>
            <h4>Rating</h4>
            <UnifiedRating
              mode="typeform"
              value={ratingTF || 0}
              onChange={setRatingTF}
            />
          </div>
          <div>
            <h4>Linear Scale</h4>
            <UnifiedLinearScale
              mode="typeform"
              value={linearTF}
              onChange={setLinearTF}
              config={{
                start: 1,
                end: 5,
                step: 1,
                startLabel: "Low",
                endLabel: "High",
              }}
            />
          </div>
          <div>
            <h4>Multi Select</h4>
            <UnifiedMultiSelect
              mode="typeform"
              options={options}
              value={multiTF}
              onChange={setMultiTF}
            />
          </div>
          <div>
            <h4>Likert</h4>
            <UnifiedLikert
              mode="typeform"
              options={likertOptions}
              value={likertTF}
              onChange={(v) => setLikertTF(v)}
              showKeyboardHints
            />
          </div>
          <div>
            <h4>Date</h4>
            <UnifiedDatePicker
              mode="typeform"
              value={dateTF}
              onChange={setDateTF}
            />
          </div>
          <div>
            <h4>Address</h4>
            <UnifiedAddressInput
              mode="typeform"
              value={addressTF}
              onChange={setAddressTF}
            />
          </div>
          <div>
            <h4>Country</h4>
            <UnifiedCountrySelect
              mode="typeform"
              value={countryTF}
              onChange={setCountryTF}
              showKeyboardHints
            />
          </div>
          <div>
            <h4>Phone</h4>
            <UnifiedPhoneInput
              mode="typeform"
              value={phoneTF}
              onChange={setPhoneTF}
              defaultCountry="US"
              showCountrySelector
              showFlag
            />
          </div>
          <div>
            <h4>Ranking</h4>
            <UnifiedRanking
              mode="typeform"
              options={options}
              value={rankTF}
              onChange={setRankTF}
            />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <h4>File Upload</h4>
            <UnifiedFileUpload
              mode="typeform"
              value={[]}
              onChange={() => {}}
              questionId="gallery_file"
              onFileUpload={async () => {}}
            />
          </div>
        </div>
      </div>
    );
  },
};
