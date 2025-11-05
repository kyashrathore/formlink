"use client";
import { useChat } from "@ai-sdk/react";
import { ShadCnProvider, ChatTemplate } from "@formlink/runtime/ui/react";
import {
  Badge,
  Button,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Command as CommandRoot,
  CommandSeparator,
  Input,
  Label,
  PopoverAnchor,
  PopoverContent,
  Popover as PopoverRoot,
  PopoverTrigger,
  ScrollArea,
  Separator,
  Textarea,
} from "@formlink/ui";
import type { Meta, StoryObj } from "@storybook/nextjs";
import * as React from "react";

type Story = StoryObj;

const meta: Meta = {
  title: "Chat/Glue Real Backend",
} as Meta;
export default meta;

// Use relative URLs; Next.js rewrites in apps/ui-docs/next.config.mjs proxy to the backend (e.g., http://localhost:3001) to avoid CORS.
const DEFAULT_BASE = "";
const FORM_ID = "e0ac0a42-a49b-4697-bb2f-8850db4a9270"; // provided

export const WithRealBackend: Story = {
  render: () => <RealBackendDemo baseUrl={DEFAULT_BASE} formId={FORM_ID} />,
};

function RealBackendDemo({
  baseUrl,
  formId,
}: {
  baseUrl: string;
  formId: string;
}) {
  // Static schema provided by user (avoids fetch 404 issues in Storybook)
  const STATIC_FORM_SCHEMA: any = {
    id: formId,
    version_id: "f7c3be3e-1cd5-4389-bfe8-eb10a32dcb04",
    title: "Marketing Agency Lead Generation Form",
    description:
      "Capture key details from potential clients to tailor marketing services.",
    questions: [
      {
        id: "q1",
        page: 1,
        type: { name: "text", format: "text" },
        label: "Company Name",
        title: "Company Name",
        description: "Enter your company's legal name.",
        styling: { colSpan: 12 },
        questionNo: 1,
        validations: {
          required: { value: true, message: "Company name is required." },
        },
        submissionBehavior: "manualUnclear",
      },
      {
        id: "q2",
        page: 1,
        type: { name: "text", format: "text" },
        label: "Contact Person Name",
        title: "Contact Person Name",
        description: "Your full name or primary contact.",
        styling: { colSpan: 12 },
        questionNo: 2,
        validations: {
          required: { value: true, message: "Contact name is required." },
        },
        submissionBehavior: "manualUnclear",
      },
      {
        id: "q3",
        page: 1,
        type: { name: "text", format: "email" },
        label: "Email Address",
        title: "Email Address",
        description: "We'll use this email to reach you.",
        styling: { colSpan: 12 },
        questionNo: 3,
        validations: {
          pattern: {
            value: "^[\\w.%+-]+@[\\w.-]+\\.[A-Za-z]{2,}$",
            message: "Please enter a valid email address.",
          },
          required: { value: true, message: "Email is required." },
        },
        submissionBehavior: "manualUnclear",
      },
      {
        id: "q4",
        page: 2,
        type: { name: "text", format: "tel" },
        label: "Phone Number",
        title: "Phone Number",
        description: "Include your country code if possible.",
        styling: { colSpan: 12 },
        questionNo: 4,
        validations: {
          pattern: {
            value: "^\\+?[0-9\\s-]{7,15}$",
            message: "Please enter a valid phone number.",
          },
          required: { value: true, message: "Phone number is required." },
        },
        submissionBehavior: "manualUnclear",
      },
      {
        id: "q5",
        page: 2,
        type: {
          name: "singleChoice",
          display: "radio",
          options: [
            { label: "Less than $5,000", score: 1, value: "lt5k" },
            { label: "$5,000 - $10,000", score: 2, value: "5k-10k" },
            { label: "$10,000 - $20,000", score: 3, value: "10k-20k" },
            { label: "$20,000 - $50,000", score: 4, value: "20k-50k" },
            { label: "More than $50,000", score: 5, value: "gt50k" },
          ],
        },
        label: "Marketing Budget",
        title: "Marketing Budget",
        description: "Approximate monthly marketing budget.",
        styling: { colSpan: 12 },
        questionNo: 5,
        validations: {
          required: { value: true, message: "Please select a budget range." },
        },
        submissionBehavior: "autoAnswer",
      },
      {
        id: "q6",
        page: 3,
        type: {
          name: "singleChoice",
          display: "radio",
          options: [
            { label: "Brand Awareness", score: 1, value: "brand_awareness" },
            { label: "Lead Generation", score: 2, value: "lead_generation" },
            {
              label: "Search Engine Optimization (SEO)",
              score: 3,
              value: "seo",
            },
            {
              label: "Social Media Marketing",
              score: 4,
              value: "social_media",
            },
            {
              label: "Content Marketing",
              score: 5,
              value: "content_marketing",
            },
            { label: "Other", score: 6, value: "other" },
          ],
        },
        label: "Primary Marketing Goal",
        title: "Primary Marketing Goal",
        description: "What’s the primary objective for your marketing?",
        styling: { colSpan: 12 },
        questionNo: 6,
        validations: {
          required: { value: true, message: "Please select a primary goal." },
        },
        submissionBehavior: "autoAnswer",
      },
      {
        id: "q7",
        page: 3,
        type: { name: "text", format: "textarea" },
        label: "Additional Comments",
        title: "Additional Comments",
        description: "Anything else we should know?",
        styling: { colSpan: 12 },
        questionNo: 7,
        validations: { required: { value: false } },
        submissionBehavior: "manualUnclear",
      },
    ],
    settings: {
      journeyScript: `<form-journey>\n<strategy>\n## Purpose\nCapture essential lead information to enable the agency to propose tailored marketing solutions.\n\n## Audience & Tone\nPotential business owners or marketing decision‑makers; professional yet approachable tone.\n\n## Psychological Frame\n- Reciprocity: Offer valuable insights based on the provided budget.\n- Authority: Position the agency as experts.\n- Commitment: Small initial steps encourage further engagement.\n</strategy>\n\n<value-exchange-strategy>\nProvide a quick, personalized marketing budget benchmark based on the selected budget range before asking for contact details.\n</value-exchange-strategy>\n\n<branching-logic>\n## Conditional Paths\nNo conditional logic\n</branching-logic>\n\n<result-generation>\n## Purpose\nThank the prospect, summarize their inputs, and outline next steps.\n\n## Response Analysis\n- Use budget selection to suggest appropriate service tiers.\n- Highlight the chosen marketing goal.\n\n## Content Structure\n- **Summary**: Thank you and recap of provided information.\n- **Key Insights**: Suggested service tier, primary goal focus.\n- **Score**: Not applicable.\n- **Next Steps**: Schedule a consultation, review the proposal, and contact us.\n\n## Tone and Style\nProfessional | Friendly Expert | Action‑Oriented\n</result-generation>\n</form-journey>`,
    },
  };

  // useChat from AI SDK, pointing to your backend
  const { messages, sendMessage, status } = useChat({
    api: `${baseUrl}/api/ai/chat-assist`,
  });

  return (
    <ShadCnProvider
      components={{
        Button,
        Input,
        Textarea,
        Label,
        Separator,
        Badge,
        ScrollArea,
        PopoverRoot,
        PopoverTrigger,
        PopoverContent,
        PopoverAnchor,
        CommandRoot,
        CommandList,
        CommandItem,
        CommandGroup,
        CommandEmpty,
        CommandInput,
        CommandSeparator,
      }}
    >
      <ChatTemplate
        form={STATIC_FORM_SCHEMA}
        baseUrl={baseUrl}
        controller={{
          messages: messages as any,
          status: status as any,
          sendMessage: sendMessage as any,
        }}
        title="Formlink Assistant"
      />
    </ShadCnProvider>
  );
}
