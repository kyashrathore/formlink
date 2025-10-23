"use client";

import {
  createRuntime,
  type RuntimeContextSnapshot,
  type RuntimeTransport,
} from "@formlink/runtime";
import { Devtools } from "@formlink/runtime/devtools";
import type { Form, Question } from "@formlink/schema";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Progress,
  Textarea,
  TypeFormTextInput,
  UnifiedDropdownSelect,
} from "@formlink/ui";
import type { Meta, StoryObj } from "@storybook/react";
import React, { useCallback, useSyncExternalStore } from "react";

type Story = StoryObj;

type RuntimeQuestion = Question;

const STRIPE_JOB_APPLICATION_FORM: Form = {
  current_published_version_id: "stripe_sde2_v1",
  current_draft_version_id: "stripe_sde2_v1",
  version_id: "stripe_sde2_v1",
  id: "stripe_sde2_application",
  title: "Stripe — Software Engineer (SDE2) Application",
  description:
    "Tell us about your experience building reliable, user-centric products at scale. This flow mirrors how we evaluate core Stripe engineers.",
  questions: [
    {
      id: "q1_full_name",
      questionNo: 1,
      title: "What is your full name?",
      description: "Provide the name you use on LinkedIn or public profiles.",
      styling: { colSpan: 12 },
      type: { name: "text", format: "text" },
      validations: {
        required: {
          value: true,
          message:
            "We need your name to pair the application with your profile.",
        },
      },
      submissionBehavior: "manualAnswer",
    },
    {
      id: "q2_email",
      questionNo: 2,
      title: "What is your preferred email address?",
      description: "We will use this for follow-ups within 3 business days.",
      styling: { colSpan: 12 },
      type: { name: "text", format: "email" },
      validations: {
        required: {
          value: true,
          message: "An email address is required.",
        },
      },
      submissionBehavior: "manualAnswer",
    },
    {
      id: "q3_linkedin",
      questionNo: 3,
      title: "Share your LinkedIn profile URL.",
      styling: { colSpan: 12 },
      type: { name: "text", format: "url" },
      validations: {},
      submissionBehavior: "manualAnswer",
    },
    {
      id: "q4_portfolio",
      questionNo: 4,
      title: "Do you have a portfolio or GitHub link?",
      description: "Drop the URL that best captures your recent work.",
      styling: { colSpan: 12 },
      type: { name: "text", format: "url" },
      validations: {},
      submissionBehavior: "manualAnswer",
    },
    {
      id: "q5_experience_years",
      questionNo: 5,
      title:
        "How many years of professional software engineering experience do you have?",
      styling: { colSpan: 12 },
      type: { name: "text", format: "number" },
      validations: {
        required: {
          value: true,
          message:
            "Let us know how long you have been shipping production code.",
        },
      },
      submissionBehavior: "manualAnswer",
    },
    {
      id: "q6_primary_focus",
      questionNo: 6,
      title: "What is your primary area of focus?",
      styling: { colSpan: 12 },
      type: {
        name: "singleChoice",
        display: "checkbox",
        options: [
          {
            value: "payments-platform",
            label: "Payments platform & APIs",
            score: 5,
          },
          {
            value: "frontend-experience",
            label: "Product UX / Frontend",
            score: 5,
          },
          {
            value: "infrastructure",
            label: "Infrastructure & reliability",
            score: 5,
          },
          {
            value: "ml-risk",
            label: "Machine learning & risk systems",
            score: 5,
          },
        ],
      },
      validations: {
        required: {
          value: true,
          message: "Select the track that best matches your experience.",
        },
      },
      submissionBehavior: "manualAnswer",
    },
    {
      id: "q7_payments_experience",
      questionNo: 7,
      title: "How would you summarise your payments or fintech experience?",
      styling: { colSpan: 12 },
      type: {
        name: "singleChoice",
        display: "dropdown",
        options: [
          {
            value: "deep-expert",
            label: "5+ years building payment rails",
            score: 5,
          },
          {
            value: "integrations",
            label:
              "Delivered production integrations with providers like Stripe or Adyen",
            score: 4,
          },
          {
            value: "related-domains",
            label: "Experience in related regulated domains (banking, lending)",
            score: 3,
          },
          {
            value: "learning",
            label: "New to payments but eager to learn quickly",
            score: 2,
          },
        ],
      },
      validations: {
        required: {
          value: true,
          message: "Select the option that best fits your background.",
        },
      },
      submissionBehavior: "manualAnswer",
    },
    {
      id: "q8_location",
      questionNo: 8,
      title: "Where are you currently based?",
      description:
        "Stripe has hubs in San Francisco, NYC, Dublin, Bangalore, and Singapore.",
      styling: { colSpan: 12 },
      type: {
        name: "singleChoice",
        display: "dropdown",
        options: [
          { value: "san-francisco", label: "San Francisco Bay Area", score: 4 },
          { value: "new-york", label: "New York", score: 4 },
          { value: "dublin", label: "Dublin", score: 4 },
          { value: "bengaluru", label: "Bengaluru", score: 4 },
          { value: "singapore", label: "Singapore", score: 4 },
          { value: "remote", label: "Remote — willing to relocate", score: 3 },
        ],
      },
      validations: {
        required: {
          value: true,
          message: "Let us know your current location or relocation plans.",
        },
      },
      submissionBehavior: "manualAnswer",
    },
    {
      id: "q9_notice_period",
      questionNo: 9,
      title: "What is your notice period or ideal start date?",
      styling: { colSpan: 12 },
      type: {
        name: "singleChoice",
        display: "dropdown",
        options: [
          { value: "immediate", label: "Immediate / < 2 weeks", score: 4 },
          { value: "one-month", label: "1 month", score: 3 },
          { value: "two-months", label: "2 months", score: 2 },
          { value: "three-plus", label: "3+ months", score: 1 },
        ],
      },
      validations: {},
      submissionBehavior: "manualAnswer",
    },
    {
      id: "q10_pitch",
      questionNo: 10,
      title: "Give us a one-paragraph pitch of a project you are proud of.",
      description:
        "Focus on the customer problem, the systems you touched, and measurable impact.",
      styling: { colSpan: 12 },
      type: { name: "text", format: "textarea" },
      validations: {},
      submissionBehavior: "manualAnswer",
    },
  ],
};

const MOCK_TRANSPORT: RuntimeTransport = {
  async submit(values: Record<string, unknown>) {
    await new Promise((resolve) => {
      setTimeout(resolve, 600);
    });
    return {
      response: {
        ok: true,
        storedAt: new Date().toISOString(),
        values,
      },
    };
  },
  async savePartial() {
    return;
  },
  async upload(questionId: string, file: File | Blob) {
    const objectUrl =
      file instanceof File ? URL.createObjectURL(file) : undefined;
    if (objectUrl) {
      queueMicrotask(() => {
        URL.revokeObjectURL(objectUrl);
      });
    }
    return {
      url: objectUrl ?? "",
      name: file instanceof File ? file.name : `upload-${questionId}`,
      size: "size" in file ? file.size : 0,
      mimeType: file instanceof File ? file.type : undefined,
    };
  },
};

const runtime = createRuntime({
  form: STRIPE_JOB_APPLICATION_FORM,
  transport: MOCK_TRANSPORT,
});

// Wire runtime events into the local devlog so "submitted" is visible here too.
let __DEVLOG_WIRED = (globalThis as any).__FORMDOCS_DEVLOG_WIRED__ as
  | boolean
  | undefined;
if (!__DEVLOG_WIRED) {
  (globalThis as any).__FORMDOCS_DEVLOG_WIRED__ = true;
  runtime.events.on("status:change", (payload) =>
    devlog.add({ ts: Date.now(), type: "status:change", payload }),
  );
  runtime.events.on("submit:requested", (payload) =>
    devlog.add({ ts: Date.now(), type: "submit:requested", payload }),
  );
  runtime.events.on("submit:transport:start", (payload) =>
    devlog.add({ ts: Date.now(), type: "submit:transport:start", payload }),
  );
  runtime.events.on("submit:transport:end", (payload) =>
    devlog.add({ ts: Date.now(), type: "submit:transport:end", payload }),
  );
  runtime.events.on("submit:success", (payload) =>
    devlog.add({ ts: Date.now(), type: "submit:success", payload }),
  );
  runtime.events.on("submit:error", (payload) =>
    devlog.add({ ts: Date.now(), type: "submit:error", payload }),
  );
}

// --- Devlog (story-local) ---
type DevEvent = {
  ts: number;
  type:
    | "status:change"
    | "answer:set"
    | "visibility:change"
    | "progress:change"
    | "validate:pass"
    | "validate:fail"
    | "partial:saved"
    | "partial:error"
    | "submit:requested"
    | "submit:transport:start"
    | "submit:transport:end"
    | "submit:success"
    | "submit:error"
    | "upload:success"
    | "upload:error"
    | "nav:prev"
    | "nav:goto"
    | "reset"
    | "start";
  payload?: unknown;
};

const devlog = (() => {
  let entries: DevEvent[] = [];
  const subs = new Set<() => void>();
  return {
    add(e: DevEvent) {
      entries = [...entries, e];
      subs.forEach((fn) => fn());
    },
    clear() {
      entries = [];
      subs.forEach((fn) => fn());
    },
    get() {
      return entries;
    },
    subscribe(fn: () => void) {
      subs.add(fn);
      return () => subs.delete(fn);
    },
  };
})();

const meta: Meta = {
  title: "Form/Stripe SDE2 Application",
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

function getQuestionNumber(questionId: string | null, eligibleIds: string[]) {
  if (!questionId) return null;
  const index = eligibleIds.findIndex((id) => id === questionId);
  return index === -1 ? null : index + 1;
}

function StripeSDE2Application() {
  const snapshot = useRuntimeSnapshot();
  const {
    status,
    currentId,
    progress,
    firstUnansweredId,
    isSubmitting,
    eligibleIds,
    errors,
  } = snapshot;

  const activeQuestionId =
    currentId ?? firstUnansweredId ?? eligibleIds[0] ?? null;
  const activeQuestion = activeQuestionId
    ? runtime.context.get.q(activeQuestionId)
    : undefined;
  const activeError = activeQuestionId
    ? errors[activeQuestionId]?.[0]
    : undefined;
  const value = activeQuestionId
    ? (runtime.context.get.value<string | null>(activeQuestionId) ?? null)
    : null;

  const questionNumber = getQuestionNumber(activeQuestionId, eligibleIds);
  const totalQuestions = eligibleIds.length;

  const [revealedErrors, setRevealedErrors] = React.useState<Set<string>>(
    new Set(),
  );

  const handleStart = useCallback(() => {
    runtime.actions.start();
  }, []);

  const handleRestart = useCallback(() => {
    runtime.actions.reset();
    runtime.actions.start();
    devlog.add({ ts: Date.now(), type: "reset" });
  }, []);

  const handleBack = useCallback(() => {
    runtime.actions.prev();
    devlog.add({ ts: Date.now(), type: "nav:prev" });
  }, []);

  const handleContinue = useCallback(async () => {
    if (activeQuestionId) {
      const res = await runtime.actions.validate(activeQuestionId);
      if (res.isValid) {
        devlog.add({
          ts: Date.now(),
          type: "validate:pass",
          payload: { qid: activeQuestionId },
        });
        await runtime.actions.next();
      } else {
        devlog.add({
          ts: Date.now(),
          type: "validate:fail",
          payload: { qid: activeQuestionId, errors: res.errors },
        });
        setRevealedErrors((prev) => {
          const next = new Set(prev);
          next.add(activeQuestionId);
          return next;
        });
        return;
      }
    } else {
      await runtime.actions.next();
    }
  }, [activeQuestionId]);

  const handleSubmit = useCallback(() => {
    devlog.add({ ts: Date.now(), type: "submit:requested" });
    runtime.actions.submit();
  }, []);

  const handleTextChange = useCallback(
    (next: string) => {
      if (!activeQuestionId) return;
      runtime.actions.set(activeQuestionId, next);
    },
    [activeQuestionId],
  );

  const handleDropdownChange = useCallback(
    (next: string | null) => {
      if (!activeQuestionId) return;
      runtime.actions.set(activeQuestionId, next);
    },
    [activeQuestionId],
  );
  // Validate live ONLY after a field has shown an error once.
  const [isCurrentInvalid, setIsCurrentInvalid] = React.useState(false);
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
        if (res.isValid) {
          setRevealedErrors((prev) => {
            if (!prev.has(activeQuestionId)) return prev;
            const next = new Set(prev);
            next.delete(activeQuestionId);
            return next;
          });
        }
      })
      .catch(() => void 0);
    return () => {
      cancelled = true;
    };
  }, [activeQuestionId, value, revealedErrors]);

  const renderQuestion = () => {
    if (!activeQuestion || !activeQuestionId) {
      return (
        <p className="text-muted-foreground">
          All questions have been answered. Review and submit your application.
        </p>
      );
    }

    const question = activeQuestion as RuntimeQuestion;
    const questionData = question as Record<string, unknown>;

    if (
      questionData?.type &&
      (questionData.type as { name?: string }).name === "text"
    ) {
      const textType =
        (questionData.type as { format?: string }).format ?? "text";
      if (textType === "textarea") {
        const handleTextareaChange = (
          event: React.ChangeEvent<HTMLTextAreaElement>,
        ) => {
          handleTextChange(event.target.value);
        };

        return (
          <Textarea
            key={activeQuestionId}
            value={value ?? ""}
            onChange={handleTextareaChange}
            placeholder="Describe the project, your role, and impact..."
            className="h-40 w-full max-w-2xl text-base"
          />
        );
      }

      const visibleErr = runtime.context.get.visibleError(activeQuestionId);
      const shouldShowError = Boolean(visibleErr);
      return (
        <TypeFormTextInput
          key={activeQuestionId}
          value={value}
          onChange={handleTextChange}
          onSubmit={value ? handleContinue : undefined}
          placeholder={
            textType === "email"
              ? "name@company.com"
              : textType === "url"
                ? "https://example.com/your-page"
                : textType === "number"
                  ? "e.g., 4"
                  : "Type your answer…"
          }
          type={
            textType === "number"
              ? "number"
              : textType === "email"
                ? "email"
                : textType === "url"
                  ? "url"
                  : "text"
          }
          // Show error only after a failed Continue attempt; disappears live once valid
          isInvalid={shouldShowError}
        />
      );
    }

    if (
      questionData?.type &&
      (questionData.type as { name?: string }).name === "singleChoice"
    ) {
      const rawOptions =
        (
          questionData.type as {
            options?: Array<{ value: string; label: string }>;
          }
        )?.options ?? [];
      return (
        <UnifiedDropdownSelect
          key={activeQuestionId}
          mode="typeform"
          options={rawOptions.map((option) => ({
            value: option.value,
            label: option.label,
          }))}
          value={value == null ? null : (String(value) as string)}
          onChange={handleDropdownChange}
          onSubmit={handleContinue}
        />
      );
    }

    return (
      <p className="text-muted-foreground">
        This question type is not yet implemented in the Storybook demo.
      </p>
    );
  };

  const canSubmit = snapshot.unansweredIds.length === 0;
  const hasNext = snapshot.progress.index < snapshot.progress.total - 1;

  if (status === "idle") {
    return (
      <Card className="mx-auto mt-12 w-full max-w-3xl">
        <CardHeader>
          <CardTitle>{runtime.context.form.title}</CardTitle>
          {runtime.context.form.description && (
            <CardDescription>
              {runtime.context.form.description}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-4 text-muted-foreground">
          <p>
            Expect a product-sense heavy interview loop with deep dives on data
            integrity, reliability, and cross-functional collaboration.
            We&apos;ll ask for real metrics where possible.
          </p>
          <p>
            This take-home mirrors the live form we ship in production. Submit
            honest, concise answers—there are no trick questions.
          </p>
        </CardContent>
        <CardFooter>
          <Button size="lg" onClick={handleStart}>
            Start Application
          </Button>
        </CardFooter>
      </Card>
    );
  }

  if (status === "completed") {
    return (
      <Card className="mx-auto mt-12 w-full max-w-2xl text-center space-y-6 p-10">
        <div className="space-y-3">
          <CardTitle>Thanks for applying to Stripe!</CardTitle>
          <CardDescription>
            We&apos;ve received your responses. The team reviews every
            application and will follow up within three business days if
            there&apos;s a fit.
          </CardDescription>
        </div>
        <CardFooter className="flex flex-col gap-4 items-center justify-center">
          <Button variant="outline" onClick={handleRestart}>
            Restart form
          </Button>
        </CardFooter>
      </Card>
    );
  }

  if (status === "error") {
    return (
      <Card className="mx-auto mt-12 w-full max-w-2xl space-y-4 p-8">
        <CardTitle>Something went wrong while submitting.</CardTitle>
        <CardDescription>
          Refresh the page or try again in a few minutes. Reach out to
          hiring@stripe.com if the issue persists.
        </CardDescription>
        <CardFooter>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            Retry submission
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className="mx-auto mt-12 w-full max-w-3xl">
      <CardHeader className="space-y-4">
        <div className="flex items-center justify-between">
          <Badge variant="secondary" className="text-sm">
            Stripe Careers · Software Engineer (SDE2)
          </Badge>
          <span className="text-sm text-muted-foreground">
            {progress.index + 1} / {progress.total}
          </span>
        </div>
        <div>
          <CardTitle className="text-2xl">
            {activeQuestion?.title ?? "Application"}
          </CardTitle>
          {activeQuestion?.description && (
            <CardDescription className="mt-2 max-w-2xl">
              {activeQuestion.description}
            </CardDescription>
          )}
        </div>
        <Progress value={progress.percent} className="h-2" />
      </CardHeader>
      <CardContent className="space-y-6">
        {renderQuestion()}
        {activeQuestionId &&
          runtime.context.get.visibleError(activeQuestionId) && (
            <p className="text-sm text-destructive">
              {runtime.context.get.visibleError(activeQuestionId)}
            </p>
          )}
      </CardContent>
      <CardFooter className="flex flex-col items-stretch gap-4">
        <div className="flex w-full items-center justify-between">
          <Button
            variant="ghost"
            disabled={!questionNumber || questionNumber <= 1 || isSubmitting}
            onClick={handleBack}
          >
            Back
          </Button>
          <div className="flex items-center gap-3">
            {/* Show Continue when there is a next step, even if all answers are filled */}
            {hasNext && (
              <Button
                variant="secondary"
                onClick={handleContinue}
                disabled={isSubmitting || !activeQuestionId}
              >
                {isSubmitting ? "Saving…" : "Continue"}
              </Button>
            )}
            {/* Show Submit whenever the form is fully answered */}
            {canSubmit && (
              <Button
                variant="default"
                onClick={handleSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Submitting…" : "Submit application"}
              </Button>
            )}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          We value signal over volume—focus on the details that demonstrate
          product ownership, relentless execution, and customer empathy.
        </p>
      </CardFooter>
    </Card>
  );
}

export const Demo: Story = {
  render: () => (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-[360px_minmax(0,1fr)] pb-12">
      <div>
        <Devtools runtime={runtime} label="Devtools" />
      </div>
      <div>
        <StripeSDE2Application />
      </div>
    </div>
  ),
};

function useDevlog() {
  return useSyncExternalStore(devlog.subscribe, devlog.get, devlog.get);
}

function truncate(val: unknown, len = 64): string {
  const s = typeof val === "string" ? val : JSON.stringify(val);
  if (!s) return "";
  return s.length > len ? s.slice(0, len) + "…" : s;
}
