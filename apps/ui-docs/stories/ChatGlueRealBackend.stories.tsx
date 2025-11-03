"use client";
import { useChat } from "@ai-sdk/react";
import {
  ChatMessageAssistant,
  ShadCnProvider,
  useChatStartCard,
  useFileUploadSubmission,
  useQuestionPlaceholder,
  useSlotBridge,
  useSubmitSelection,
  useToolDispatcher,
} from "@formlink/runtime/ui/react";
import { Avatar, AvatarFallback, AvatarImage } from "@formlink/ui";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
  PromptInput,
  PromptInputButton,
  PromptInputHeader,
  PromptInputHoverCard,
  PromptInputHoverCardContent,
  PromptInputHoverCardTrigger,
  PromptInputSubmit,
  PromptInputTextarea,
  Response,
} from "@formlink/ui/ai-elements";
// Map @formlink/ui primitives into runtime's ShadCnProvider
import {
  FormlinkLogo,
  PromptInputTypedAssist,
  TypedIntentDebugCard,
  useTypedInputGate,
} from "@formlink/runtime/ui/react";
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
import { cn } from "@formlink/ui/lib/utils";
import type { Meta, StoryObj } from "@storybook/nextjs";
import { ArrowRight } from "lucide-react";
import * as React from "react";

type Story = StoryObj;

const meta: Meta = {
  title: "Chat/Glue Real Backend",
} as Meta;
export default meta;

// Use relative URLs; Next.js rewrites in apps/ui-docs/next.config.mjs proxy to the backend (e.g., http://localhost:3001) to avoid CORS.
// Keeping this empty ensures requests hit Storybook origin (e.g., http://localhost:61183) and get proxied server-side.
const DEFAULT_BASE = "";
const FORM_ID = "e0ac0a42-a49b-4697-bb2f-8850db4a9270"; // provided

type UIMessage = { id?: string; role: string; parts?: Array<any> };

export const WithRealBackend: Story = {
  render: () => <RealBackendDemo baseUrl={DEFAULT_BASE} formId={FORM_ID} />,
};

function ThinkingDots({ text = "Thinking" }: { text?: string }) {
  const [dots, setDots] = React.useState(0);
  React.useEffect(() => {
    const id = setInterval(() => setDots((d) => (d + 1) % 4), 500);
    return () => clearInterval(id);
  }, []);
  return (
    <span role="status" aria-live="polite" className="tracking-wide">
      {text}
      {"".padEnd(dots, ".")}
    </span>
  );
}

function RealBackendDemo({
  baseUrl,
  formId,
}: {
  baseUrl: string;
  formId: string;
}) {
  // Static schema provided by user (avoids fetch 404 issues in Storybook)
  const STATIC_FORM_SCHEMA: any = {
    id: "e0ac0a42-a49b-4697-bb2f-8850db4a9270",
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
      journeyScript: `<form-journey>
<strategy>
## Purpose
Capture essential lead information to enable the agency to propose tailored marketing solutions.

## Audience & Tone
Potential business owners or marketing decision‑makers; professional yet approachable tone.

## Psychological Frame
- Reciprocity: Offer valuable insights based on the provided budget.
- Authority: Position the agency as experts.
- Commitment: Small initial steps encourage further engagement.
</strategy>

<value-exchange-strategy>
Provide a quick, personalized marketing budget benchmark based on the selected budget range before asking for contact details.
</value-exchange-strategy>

<branching-logic>
## Conditional Paths
No conditional logic
</branching-logic>

<result-generation>
## Purpose
Thank the prospect, summarize their inputs, and outline next steps.

## Response Analysis
- Use budget selection to suggest appropriate service tiers.
- Highlight the chosen marketing goal.

## Content Structure
- **Summary**: Thank you and recap of provided information.
- **Key Insights**: Suggested service tier, primary goal focus.
- **Score**: Not applicable.
- **Next Steps**: Schedule a consultation, review the proposal, and contact us.

## Tone and Style
Professional | Friendly Expert | Action‑Oriented
</result-generation>
</form-journey>`,
    },
    current_published_version_id: null,
    current_draft_version_id: "f7c3be3e-1cd5-4389-bfe8-eb10a32dcb04",
    short_id: "lvLg9x2viE",
    branch_name: null,
    preview_url: null,
    live_url: null,
    last_deployed_at: null,
    published_at: null,
    sandbox_id: null,
  };
  const [formSchema, setFormSchema] = React.useState<any | null>(
    STATIC_FORM_SCHEMA,
  );

  const [currentQuestionId, setCurrentQuestionId] = React.useState<
    string | null
  >(null);
  const [input, setInput] = React.useState("");
  const [answers, setAnswers] = React.useState<Record<string, any>>({});
  // Local drafts for free-text/phone inputs (do not update global answers until backend confirms)
  const [drafts, setDrafts] = React.useState<Record<string, any>>({});
  // useChat from AI SDK, pointing to your backend
  const { messages, sendMessage, status } = useChat({
    api: `${baseUrl}/api/ai/chat-assist`,
    onFinish: ({ message }: any) => toolDispatcher.apply(message as any),
  });

  // No fetch needed; using provided static schema to avoid 404s in Storybook

  // Parse slot tokens from assistant and set current question id
  useSlotBridge({ messages, onSlot: setCurrentQuestionId });

  const toolDispatcher = useToolDispatcher({
    onApplyResult: (tool, result) => {
      if (tool === "saveAnswer" && result?.nextQuestionId) {
        setCurrentQuestionId(result.nextQuestionId);
        if (result?.questionId !== undefined) {
          setAnswers((prev) => ({
            ...prev,
            [result.questionId]: result.value,
          }));
        }
      }
      // completeSubmission can be handled by the host app (show thank-you / redirect)
    },
  });

  // Global Storybook-level fetch shim is applied in apps/ui-docs/.storybook/preview.ts
  // No per-story fetch shim needed here.

  const { submitSelection } = useSubmitSelection({
    sendMessage,
    currentQuestionId,
    getFormSchema: () => formSchema,
    getResponses: () => ({ ...answers, ...drafts }),
  });

  const { handleFileUpload } = useFileUploadSubmission({
    uploadApi: `${baseUrl}/api/upload`,
    submitSelection,
  });

  const handleSubmit = (
    message: { text?: string; files?: Array<any> },
    e: React.FormEvent<HTMLFormElement>,
  ) => {
    e.preventDefault();
    const text = (message?.text ?? input).trim();
    if (!text || !formSchema) return;
    if (gate.block) {
      gate.setShowValidation(true);
      return;
    }
    sendMessage(
      { text },
      {
        body: {
          userInput: text,
          submissionBehavior: "manualUnclear",
          currentQuestionId,
          formSchema,
          responses: { ...answers, ...drafts },
        },
      },
    );
    setInput("");
  };

  const lastAssistantIndex = React.useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if ((messages[i] as any)?.role === "assistant") return i;
    }
    return -1;
  }, [messages]);

  const currentQuestion = React.useMemo(() => {
    if (!formSchema || !currentQuestionId) return null;
    return (
      (formSchema.questions || []).find(
        (q: any) => q.id === currentQuestionId,
      ) ?? null
    );
  }, [formSchema, currentQuestionId]);

  const { format: currentTextFormat, placeholder: promptPlaceholder } =
    useQuestionPlaceholder({ question: currentQuestion });

  const HIGH_CONFIDENCE = 0.85;
  const DEBUG_INTENT = false; // flip to true to show intent debug card
  const EXPECTED = new Set(["tel", "email", "url", "number"]);

  const expected =
    currentTextFormat && EXPECTED.has(currentTextFormat)
      ? (currentTextFormat as any)
      : null;

  const gate = useTypedInputGate({
    expectedFormat: expected as any,
    value: input,
    confidence: HIGH_CONFIDENCE,
  });

  const detection = gate.detection;
  const isIntentMatch = Boolean(expected && detection.intent === expected);
  const isHighConfidenceInvalid = gate.block;

  // Start-card control and start trigger
  const { started, canStart, start } = useChatStartCard({
    sendMessage,
    messages,
    status: status as any,
    getFormSchema: () => formSchema,
    getResponses: () => ({ ...answers, ...drafts }),
    getCurrentQuestionId: () => currentQuestionId,
  });

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
        // PromptInput HoverCard primitives for runtime assist
        PromptInputHoverCard,
        PromptInputHoverCardTrigger,
        PromptInputHoverCardContent,
        PromptInputButton,
      }}
    >
      <div className="max-w-3xl mx-auto p-1 lg:p-6 min-h-[100svh] flex flex-col pb-1 lg:pb-4">
        {!formSchema ? (
          <div className="text-sm">
            Fetching form schema… Ensure the form app is running.
          </div>
        ) : (
          <>
            {/* pass contextRef that get passed to sticktobottom div which sits bweetn conversation and conversationcontent, need to set its fix height to make scroll work */}
            <Conversation
              className={cn(
                "border rounded-md rounded-b-none",
                started
                  ? "[&>*:first-child]:min-h-[calc(100svh-64px)] lg:[&>*:first-child]:min-h-[calc(100svh-148px)]"
                  : "[&>*:first-child]:min-h-[calc(100svh-8px)] lg:[&>*:first-child]:min-h-[calc(100svh-42px)]",
              )}
            >
              <ConversationContent
                className={[
                  "flex flex-col justify-end",
                  started
                    ? "h-[calc(100svh-64px)] lg:h-[calc(100svh-148px)]"
                    : "h-[calc(100svh-8px)] lg:h-[calc(100svh-42px)]",
                ].join(" ")}
              >
                {messages.length === 0 && (
                  <div className="w-full mt-auto">
                    <div className="rounded-xl border bg-background/70 p-6 shadow-sm">
                      <div className="mb-2 flex items-center gap-2">
                        <Badge variant="secondary">Form</Badge>
                        <span className="text-muted-foreground text-xs">
                          {(formSchema.questions || []).length} questions
                        </span>
                      </div>
                      <h1 className="text-2xl font-semibold">
                        {formSchema.title}
                      </h1>
                      {formSchema.description && (
                        <p className="mt-2 text-muted-foreground">
                          {formSchema.description}
                        </p>
                      )}
                      <div className="mt-6">
                        <Button onClick={start} disabled={!canStart}>
                          Start
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
                {messages.map((m: any, idx: number) => {
                  const key = String(m.id ?? `${idx}-${m.role}`);
                  const isAssistant = m?.role === "assistant";
                  const isLastAssistant = idx === lastAssistantIndex;
                  const label = isAssistant ? "Formlink AI" : "You";

                  const Header = (
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Avatar className="size-6">
                        <AvatarImage alt="" src="" />
                        <AvatarFallback
                          className={
                            isAssistant
                              ? "bg-foreground text-background"
                              : "bg-primary text-primary-foreground"
                          }
                        >
                          {isAssistant ? (
                            <FormlinkLogo className="h-3 w-3" />
                          ) : null}
                        </AvatarFallback>
                      </Avatar>
                      <span>{label}</span>
                    </div>
                  );

                  if (isAssistant) {
                    const parts = Array.isArray(m.parts) ? m.parts : [];
                    const hasText = parts.some(
                      (p: any) =>
                        p?.type === "text" &&
                        String(p.text || "").trim().length > 0,
                    );

                    if (isLastAssistant && status === "streaming" && !hasText) {
                      return (
                        <div key={key} className="w-full p-3">
                          {Header}
                          <div className="mt-1 pl-9 text-sm opacity-80">
                            <ThinkingDots />
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={key} className="w-full p-3">
                        {Header}
                        <div className="mt-1 pl-9">
                          <ChatMessageAssistant
                            message={m}
                            isLast={isLastAssistant}
                            currentQuestionId={currentQuestionId ?? undefined}
                            form={formSchema}
                            values={{ ...answers, ...drafts }}
                            onChange={(qid, v) =>
                              setDrafts((d) => ({ ...d, [qid]: v }))
                            }
                            onSubmitSelection={(qid, value, display) =>
                              submitSelection(qid, value, display)
                            }
                            onFileUpload={(qid, f) => handleFileUpload(qid, f)}
                            renderSlots={(q) =>
                              (q as any).type?.name !== "text"
                            }
                          />
                        </div>
                      </div>
                    );
                  }

                  const userParts = Array.isArray(m.parts) ? m.parts : [];
                  const userText = userParts
                    .filter((p: any) => p?.type === "text")
                    .map((p: any) => p?.text ?? "")
                    .join("\n\n");
                  if (!userText) return null;

                  return (
                    <div key={key} className="w-full p-3">
                      {Header}
                      <div className="mt-1 pl-9">
                        <Response>{userText}</Response>
                      </div>
                    </div>
                  );
                })}
                {/* No separate loader row; handled inline in last assistant when empty */}
              </ConversationContent>
              <ConversationScrollButton />
            </Conversation>

            <TypedIntentDebugCard
              show={DEBUG_INTENT}
              currentQuestionId={currentQuestionId}
              expectedFormat={currentTextFormat}
              detection={detection}
              isIntentMatch={Boolean(isIntentMatch)}
              isHighConfidenceInvalid={isHighConfidenceInvalid}
              showValidation={gate.showValidation}
              threshold={HIGH_CONFIDENCE}
            />

            {messages.length > 0 && (
              <PromptInput onSubmit={handleSubmit} className="relative">
                <PromptInputHeader>
                  <div className="flex items-center gap-2">
                    <PromptInputTypedAssist
                      expectedFormat={currentTextFormat as any}
                      value={input}
                      onValueChange={setInput}
                      alwaysShowTelSelector
                      gate={gate}
                    />
                    <div>Ask for clarification or add extra details</div>
                  </div>
                </PromptInputHeader>
                <PromptInputTextarea
                  key="footer-textarea"
                  value={input}
                  onChange={(e) => setInput((e as any).target.value)}
                  placeholder={promptPlaceholder}
                  className="p-[2px] md:p-3 pr-10 md:pr-14 text-sm md:text-base"
                />
                <PromptInputSubmit
                  className="absolute bottom-1 right-1 md:bottom-2 md:right-2 rounded-full"
                  status={status}
                  disabled={
                    !input ||
                    !formSchema ||
                    status === "streaming" ||
                    (gate.showValidation && gate.block)
                  }
                >
                  <ArrowRight className="size-4" />
                </PromptInputSubmit>
              </PromptInput>
            )}
          </>
        )}
      </div>
    </ShadCnProvider>
  );
}
