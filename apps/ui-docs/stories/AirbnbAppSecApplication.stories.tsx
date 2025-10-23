"use client";

import React, { useCallback, useMemo, useSyncExternalStore } from "react";
import type { Meta, StoryObj } from "@storybook/react";

import {
  createRuntime,
  type RuntimeContextSnapshot,
  type RuntimeTransport,
} from "@formlink/runtime";
import { Devtools } from "@formlink/runtime/devtools";
import type { Form } from "@formlink/schema";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  Command,
  CommandList,
  CommandGroup,
  CommandItem,
  CommandEmpty,
  CommandInput,
  CommandSeparator,
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverAnchor,
  ScrollArea,
  Separator,
} from "@formlink/ui";
import {
  ShadCnProvider,
  UnifiedDropdownSelect as RUnifiedDropdownSelect,
  UnifiedDropdownMultiSelect as RUnifiedDropdownMultiSelect,
  UnifiedFileUpload as RUnifiedFileUpload,
} from "@formlink/runtime/ui/react";

type Story = StoryObj;

// Airbnb — Application Security Engineer application form (classic, all fields visible)
const AIRBNB_APPSEC_FORM: Form = {
  current_published_version_id: "airbnb_appsec_v1",
  current_draft_version_id: "airbnb_appsec_v1",
  version_id: "airbnb_appsec_v1",
  id: "airbnb_application_security_engineer",
  title: "Airbnb — Application Security Engineer",
  description:
    "Help secure Airbnb’s product surface and developer platform. Share your background and experience across application security, secure SDLC, and threat modeling.",
  questions: [
    {
      id: "q1_full_name",
      questionNo: 1,
      title: "Full name",
      description: "As it appears on your resume or LinkedIn.",
      styling: { colSpan: 12 },
      type: { name: "text", format: "text" },
      validations: {
        required: { value: true, message: "Your name is required." },
      },
      submissionBehavior: "manualAnswer",
    },
    {
      id: "q2_email",
      questionNo: 2,
      title: "Email address",
      description: "We’ll use this for updates on your application.",
      styling: { colSpan: 12 },
      type: { name: "text", format: "email" },
      validations: {
        required: { value: true, message: "Email is required." },
      },
      submissionBehavior: "manualAnswer",
    },
    {
      id: "q3_linkedin",
      questionNo: 3,
      title: "LinkedIn profile URL",
      styling: { colSpan: 12 },
      type: { name: "text", format: "url" },
      validations: {},
      submissionBehavior: "manualAnswer",
    },
    {
      id: "q4_github",
      questionNo: 4,
      title: "GitHub or Portfolio URL (optional)",
      styling: { colSpan: 12 },
      type: { name: "text", format: "url" },
      validations: {},
      submissionBehavior: "manualAnswer",
    },
    {
      id: "q5_years_experience",
      questionNo: 5,
      title: "Years of relevant application security experience",
      styling: { colSpan: 12 },
      type: { name: "text", format: "number" },
      validations: {
        required: { value: true, message: "Please provide a number." },
      },
      submissionBehavior: "manualAnswer",
    },
    {
      id: "q6_primary_domains",
      questionNo: 6,
      title: "Primary security domains",
      description: "Select all that apply.",
      styling: { colSpan: 12 },
      type: {
        name: "multipleChoice",
        display: "dropdown",
        options: [
          { value: "appsec", label: "Application security", score: 3 },
          { value: "sdla", label: "Secure SDLC / developer tooling", score: 3 },
          { value: "threat", label: "Threat modeling", score: 3 },
          {
            value: "sec-code",
            label: "Secure coding / code reviews",
            score: 3,
          },
          { value: "bugbounty", label: "Bug bounty / vuln triage", score: 3 },
          { value: "cloud", label: "Cloud service hardening", score: 3 },
        ],
      },
      validations: {},
      submissionBehavior: "manualAnswer",
    },
    {
      id: "q7_cloud_provider",
      questionNo: 7,
      title: "Primary cloud provider experience",
      styling: { colSpan: 12 },
      type: {
        name: "singleChoice",
        display: "dropdown",
        options: [
          { value: "aws", label: "AWS", score: 3 },
          { value: "gcp", label: "GCP", score: 3 },
          { value: "azure", label: "Azure", score: 3 },
          { value: "multi", label: "Multi-cloud", score: 3 },
          { value: "other", label: "Other / N/A", score: 1 },
        ],
      },
      validations: {},
      submissionBehavior: "manualAnswer",
    },
    {
      id: "q8_location",
      questionNo: 8,
      title: "Current location",
      description: "City, Country (remote considered in select regions).",
      styling: { colSpan: 12 },
      type: {
        name: "singleChoice",
        display: "dropdown",
        options: [
          { value: "sf", label: "San Francisco Bay Area", score: 3 },
          { value: "nyc", label: "New York", score: 3 },
          { value: "la", label: "Los Angeles", score: 2 },
          { value: "seattle", label: "Seattle", score: 2 },
          { value: "remote", label: "Remote", score: 2 },
        ],
      },
      validations: {},
      submissionBehavior: "manualAnswer",
    },
    {
      id: "q9_notice",
      questionNo: 9,
      title: "Notice period / ideal start",
      styling: { colSpan: 12 },
      type: {
        name: "singleChoice",
        display: "dropdown",
        options: [
          { value: "immediate", label: "Immediate / < 2 weeks", score: 4 },
          { value: "1m", label: "1 month", score: 3 },
          { value: "2m", label: "2 months", score: 2 },
          { value: "3m", label: "3+ months", score: 1 },
        ],
      },
      validations: {},
      submissionBehavior: "manualAnswer",
    },
    {
      id: "q10_summary",
      questionNo: 10,
      title: "Briefly describe a security project you led",
      description:
        "Focus on scope, risks addressed, stakeholder collaboration, and measurable outcomes.",
      styling: { colSpan: 12 },
      type: { name: "text", format: "textarea" },
      validations: {},
      submissionBehavior: "manualAnswer",
    },
    {
      id: "q11_resume",
      questionNo: 11,
      title: "Upload your resume (PDF)",
      description: "Attach your latest resume. PDF preferred.",
      styling: { colSpan: 12 },
      type: { name: "fileUpload" },
      validations: {
        required: { value: true, message: "Please attach your resume." },
      },
      submissionBehavior: "manualAnswer",
    },
  ],
};

const MOCK_TRANSPORT: RuntimeTransport = {
  async submit(values: Record<string, unknown>) {
    await new Promise((r) => setTimeout(r, 600));
    return {
      response: { ok: true, values, storedAt: new Date().toISOString() },
    } as any;
  },
  async savePartial() {
    return;
  },
  async upload(questionId: string, file: File | Blob) {
    const objectUrl = file instanceof File ? URL.createObjectURL(file) : "";
    if (objectUrl) {
      queueMicrotask(() => URL.revokeObjectURL(objectUrl));
    }
    return {
      url: objectUrl,
      name: file instanceof File ? file.name : `upload-${questionId}`,
      size: "size" in file ? (file as any).size : 0,
      mimeType: file instanceof File ? file.type : undefined,
    };
  },
};

const runtime = createRuntime({
  form: AIRBNB_APPSEC_FORM,
  transport: MOCK_TRANSPORT,
  uiMode: "classic",
});

const meta: Meta = {
  title: "Form/Airbnb Application Security Engineer",
};

export default meta;

function subscribeRuntime(listener: () => void) {
  return runtime.context.subscribe(() => listener());
}

function getRuntimeSnapshot(): RuntimeContextSnapshot {
  return runtime.context.getSnapshot();
}

function useRuntimeSnapshot() {
  return useSyncExternalStore(
    subscribeRuntime,
    getRuntimeSnapshot,
    getRuntimeSnapshot,
  );
}

function OverviewTab() {
  // Static overview content. Keep qualitative and non-numeric per repo rules.
  return (
    <div className="space-y-6">
      <p className="text-[15px] leading-7 text-muted-foreground">
        Airbnb was born in 2007 when two hosts welcomed three guests to their
        San Francisco home, and has since grown to hosts welcoming guests in
        almost every country across the globe. Every day, hosts offer unique
        stays and experiences that make it possible for guests to connect with
        communities in a more authentic way.
      </p>

      <div className="space-y-2">
        <h3 className="font-medium">The Community You Will Join:</h3>
        <p className="text-[15px] leading-7 text-muted-foreground">
          Airbnb’s Application Security team is focused on making the Airbnb
          platform safer for millions of users around the world. We are a team
          covering a broad range of responsibilities from tool development to
          architectural consulting. We collaborate closely with our product
          teams, integrate security into every stage of development, and empower
          them to build secure features without unnecessary friction.
        </p>
      </div>

      <div className="space-y-2">
        <h3 className="font-medium">The Difference You Will Make:</h3>
        <p className="text-[15px] leading-7 text-muted-foreground">
          The Application Security (AppSec) team works with our product teams to
          ensure we have secure systems and applications. You will build close
          partnerships with engineering across the organization to identify
          security leverage opportunities and drive high‑impact initiatives.
        </p>
      </div>
    </div>
  );
}

// ClassicFieldRow removed; use Field/FieldControl/FieldDescription/FieldMessage inline per spec

function ApplicationTab() {
  const snapshot = useRuntimeSnapshot();
  const { values, errors, status, isSubmitting } = snapshot;

  // Helpers to update values via runtime
  const setValue = useCallback((qid: string, v: unknown) => {
    runtime.actions.set(qid, v);
  }, []);

  const visibleError = useCallback(
    (qid: string) => runtime.context.get.visibleError(qid),
    [],
  );

  const onSubmit = useCallback(async () => {
    await runtime.actions.submit();
  }, []);

  // Map options for selects
  const cloudOptions = useMemo(
    () => [
      { value: "aws", label: "AWS" },
      { value: "gcp", label: "GCP" },
      { value: "azure", label: "Azure" },
      { value: "multi", label: "Multi-cloud" },
      { value: "other", label: "Other / N/A" },
    ],
    [],
  );

  const locationOptions = useMemo(
    () => [
      { value: "sf", label: "San Francisco Bay Area" },
      { value: "nyc", label: "New York" },
      { value: "la", label: "Los Angeles" },
      { value: "seattle", label: "Seattle" },
      { value: "remote", label: "Remote" },
    ],
    [],
  );

  const noticeOptions = useMemo(
    () => [
      { value: "immediate", label: "Immediate / < 2 weeks" },
      { value: "1m", label: "1 month" },
      { value: "2m", label: "2 months" },
      { value: "3m", label: "3+ months" },
    ],
    [],
  );

  const domainOptions = useMemo(
    () => [
      { value: "appsec", label: "Application security" },
      { value: "sdla", label: "Secure SDLC / developer tooling" },
      { value: "threat", label: "Threat modeling" },
      { value: "sec-code", label: "Secure coding / code reviews" },
      { value: "bugbounty", label: "Bug bounty / vuln triage" },
      { value: "cloud", label: "Cloud service hardening" },
    ],
    [],
  );

  // Thank you state
  if (status === "completed") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Thanks for applying to Airbnb!</CardTitle>
          <CardDescription>
            We’ve received your application for the Application Security
            Engineer role. Our team will review your submission and follow up if
            there’s a potential match.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            onClick={() => {
              runtime.actions.reset();
              runtime.actions.start();
            }}
          >
            Start a new application
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Transport error state (optional retry)
  if (status === "error") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Something went wrong</CardTitle>
          <CardDescription>
            Please try submitting again. If the issue persists, try refreshing
            the page.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={async () => {
              await runtime.actions.submit();
            }}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Submitting…" : "Retry submission"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Application</CardTitle>
        <CardDescription>Fill all fields below, then submit.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-2">
          <Label htmlFor="q1_full_name" className="text-base font-medium">
            Full name
          </Label>
          <p className="text-sm text-muted-foreground max-w-[65ch]">
            As it appears on your resume or LinkedIn.
          </p>
          <Input
            id="q1_full_name"
            value={(values["q1_full_name"] as string) ?? ""}
            onChange={(e) => setValue("q1_full_name", e.target.value)}
            onBlur={() => runtime.actions.blur("q1_full_name")}
            placeholder="Jane Doe"
          />
          {visibleError("q1_full_name") && (
            <p className="text-sm text-destructive">
              {visibleError("q1_full_name")}
            </p>
          )}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="q11_resume" className="text-base font-medium">
            Upload your resume (PDF)
          </Label>
          <p className="text-sm text-muted-foreground max-w-[65ch]">
            Attach your latest resume. PDF preferred.
          </p>
          <RUnifiedFileUpload
            mode="typeform"
            questionId="q11_resume"
            onFileUpload={async (files: File[]) => {
              const file = files[0];
              if (!file) return;
              const descriptor = await runtime.actions.upload(
                "q11_resume",
                file,
              );
              runtime.actions.set("q11_resume", descriptor);
            }}
            allowedFileTypes={[
              "application/pdf",
              "application/msword",
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            ]}
          />
          {visibleError("q11_resume") && (
            <p className="text-sm text-destructive">
              {visibleError("q11_resume")}
            </p>
          )}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="q2_email" className="text-base font-medium">
            Email address
          </Label>
          <p className="text-sm text-muted-foreground max-w-[65ch]">
            We’ll use this for updates on your application.
          </p>
          <Input
            id="q2_email"
            type="email"
            value={(values["q2_email"] as string) ?? ""}
            onChange={(e) => setValue("q2_email", e.target.value)}
            onBlur={() => runtime.actions.blur("q2_email")}
            placeholder="name@example.com"
          />
          {visibleError("q2_email") && (
            <p className="text-sm text-destructive">
              {visibleError("q2_email")}
            </p>
          )}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="q3_linkedin" className="text-base font-medium">
            LinkedIn profile URL
          </Label>
          <Input
            id="q3_linkedin"
            type="url"
            value={(values["q3_linkedin"] as string) ?? ""}
            onChange={(e) => setValue("q3_linkedin", e.target.value)}
            onBlur={() => runtime.actions.blur("q3_linkedin")}
            placeholder="https://www.linkedin.com/in/username"
          />
          {visibleError("q3_linkedin") && (
            <p className="text-sm text-destructive">
              {visibleError("q3_linkedin")}
            </p>
          )}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="q4_github" className="text-base font-medium">
            GitHub or Portfolio URL (optional)
          </Label>
          <Input
            id="q4_github"
            type="url"
            value={(values["q4_github"] as string) ?? ""}
            onChange={(e) => setValue("q4_github", e.target.value)}
            onBlur={() => runtime.actions.blur("q4_github")}
            placeholder="https://github.com/username"
          />
          {visibleError("q4_github") && (
            <p className="text-sm text-destructive">
              {visibleError("q4_github")}
            </p>
          )}
        </div>

        <div className="grid gap-2">
          <Label
            htmlFor="q5_years_experience"
            className="text-base font-medium"
          >
            Years of relevant application security experience
          </Label>
          <Input
            id="q5_years_experience"
            inputMode="numeric"
            pattern="[0-9]*"
            value={String(
              (values["q5_years_experience"] as number | string | undefined) ??
                "",
            )}
            onChange={(e) => setValue("q5_years_experience", e.target.value)}
            onBlur={() => runtime.actions.blur("q5_years_experience")}
            placeholder="e.g., 4"
          />
          {visibleError("q5_years_experience") && (
            <p className="text-sm text-destructive">
              {visibleError("q5_years_experience")}
            </p>
          )}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="q6_primary_domains" className="text-base font-medium">
            Primary security domains
          </Label>
          <p className="text-sm text-muted-foreground max-w-[65ch]">
            Select all that apply.
          </p>
          <RUnifiedDropdownMultiSelect
            options={domainOptions}
            value={(
              (values["q6_primary_domains"] as string[] | undefined) ?? []
            ).filter(Boolean)}
            onChange={(next: string[]) => setValue("q6_primary_domains", next)}
            placeholder="Select domains"
            mode="typeform"
          />
          {visibleError("q6_primary_domains") && (
            <p className="text-sm text-destructive">
              {visibleError("q6_primary_domains")}
            </p>
          )}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="q7_cloud_provider" className="text-base font-medium">
            Primary cloud provider experience
          </Label>
          <RUnifiedDropdownSelect
            options={cloudOptions}
            value={
              (values["q7_cloud_provider"] as string | null | undefined) ?? null
            }
            onChange={(next: string | null) =>
              setValue("q7_cloud_provider", next)
            }
            placeholder="Select a cloud provider"
            mode="typeform"
          />
          {visibleError("q7_cloud_provider") && (
            <p className="text-sm text-destructive">
              {visibleError("q7_cloud_provider")}
            </p>
          )}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="q8_location" className="text-base font-medium">
            Current location
          </Label>
          <RUnifiedDropdownSelect
            options={locationOptions}
            value={(values["q8_location"] as string | null | undefined) ?? null}
            onChange={(next: string | null) => setValue("q8_location", next)}
            placeholder="Select a location"
            mode="typeform"
          />
          {visibleError("q8_location") && (
            <p className="text-sm text-destructive">
              {visibleError("q8_location")}
            </p>
          )}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="q9_notice" className="text-base font-medium">
            Notice period / ideal start
          </Label>
          <RUnifiedDropdownSelect
            options={noticeOptions}
            value={(values["q9_notice"] as string | null | undefined) ?? null}
            onChange={(next: string | null) => setValue("q9_notice", next)}
            placeholder="Select notice period"
            mode="typeform"
          />
          {visibleError("q9_notice") && (
            <p className="text-sm text-destructive">
              {visibleError("q9_notice")}
            </p>
          )}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="q10_summary" className="text-base font-medium">
            Briefly describe a security project you led
          </Label>
          <Textarea
            id="q10_summary"
            className="min-h-[120px]"
            value={(values["q10_summary"] as string) ?? ""}
            onChange={(e) => setValue("q10_summary", e.target.value)}
            onBlur={() => runtime.actions.blur("q10_summary")}
            placeholder="Describe scope, risks, collaborators, and results…"
          />
          {visibleError("q10_summary") && (
            <p className="text-sm text-destructive">
              {visibleError("q10_summary")}
            </p>
          )}
        </div>

        <div className="flex justify-end pt-2">
          <Button onClick={onSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Submitting…" : "Submit application"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function AirbnbAppSecTabs() {
  // Keep Storybook controlled with defaultValue="overview"; tabs are client-only UI
  return (
    <Tabs defaultValue="overview" className="w-full">
      <TabsList>
        <TabsTrigger value="overview">Role overview</TabsTrigger>
        <TabsTrigger value="application">Application</TabsTrigger>
      </TabsList>
      <div className="mt-4" />
      <TabsContent value="overview">
        <OverviewTab />
      </TabsContent>
      <TabsContent value="application">
        <ApplicationTab />
      </TabsContent>
    </Tabs>
  );
}

export const Demo: Story = {
  render: () => (
    <div className="mx-auto max-w-6xl px-6 pb-16">
      {/* Faux page header to match screenshot */}
      <div className="flex items-center justify-between py-4">
        <div className="flex items-center gap-2">
          <span className="text-[#FF385C] text-xl">◉</span>
          <span className="font-medium">Careers</span>
        </div>
        <div className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
          <span>Life at Airbnb</span>
          <span>Job Search</span>
        </div>
      </div>

      {/* Hero banner */}
      <div className="rounded-xl border bg-muted/50 p-8 md:p-14">
        <h1 className="text-4xl md:text-5xl font-semibold tracking-tight">
          Application Security Engineer
        </h1>
        <div className="mt-4 text-muted-foreground">United States</div>
      </div>

      {/* Tabs (full width) */}
      <Tabs
        defaultValue="overview"
        className="w-full mt-8"
        orientation="vertical"
      >
        <TabsList className="bg-transparent p-0 rounded-none border-b w-full justify-start">
          <TabsTrigger
            value="overview"
            className="rounded-none bg-transparent data-[state=active]:bg-transparent h-auto px-0 mr-8 pb-3 text-base border-b-[3px] border-transparent data-[state=active]:border-foreground"
          >
            Role overview
          </TabsTrigger>
          <TabsTrigger
            value="application"
            className="rounded-none bg-transparent data-[state=active]:bg-transparent h-auto px-0 mr-8 pb-3 text-base border-b-[3px] border-transparent data-[state=active]:border-foreground"
          >
            Application
          </TabsTrigger>
        </TabsList>
        <div className="mt-6" />
        <TabsContent value="overview" className="outline-none">
          <OverviewTab />
        </TabsContent>
        <TabsContent value="application" className="outline-none">
          <ShadCnProvider
            components={{
              Button,
              Input,
              Textarea,
              Label,
              Badge,
              ScrollArea,
              Separator,
              PopoverRoot: Popover,
              PopoverTrigger,
              PopoverContent,
              PopoverAnchor,
              CommandRoot: Command,
              CommandList,
              CommandItem,
              CommandGroup,
              CommandEmpty,
              CommandInput,
              CommandSeparator,
            }}
          >
            <div className="max-w-3xl">
              <ApplicationTab />
            </div>
          </ShadCnProvider>
        </TabsContent>
      </Tabs>
      {/* Runtime Devtools docked left; always present */}
      <Devtools runtime={runtime} label="Devtools" />
    </div>
  ),
};
