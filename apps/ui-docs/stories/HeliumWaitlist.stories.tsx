"use client";

// Completely rewritten to showcase every supported schema type.
// Each question declares its own `type`, and the renderer maps 1:1.

import type { Meta, StoryObj } from "@storybook/react";
import React, { useCallback, useSyncExternalStore } from "react";

import {
  createMockTransport,
  createRuntime,
  type RuntimeContextSnapshot,
} from "@formlink/runtime";

import type { Form, Question } from "@formlink/runtime/schema";

import {
  buildCountryOptions,
  InlineMultiSelect as RInlineMultiSelect,
  InlineRanking as RInlineRanking,
  InlineRating as RInlineRating,
  InlineSelect as RInlineSelect,
  InlineSignature as RInlineSignature,
  TypeFormContinueFooter as RTContinueFooter,
  TypeFormLayout as RTLayout,
  TypeFormNavigation as RTNavigation,
  TypeFormProgress as RTProgress,
  TypeFormQuestionHeader as RTQuestionHeader,
  TypeFormTransition as RTTransition,
  UnifiedCountrySelect as RUnifiedCountrySelect,
  UnifiedDatePicker as RUnifiedDatePicker,
  UnifiedDropdownMultiSelect as RUnifiedDropdownMultiSelect,
  UnifiedDropdownSelect as RUnifiedDropdownSelect,
  UnifiedFileUpload as RUnifiedFileUpload,
  UnifiedPhoneInput as RUnifiedPhoneInput,
  RuntimeProvider,
  ShadCnProvider,
  TypeFormTextInput,
} from "@formlink/runtime/ui/react";

// Unified components available only from @formlink/ui today
import {
  UnifiedAddressInput,
  UnifiedLikert,
  UnifiedLinearScale,
} from "@formlink/ui";

// Host primitives passed into the runtime UI provider
import {
  Badge,
  Button,
  Calendar,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  Input,
  Label,
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
  ScrollArea,
  Separator,
  Textarea,
} from "@formlink/ui";

type Story = StoryObj;

type RuntimeQuestion = Question;

// Form schema with one question per supported type (per docs/runtime/formlink-runtime-spec_v1.md)
const FORM_ALL_TYPES: Form = {
  current_published_version_id: "helium_waitlist_all_types_v1",
  current_draft_version_id: "helium_waitlist_all_types_v1",
  version_id: "helium_waitlist_all_types_v1",
  id: "helium_browser_waitlist_all_types",
  title: "Helium Waitlist — All Inputs",
  description: "Demo of every supported question type wiring to the runtime.",
  questions: [
    // text: text
    {
      id: "q1_full_name",
      questionNo: 1,
      title: "Your full name",
      styling: { colSpan: 12 },
      type: { name: "text", format: "text" },
      validations: {
        required: { value: true, message: "Please enter your name." },
        minLength: { value: 2, message: "Name looks too short." },
      },
      submissionBehavior: "manualAnswer",
    },
    // text: email
    {
      id: "q2_email",
      questionNo: 2,
      title: "Email address",
      description: "We’ll send your beta invite here.",
      styling: { colSpan: 12 },
      type: { name: "text", format: "email" },
      validations: {
        required: { value: true, message: "Email is required." },
      },
      submissionBehavior: "manualAnswer",
    },
    // text: tel → UnifiedPhoneInput
    {
      id: "q3_phone",
      questionNo: 3,
      title: "Phone number (optional)",
      styling: { colSpan: 12 },
      type: { name: "text", format: "tel" },
      validations: {},
      submissionBehavior: "manualAnswer",
    },
    // text: country → UnifiedCountrySelect
    {
      id: "q4_country",
      questionNo: 4,
      title: "Country",
      styling: { colSpan: 12 },
      type: { name: "text", format: "country" },
      validations: { required: { value: true } },
      submissionBehavior: "manualAnswer",
    },
    // text: url
    {
      id: "q5_website",
      questionNo: 5,
      title: "Personal website (optional)",
      styling: { colSpan: 12 },
      type: { name: "text", format: "url" },
      validations: {},
      submissionBehavior: "manualAnswer",
    },
    // text: password (demo purposes)
    {
      id: "q6_pass",
      questionNo: 6,
      title: "Create a demo password",
      description: "Not submitted anywhere — demo only.",
      styling: { colSpan: 12 },
      type: { name: "text", format: "password" },
      validations: { minLength: { value: 8, message: "8+ characters" } },
      submissionBehavior: "manualAnswer",
    },
    // text: textarea
    {
      id: "q7_bio",
      questionNo: 7,
      title: "What excites you about Helium? (optional)",
      styling: { colSpan: 12 },
      type: { name: "text", format: "textarea" },
      validations: {},
      submissionBehavior: "manualAnswer",
    },
    // singleChoice short → InlineSelect
    {
      id: "q8_platform",
      questionNo: 8,
      title: "Primary platform",
      styling: { colSpan: 12 },
      type: {
        name: "singleChoice",
        display: "radio",
        options: [
          { value: "ios", label: "iOS", score: 1 },
          { value: "android", label: "Android", score: 1 },
          { value: "macos", label: "macOS", score: 1 },
          { value: "windows", label: "Windows", score: 1 },
        ],
      },
      validations: { required: { value: true } },
      submissionBehavior: "manualAnswer",
    },
    // singleChoice long → DropdownSelect
    {
      id: "q9_language",
      questionNo: 9,
      title: "Preferred language",
      styling: { colSpan: 12 },
      type: {
        name: "singleChoice",
        display: "dropdown",
        options: [
          { value: "en", label: "English", score: 1 },
          { value: "es", label: "Spanish", score: 1 },
          { value: "hi", label: "Hindi", score: 1 },
          { value: "fr", label: "French", score: 1 },
          { value: "de", label: "German", score: 1 },
          { value: "ja", label: "Japanese", score: 1 },
          { value: "zh", label: "Chinese", score: 1 },
          { value: "pt", label: "Portuguese", score: 1 },
        ],
      },
      validations: { required: { value: true } },
      submissionBehavior: "manualAnswer",
    },
    // multipleChoice short → InlineMultiSelect (checklist with keyboard hints)
    {
      id: "q10_interests",
      questionNo: 10,
      title: "Which features interest you? (select all that apply)",
      styling: { colSpan: 12 },
      type: {
        name: "multipleChoice",
        display: "checkbox",
        options: [
          { value: "privacy", label: "Privacy", score: 1 },
          { value: "speed", label: "Speed", score: 1 },
          { value: "ai", label: "Built‑in AI", score: 1 },
          { value: "extensions", label: "Extensions", score: 1 },
        ],
      },
      validations: {},
      submissionBehavior: "manualAnswer",
    },
    // multipleChoice long → DropdownMultiSelect
    {
      id: "q11_frameworks",
      questionNo: 11,
      title: "Frameworks you use (multi‑select)",
      styling: { colSpan: 12 },
      type: {
        name: "multipleChoice",
        display: "multiSelectDropdown",
        options: [
          { value: "react", label: "React", score: 1 },
          { value: "vue", label: "Vue", score: 1 },
          { value: "svelte", label: "Svelte", score: 1 },
          { value: "angular", label: "Angular", score: 1 },
          { value: "solid", label: "Solid", score: 1 },
          { value: "next", label: "Next.js", score: 1 },
          { value: "nuxt", label: "Nuxt", score: 1 },
          { value: "astro", label: "Astro", score: 1 },
        ],
      },
      validations: {},
      submissionBehavior: "manualAnswer",
    },
    // rating
    {
      id: "q12_rating",
      questionNo: 12,
      title: "How excited are you for Helium?",
      styling: { colSpan: 12 },
      type: { name: "rating", config: { min: 1, max: 5, step: 1 } },
      validations: { required: { value: true } },
      submissionBehavior: "manualAnswer",
    },
    // linearScale
    {
      id: "q13_linear",
      questionNo: 13,
      title: "Rate your browser performance needs",
      styling: { colSpan: 12 },
      type: {
        name: "linearScale",
        config: {
          start: 1,
          end: 7,
          step: 1,
          startLabel: "Low",
          endLabel: "High",
        },
      },
      validations: {},
      submissionBehavior: "manualAnswer",
    },
    // likertScale
    {
      id: "q14_likert",
      questionNo: 14,
      title: "Helium aligns with my values",
      styling: { colSpan: 12 },
      type: {
        name: "likertScale",
        options: [
          "Strongly disagree",
          "Disagree",
          "Neutral",
          "Agree",
          "Strongly agree",
        ],
      },
      validations: {},
      submissionBehavior: "manualAnswer",
    },
    // ranking
    {
      id: "q15_ranking",
      questionNo: 15,
      title: "Rank what matters most",
      styling: { colSpan: 12 },
      type: {
        name: "ranking",
        options: [
          { value: "privacy", label: "Privacy", score: 1 },
          { value: "speed", label: "Speed", score: 1 },
          { value: "features", label: "Features", score: 1 },
          { value: "design", label: "Design", score: 1 },
        ],
      },
      validations: {},
      submissionBehavior: "manualAnswer",
    },
    // date
    {
      id: "q16_date",
      questionNo: 16,
      title: "When did you last switch browsers?",
      styling: { colSpan: 12 },
      type: { name: "date", format: "date" },
      validations: {},
      submissionBehavior: "manualAnswer",
    },
    // fileUpload
    {
      id: "q17_resume",
      questionNo: 17,
      title: "Upload a sample file (demo)",
      styling: { colSpan: 12 },
      type: { name: "fileUpload" },
      validations: {},
      submissionBehavior: "manualAnswer",
    },
    // signature
    {
      id: "q18_signature",
      questionNo: 18,
      title: "Sign to confirm interest (demo)",
      styling: { colSpan: 12 },
      type: { name: "signature" },
      validations: {},
      submissionBehavior: "manualAnswer",
    },
    // address
    {
      id: "q19_address",
      questionNo: 19,
      title: "Shipping address (optional)",
      styling: { colSpan: 12 },
      type: { name: "address" },
      validations: {},
      submissionBehavior: "manualAnswer",
    },
  ],
};

const runtime = createRuntime({
  form: FORM_ALL_TYPES,
  transport: createMockTransport(),
  uiMode: "typeform",
});

const meta: Meta = { title: "Form/Helium All Inputs (Typeform)" };
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

function getQuestionNumber(questionId: string | null, eligibleIds: string[]) {
  if (!questionId) return null;
  const index = eligibleIds.findIndex((id) => id === questionId);
  return index === -1 ? null : index + 1;
}

function HeliumAllInputs() {
  const snapshot = useRuntimeSnapshot();
  const { status, currentId, firstUnansweredId, isSubmitting, eligibleIds } =
    snapshot;

  const activeQuestionId =
    currentId ?? firstUnansweredId ?? eligibleIds[0] ?? null;
  const activeQuestion = activeQuestionId
    ? (runtime.context.get.q(activeQuestionId) as RuntimeQuestion | undefined)
    : undefined;

  const questionNumber = getQuestionNumber(activeQuestionId, eligibleIds);

  // Error reveal: track fields that have failed validation at least once
  const [revealedErrors, setRevealedErrors] = React.useState<Set<string>>(
    new Set(),
  );
  const [isCurrentInvalid, setIsCurrentInvalid] = React.useState(false);

  const footerErrorMessage = activeQuestionId
    ? runtime.context.get.visibleError(activeQuestionId)
    : undefined;

  const handleStart = useCallback(() => runtime.actions.start(), []);
  const handleRestart = useCallback(() => {
    runtime.actions.reset();
    runtime.actions.start();
  }, []);
  const handleBack = useCallback(() => runtime.actions.prev(), []);
  const handleContinue = useCallback(async () => {
    if (!activeQuestionId) {
      await runtime.actions.next();
      return;
    }
    const res = await runtime.actions.validate(activeQuestionId);
    if (res.isValid) {
      const hasNext = snapshot.progress.index < snapshot.progress.total - 1;
      if (hasNext) await runtime.actions.next();
      else await runtime.actions.submit();
    } else {
      setRevealedErrors((prev) => new Set(prev).add(activeQuestionId));
    }
  }, [activeQuestionId, snapshot.progress.index, snapshot.progress.total]);

  // Live-validate current once revealed
  React.useEffect(() => {
    if (!activeQuestionId) return;
    if (!revealedErrors.has(activeQuestionId)) {
      setIsCurrentInvalid(false);
      return;
    }
    let cancelled = false;
    runtime.actions
      .validate(activeQuestionId)
      .then((res) => {
        if (cancelled) return;
        setIsCurrentInvalid(!res.isValid);
        if (res.isValid)
          setRevealedErrors((prev) => {
            const next = new Set(prev);
            next.delete(activeQuestionId);
            return next;
          });
      })
      .catch(() => void 0);
    return () => {
      cancelled = true;
    };
  }, [activeQuestionId, revealedErrors]);

  // Render per question type (strict 1:1 mapping)
  const renderQuestion = () => {
    if (!activeQuestion || !activeQuestionId) {
      return (
        <p className="text-muted-foreground">
          Answer the questions to continue.
        </p>
      );
    }

    const q = activeQuestion as RuntimeQuestion;
    const name = (q.type as any).name as RuntimeQuestion["type"]["name"]; // discriminant

    // Helpers
    const setVal = (v: unknown) => runtime.actions.set(q.id, v);

    // text family
    if (name === "text") {
      const fmt = (q.type as any).format as string;
      if (fmt === "textarea") {
        return (
          <TypeFormTextInput
            key={q.id}
            value={String(runtime.context.get.value(q.id) ?? "")}
            onChange={(v) => setVal(v)}
            onSubmit={handleContinue}
            placeholder="Type your answer…"
          />
        );
      }
      if (fmt === "country") {
        const countryOptions = buildCountryOptions();
        const val = runtime.context.get.value<string | null>(q.id) ?? null;
        return (
          <RUnifiedCountrySelect
            mode="typeform"
            options={countryOptions}
            value={val}
            onChange={(next) => setVal(next)}
            onSubmit={handleContinue}
          />
        );
      }
      if (fmt === "tel") {
        const val = String(runtime.context.get.value(q.id) ?? "");
        return (
          <RUnifiedPhoneInput
            mode="typeform"
            value={val}
            onChange={(next) => setVal(next)}
            // prevent advancing on Enter if invalid
            preventInvalidSubmit
            onSubmit={handleContinue}
          />
        );
      }
      const inputType =
        fmt === "email" ||
        fmt === "url" ||
        fmt === "password" ||
        fmt === "number"
          ? fmt
          : "text";
      return (
        <TypeFormTextInput
          key={q.id}
          type={inputType}
          value={String(runtime.context.get.value(q.id) ?? "")}
          onChange={(v) => setVal(v)}
          onSubmit={handleContinue}
          placeholder="Type your answer…"
        />
      );
    }

    // singleChoice
    if (name === "singleChoice") {
      const raw = (q.type as any).options as Array<{
        value: string;
        label: string;
      }>;
      const options = raw.map((o) => ({ value: o.value, label: o.label }));
      const val = runtime.context.get.value<string | null>(q.id) ?? null;
      if (options.length > 0 && options.length < 6) {
        return (
          <RInlineSelect
            options={options}
            value={val}
            onChange={(next) => setVal(next)}
            onSubmit={handleContinue}
            autoFocus
            showKeyboardHints
          />
        );
      }
      return (
        <RUnifiedDropdownSelect
          mode="typeform"
          options={options}
          value={val}
          onChange={(next) => setVal(next)}
          onSubmit={handleContinue}
          placeholder="Select an option…"
        />
      );
    }

    // multipleChoice
    if (name === "multipleChoice") {
      const raw = (q.type as any).options as Array<{
        value: string;
        label: string;
      }>;
      const options = raw.map((o) => ({ value: o.value, label: o.label }));
      const rawVal = runtime.context.get.value(q.id);
      const valArr: string[] = Array.isArray(rawVal)
        ? (rawVal as string[])
        : typeof rawVal === "string"
          ? (() => {
              try {
                const parsed = JSON.parse(rawVal);
                return Array.isArray(parsed) ? parsed : [];
              } catch {
                return [];
              }
            })()
          : [];
      if (options.length > 0 && options.length < 6) {
        return (
          <RInlineMultiSelect
            options={options}
            value={valArr}
            onChange={(arr) => setVal(arr)}
            onSubmit={handleContinue}
          />
        );
      }
      return (
        <RUnifiedDropdownMultiSelect
          mode="typeform"
          options={options}
          value={valArr}
          onChange={(arr) => setVal(arr)}
          onSubmit={handleContinue}
        />
      );
    }

    // rating
    if (name === "rating") {
      const cfg = (q.type as any).config as
        | { min: number; max: number }
        | undefined;
      const max = cfg?.max ?? 5;
      const val = runtime.context.get.value<number | null>(q.id) ?? null;
      return (
        <RInlineRating
          value={val}
          onChange={(n) => setVal(n)}
          onSubmit={handleContinue}
          max={max}
          autoFocus
        />
      );
    }

    // linearScale
    if (name === "linearScale") {
      const cfg = (q.type as any).config as {
        start: number;
        end: number;
        step: number;
        startLabel?: string;
        endLabel?: string;
      };
      const val = runtime.context.get.value<number | null>(q.id) ?? null;
      return (
        <UnifiedLinearScale
          mode="typeform"
          value={val}
          onChange={(n) => setVal(n)}
          onSubmit={handleContinue}
          config={cfg}
        />
      );
    }

    // likertScale
    if (name === "likertScale") {
      const options = (q.type as any).options as string[];
      const val = runtime.context.get.value<string | null>(q.id) ?? null;
      return (
        <UnifiedLikert
          mode="typeform"
          options={options}
          value={val}
          onChange={(v) => setVal(v)}
          onSubmit={handleContinue}
        />
      );
    }

    // ranking
    if (name === "ranking") {
      const raw = (q.type as any).options as Array<{
        value: string;
        label: string;
      }>;
      const options = raw.map((o) => ({ value: o.value, label: o.label }));
      const val = (runtime.context.get.value<string[] | null>(q.id) ??
        []) as string[];
      return (
        <RInlineRanking
          options={options}
          value={val}
          onChange={(arr) => setVal(arr)}
          onSubmit={handleContinue}
        />
      );
    }

    // date
    if (name === "date") {
      const raw = runtime.context.get.value(q.id);
      const val: string | null = typeof raw === "string" ? raw : null;
      return (
        <RUnifiedDatePicker
          mode="typeform"
          value={val}
          onChange={(next) => setVal(next)}
        />
      );
    }

    // fileUpload
    if (name === "fileUpload") {
      return (
        <RUnifiedFileUpload
          mode="typeform"
          questionId={q.id}
          // Accept both call shapes; UI will call (questionId, file) in typeform mode.
          onFileUpload={
            ((...args: any[]) => {
              const [maybeQid, maybeFile] = args;

              const qid = typeof maybeQid === "string" ? maybeQid : q.id;

              const file: File | undefined =
                typeof maybeQid === "string"
                  ? (maybeFile as File)
                  : (maybeQid?.[0] as File | undefined);

              if (!file) return Promise.resolve();
              return runtime.actions.upload(qid, file).then((desc) => {
                // Runtime schema expects a FileDescriptor object
                runtime.actions.set(qid, desc as any);
              });
            }) as any
          }
        />
      );
    }

    // signature
    if (name === "signature") {
      const val = runtime.context.get.value<string | null>(q.id) ?? null;
      return (
        <RInlineSignature
          value={val}
          onChange={(s) => setVal(s)}
          onSubmit={handleContinue}
        />
      );
    }

    // address
    if (name === "address") {
      const val = (runtime.context.get.value(q.id) ?? null) as any;
      return (
        <UnifiedAddressInput
          mode="typeform"
          value={val}
          onChange={(addr) => setVal(addr)}
        />
      );
    }

    return (
      <p className="text-muted-foreground">
        Unsupported question type in this demo.
      </p>
    );
  };

  // Full-page Typeform style
  if (status === "idle") {
    return (
      <RTLayout>
        <div className="space-y-6">
          <h1 className="text-3xl md:text-4xl font-semibold">
            {runtime.context.form.title}
          </h1>
          {runtime.context.form.description && (
            <p className="text-muted-foreground text-base md:text-lg max-w-2xl">
              {runtime.context.form.description}
            </p>
          )}
          <div className="pt-2">
            <Button size="lg" onClick={handleStart}>
              Start
            </Button>
          </div>
        </div>
      </RTLayout>
    );
  }

  if (status === "completed") {
    return (
      <RTLayout>
        <div className="space-y-4">
          <h2 className="text-2xl md:text-3xl font-semibold">
            Thanks — recorded!
          </h2>
          <p className="text-muted-foreground">You can restart to try again.</p>
          <div className="pt-2">
            <Button variant="outline" onClick={handleRestart}>
              Restart
            </Button>
          </div>
        </div>
      </RTLayout>
    );
  }

  return (
    <>
      <RTLayout>
        <RTProgress
          progress={snapshot.progress.percent}
          current={snapshot.progress.index + 1}
          total={snapshot.progress.total}
        />
        <RTTransition questionId={activeQuestionId ?? "intro"}>
          {activeQuestion && (
            <>
              <RTQuestionHeader
                question={activeQuestion}
                questionNumber={snapshot.progress.index + 1}
              />
              <div className="mt-6 space-y-6">
                {renderQuestion()}
                {activeQuestionId &&
                  runtime.context.get.visibleError(activeQuestionId) && (
                    <p className="text-sm text-destructive">
                      {runtime.context.get.visibleError(activeQuestionId)}
                    </p>
                  )}
              </div>
              <RTContinueFooter
                onClick={handleContinue}
                isLoadingNext={isSubmitting}
                errorMessage={footerErrorMessage}
              />
            </>
          )}
        </RTTransition>
        {status === "filling" && (
          <RTNavigation
            onPrevious={handleBack}
            onNext={handleContinue}
            canGoPrevious={Boolean(
              questionNumber && questionNumber > 1 && !isSubmitting,
            )}
            isLoadingNext={isSubmitting}
          />
        )}
      </RTLayout>
    </>
  );
}

export const Demo: Story = {
  render: () => (
    <ShadCnProvider
      components={{
        // Base
        Button,
        Input,
        Textarea,
        Label,
        Badge,
        ScrollArea,
        Separator,
        // Date
        Calendar,
        // Popover
        PopoverRoot: Popover,
        PopoverTrigger,
        PopoverContent,
        PopoverAnchor,
        // Command
        CommandRoot: Command,
        CommandList,
        CommandItem,
        CommandGroup,
        CommandEmpty,
        CommandInput,
        CommandSeparator,
      }}
    >
      <RuntimeProvider runtime={runtime} showDevtools>
        <HeliumAllInputs />
      </RuntimeProvider>
    </ShadCnProvider>
  ),
};
