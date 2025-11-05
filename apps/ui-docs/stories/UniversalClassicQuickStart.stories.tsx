"use client";

import {
  createRuntime,
  createMockTransport as mockTransportInDraft,
} from "@formlink/runtime";
import type { Form } from "@formlink/runtime/schema";
import {
  RuntimeProvider,
  ShadCnProvider,
  ClassicTemplate,
} from "@formlink/runtime/ui/react";
import {
  Badge,
  Button,
  Checkbox,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  // Command
  Command as CommandRoot,
  CommandSeparator,
  Input,
  Label,
  PopoverAnchor,
  PopoverContent,
  // Popover
  Popover as PopoverRoot,
  PopoverTrigger,
  ScrollArea,
  Separator,
  Textarea,
} from "@formlink/ui";
import type { Meta, StoryObj } from "@storybook/nextjs";
import { useMemo } from "react";
import type { RuntimeApi } from "@formlink/runtime";
import type { Question } from "@formlink/runtime/schema";

type FieldRendererCtx = {
  q: Question;
  question: Question;
  value: unknown;
  set: (v: unknown) => void;
  error?: string;
  runtime: RuntimeApi;
};

type ClassicNode =
  | {
      kind: "field";
      id?: string;
      qId: string;
      colSpan?: number;
      node?: (ctx: FieldRendererCtx) => React.ReactNode;
    }
  | {
      kind: "element";
      id?: string;
      colSpan?: number;
      node: (schema: any) => React.ReactNode;
    };

const meta: Meta = {
  title: "Universal/Classic Quickstart",
} as Meta;
export default meta;
type Story = StoryObj;

const form: Form = {
  id: "classic_quickstart_demo",
  version_id: "v1",
  current_published_version_id: null,
  current_draft_version_id: "v1",
  short_id: "classic-quickstart",
  title: "Join Rocket Club",
  description: "Get access to member-only meetups and resources.",
  questions: [
    // Two-up row
    {
      id: "first_name",
      questionNo: 1,
      title: "First name",
      styling: { colSpan: 6 },
      validations: { required: { value: true } },
      submissionBehavior: "manualAnswer",
      type: { name: "text", format: "text" },
    },
    {
      id: "last_name",
      questionNo: 2,
      title: "Last name",
      styling: { colSpan: 6 },
      validations: { required: { value: true } },
      submissionBehavior: "manualAnswer",
      type: { name: "text", format: "text" },
    },
    // Full width
    {
      id: "email",
      questionNo: 3,
      title: "Work email",
      styling: { colSpan: 12 },
      validations: { required: { value: true } },
      submissionBehavior: "manualAnswer",
      type: { name: "text", format: "email" },
    },
    // Consent
    {
      id: "consent_terms",
      questionNo: 4,
      title: "I agree to Terms & Privacy",
      styling: { colSpan: 12 },
      validations: { required: { value: true } },
      submissionBehavior: "manualAnswer",
      type: {
        name: "singleChoice",
        display: "checkbox",
        options: [{ value: "yes", label: "I agree", score: 0 }],
      },
    },
  ],
  // nodes will be provided as a prop to the Classic component (not persisted in schema)
  settings: { defaultMode: "classic", branching: { enabled: false } },
};

export const Demo: Story = {
  render: () => {
    const rt = useMemo(
      () =>
        createRuntime({
          form,
          transport: mockTransportInDraft(),
          uiMode: "classic",
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
        <RuntimeProvider runtime={rt} showDevtools>
          <ClassicTemplate
            nodes={
              [
                { kind: "field", id: "n1", qId: "first_name", colSpan: 6 },
                { kind: "field", id: "n2", qId: "last_name", colSpan: 6 },
                { kind: "field", id: "n3", qId: "email", colSpan: 12 },
                {
                  kind: "element",
                  id: "el_info",
                  node: () => (
                    <div className="text-sm text-muted-foreground">
                      We never share your info.
                    </div>
                  ),
                  colSpan: 12,
                },
                {
                  kind: "field",
                  id: "n4",
                  qId: "consent_terms",
                  colSpan: 12,
                  node: (ctx: FieldRendererCtx) => (
                    <label className="flex items-start gap-2">
                      <Checkbox
                        id="consent_terms"
                        checked={ctx.value === "yes"}
                        onCheckedChange={(ck) =>
                          ctx.set(ck === true ? "yes" : null)
                        }
                      />
                      <span className="text-sm">
                        I agree to Terms & Privacy
                      </span>
                    </label>
                  ),
                },
                {
                  kind: "element",
                  id: "el_footer_note",
                  node: () => (
                    <div className="text-xs text-muted-foreground">
                      By continuing you agree to our Terms & Privacy.
                    </div>
                  ),
                  colSpan: 12,
                },
              ] as ClassicNode[]
            }
          />
        </RuntimeProvider>
      </ShadCnProvider>
    );
  },
};
