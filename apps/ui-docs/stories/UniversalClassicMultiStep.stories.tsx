"use client";

import type { Meta, StoryObj } from "@storybook/nextjs";
import type { RuntimeApi } from "@formlink/runtime";
import type { Question } from "@formlink/runtime/schema";
import React from "react";
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
  Button,
  Input,
  Textarea,
  Label,
  Separator,
  Badge,
  ScrollArea,
  // Popover
  Popover as PopoverRoot,
  PopoverTrigger,
  PopoverContent,
  PopoverAnchor,
  // Command
  Command as CommandRoot,
  CommandList,
  CommandItem,
  CommandGroup,
  CommandEmpty,
  CommandInput,
  CommandSeparator,
} from "@formlink/ui";
import { Checkbox } from "@formlink/ui";

const meta: Meta = {
  title: "Universal/Classic Multi-Step",
} as Meta;
export default meta;
type Story = StoryObj;

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

const form: Form = {
  id: "classic_steps_demo",
  version_id: "v1",
  current_published_version_id: null,
  current_draft_version_id: "v1",
  short_id: "classic-steps",
  title: "Apply — Multi‑Step",
  description: "Step through profile, contact, and consent.",
  questions: [
    {
      id: "first_name",
      questionNo: 1,
      title: "First name",
      styling: { colSpan: 12 },
      type: { name: "text", format: "text" },
      validations: { required: { value: true } },
      submissionBehavior: "manualAnswer",
    },
    {
      id: "last_name",
      questionNo: 2,
      title: "Last name",
      styling: { colSpan: 12 },
      type: { name: "text", format: "text" },
      validations: { required: { value: true } },
      submissionBehavior: "manualAnswer",
    },
    {
      id: "email",
      questionNo: 3,
      title: "Email",
      styling: { colSpan: 12 },
      type: { name: "text", format: "email" },
      validations: { required: { value: true } },
      submissionBehavior: "manualAnswer",
    },
    {
      id: "consent_terms",
      questionNo: 4,
      title: "I agree to Terms & Privacy",
      styling: { colSpan: 12 },
      type: {
        name: "singleChoice",
        display: "checkbox",
        options: [{ value: "yes", label: "I agree", score: 0 }],
      },
      validations: { required: { value: true } },
      submissionBehavior: "manualAnswer",
    },
  ],
  settings: { defaultMode: "classic", branching: { enabled: false } },
};

export const Demo: Story = {
  render: () => {
    const rt = React.useMemo(
      () =>
        createRuntime({
          form,
          transport: mockTransportInDraft(),
          uiMode: "classic",
        }),
      [],
    );
    const [step, setStep] = React.useState(0);

    const steps: ClassicNode[][] = [
      [
        {
          kind: "element",
          id: "hdr1",
          colSpan: 12,
          node: () => <h3 className="text-xl font-semibold">Profile</h3>,
        },
        { kind: "field", id: "fn", qId: "first_name", colSpan: 6 },
        { kind: "field", id: "ln", qId: "last_name", colSpan: 6 },
      ],
      [
        {
          kind: "element",
          id: "hdr2",
          colSpan: 12,
          node: () => <h3 className="text-xl font-semibold">Contact</h3>,
        },
        { kind: "field", id: "em", qId: "email", colSpan: 12 },
      ],
      [
        {
          kind: "element",
          id: "hdr3",
          colSpan: 12,
          node: () => <h3 className="text-xl font-semibold">Consent</h3>,
        },
        {
          kind: "field",
          id: "ct",
          qId: "consent_terms",
          colSpan: 12,
          node: (ctx: FieldRendererCtx) => (
            <label className="flex items-start gap-2">
              <Checkbox
                id="consent"
                checked={ctx.value === "yes"}
                onCheckedChange={(ck) => ctx.set(ck === true ? "yes" : null)}
              />
              <span className="text-sm">I agree to Terms & Privacy</span>
            </label>
          ),
        },
      ],
    ];

    // Minimal Devtools support: listen for formlink:devtools:goto and switch step
    const stepIndexByQId = React.useMemo(() => {
      const m = new Map<string, number>();
      steps.forEach((arr, idx) => {
        arr.forEach((n) => {
          if (n.kind === "field") m.set((n as any).qId as string, idx);
        });
      });
      return m;
    }, [steps]);

    React.useEffect(() => {
      const onGoto = (ev: Event) => {
        const e = ev as CustomEvent<{ questionId?: string }>;
        const qid = e.detail?.questionId;
        if (!qid) return;
        const idx = stepIndexByQId.get(qid);
        if (typeof idx === "number") setStep(idx);
      };
      window.addEventListener("formlink:devtools:goto", onGoto as any);
      return () =>
        window.removeEventListener("formlink:devtools:goto", onGoto as any);
    }, [stepIndexByQId]);

    const ActionsBar: ClassicNode = {
      kind: "element",
      id: "actions",
      colSpan: 12,
      node: () => (
        <div className="flex items-center justify-between mt-4">
          <Button
            type="button"
            variant="outline"
            disabled={step === 0}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
          >
            Back
          </Button>
          <Button
            type="button"
            onClick={async () => {
              const s = steps[step] ?? [];
              const qIds = s
                .filter((n) => n.kind === "field")
                .map((n) => (n as any).qId as string);
              const results = await Promise.all(
                qIds.map((id) => rt.actions.validate(id)),
              );
              const allValid = results.every((r) => r.isValid);
              if (!allValid) return;
              if (step < steps.length - 1) setStep((s) => s + 1);
              else await rt.actions.submit();
            }}
          >
            {step < steps.length - 1 ? "Continue" : "Submit"}
          </Button>
        </div>
      ),
    };

    const current = steps[step] ?? [];
    const nodes: ClassicNode[] = [
      {
        kind: "element",
        id: "intro",
        colSpan: 12,
        node: () => (
          <div className="mb-2">
            <div className="text-sm text-muted-foreground">
              Step {step + 1} of {steps.length}
            </div>
            <Separator className="mt-2" />
          </div>
        ),
      },
      ...current,
      ActionsBar,
    ];

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
          <ClassicTemplate nodes={nodes} showDefaultSubmit={false} />
        </RuntimeProvider>
      </ShadCnProvider>
    );
  },
};
