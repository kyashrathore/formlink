"use client";

import type { Meta, StoryObj } from "@storybook/nextjs";
import React, { useMemo } from "react";
import {
  createRuntime,
  createMockTransport as mockTransportInDraft,
} from "@formlink/runtime";
import type { Form } from "@formlink/runtime/schema";
import {
  RuntimeProvider,
  ShadCnProvider,
  UniversalTypeform,
} from "@formlink/runtime/ui/react";
import {
  Badge,
  Button,
  Calendar,
  Command as CommandRoot,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  Input,
  Label,
  Popover as PopoverRoot,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
  ScrollArea,
  Separator,
  Textarea,
} from "@formlink/ui";

const meta: Meta = {
  title: "Universal/Typeform Quickstart",
} as Meta;
export default meta;
type Story = StoryObj;

const form: Form = {
  id: "typeform_quickstart_demo",
  version_id: "v1",
  current_published_version_id: null,
  current_draft_version_id: "v1",
  short_id: "tf-quickstart",
  title: "Quick Start (Typeform)",
  description: "A minimal form rendered with UniversalTypeform.",
  questions: [
    {
      id: "q_name",
      questionNo: 1,
      title: "Your name",
      type: { name: "text", format: "text" },
      validations: { required: { value: true } },
      submissionBehavior: "manualAnswer",
      styling: { colSpan: 12 },
    },
    {
      id: "q_email",
      questionNo: 2,
      title: "Email",
      type: { name: "text", format: "email" },
      validations: { required: { value: true } },
      submissionBehavior: "manualAnswer",
      styling: { colSpan: 12 },
    },
    {
      id: "q_role",
      questionNo: 3,
      title: "Role you are interested in",
      type: {
        name: "singleChoice",
        display: "radio",
        options: [
          { value: "fe", label: "Frontend", score: 0 },
          { value: "be", label: "Backend", score: 0 },
          { value: "fs", label: "Full‑stack", score: 0 },
        ],
      },
      validations: { required: { value: true } },
      submissionBehavior: "manualAnswer",
      styling: { colSpan: 12 },
    },
  ],
  settings: { defaultMode: "typeform", branching: { enabled: false } },
};

export const Demo: Story = {
  render: () => {
    const rt = useMemo(
      () =>
        createRuntime({
          form,
          transport: mockTransportInDraft(),
          uiMode: "typeform",
        }),
      [],
    );
    return (
      <ShadCnProvider
        components={{
          Button,
          Input,
          Textarea,
          Label,
          Badge,
          ScrollArea,
          Separator,
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
          Calendar,
        }}
      >
        <RuntimeProvider runtime={rt} showDevtools>
          <UniversalTypeform />
        </RuntimeProvider>
      </ShadCnProvider>
    );
  },
};
