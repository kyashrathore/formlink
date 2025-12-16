import { getModel } from "@/app/lib/ai/provider";
import { FormValidator } from "@/lib/validation/FormValidator";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  stepCountIs,
  streamText,
  type ToolSet,
} from "ai";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { createAITools } from "./_lib/tools";
import { ChatAssistBodySchema } from "./schema";
import { ChatContextService } from "./services/ChatContextService";
import { FlowService } from "./services/FlowService";
import { SubmissionService } from "./services/SubmissionService";
import {
  Question,
  sanitizeUserInput,
  trackServerEvent,
  ValidationResult,
} from "./utils";

const STREAM_STEP_LIMIT = 10;
const CHAT_ASSIST_DEBUG_ENABLED = process.env.NODE_ENV !== "production";
const CHAT_ASSIST_TRACE_HEADER = "x-formlink-trace-id";

function createChatAssistTraceId(): string {
  const webCrypto = globalThis.crypto as
    | { randomUUID?: () => string }
    | undefined;
  if (webCrypto?.randomUUID) {
    return webCrypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function formatUserText(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export async function POST(req: Request) {
  const startTime = Date.now();

  try {
    const headersList = await headers();
    const traceId =
      headersList.get(CHAT_ASSIST_TRACE_HEADER) ?? createChatAssistTraceId();
    const requestData = await req.json();

    const messages = Array.isArray(requestData?.messages)
      ? requestData.messages
      : [];
    const body = requestData?.body || requestData || {};

    const parsed = ChatAssistBodySchema.safeParse(body);
    if (!parsed.success) {
      if (CHAT_ASSIST_DEBUG_ENABLED) {
        console.error("[chat-assist][server] invalid-body", {
          traceId,
          issues: parsed.error.flatten(),
        });
      }
      const res = NextResponse.json(
        { error: "Invalid request body", issues: parsed.error.flatten() },
        { status: 400 },
      );
      res.headers.set(CHAT_ASSIST_TRACE_HEADER, traceId);
      return res;
    }

    const {
      submissionBehavior,
      currentQuestionId,
      formSchema,
      responses = {},
      submissionId,
      userId,
      justSavedAnswer,
      isTestSubmission = false,
      initiate = false,
      suppressUserMessagePersistence = false,
      startMode = null,
      userInput,
    } = parsed.data;

    const submissionBehaviorNorm =
      FlowService.normalizeBehavior(submissionBehavior);
    const partialSubmission = Boolean(formSchema?.settings?.partialSubmission);
    const formattedUserText = formatUserText(userInput);
    const sanitizedUserText = sanitizeUserInput(formattedUserText);

    // 1. Ensure submission exists
    const activeSubmissionId = await SubmissionService.ensureSubmissionExists(
      submissionId,
      formSchema,
      userId,
      isTestSubmission,
      headersList.get("x-forwarded-for") ||
        headersList.get("x-real-ip") ||
        "unknown",
      headersList.get("user-agent") || "unknown",
    );

    // 2. Hydrate responses
    let effectiveResponses = await SubmissionService.hydrateEffectiveResponses(
      activeSubmissionId,
      responses,
    );

    // 3. Determine Context (Current Question, Validation)
    const fallbackQuestionId = FlowService.findFirstUnanswered(
      formSchema,
      effectiveResponses,
    );

    let effectiveCurrentQuestionId = FlowService.determineCurrentQuestionId(
      submissionBehaviorNorm,
      currentQuestionId,
      fallbackQuestionId,
    );

    const currentQuestion = formSchema?.questions?.find(
      (q: Question) => q.id === effectiveCurrentQuestionId,
    );

    const candidateAnswerValue =
      justSavedAnswer && justSavedAnswer.questionId === currentQuestionId
        ? justSavedAnswer.value
        : sanitizedUserText;

    // 4. Validate & Auto-Save
    let validationResult: ValidationResult | undefined;
    if (
      (submissionBehaviorNorm === "auto" ||
        submissionBehaviorNorm === "manualClear") &&
      currentQuestion
    ) {
      validationResult = FormValidator.validate(
        candidateAnswerValue,
        currentQuestion,
      );
      if (
        validationResult.isValid &&
        validationResult.normalizedValue !== undefined
      ) {
        const cross = FormValidator.validateCrossField(
          currentQuestion.id,
          validationResult.normalizedValue,
          effectiveResponses,
          formSchema,
        );
        if (!cross.isValid) {
          validationResult = cross;
        }
      }
    }

    const shouldPersistImmediately =
      partialSubmission &&
      (submissionBehaviorNorm === "auto" ||
        submissionBehaviorNorm === "manualClear") &&
      currentQuestion;

    if (shouldPersistImmediately && currentQuestion && currentQuestionId) {
      let valueToPersist: unknown =
        justSavedAnswer?.value ??
        validationResult?.normalizedValue ??
        candidateAnswerValue;

      // Re-validate to be safe if strictly persisting
      const validation = FormValidator.validate(
        valueToPersist,
        currentQuestion,
      );
      if (!validation.isValid) {
        validationResult = validation;
      } else if (validation.normalizedValue !== undefined) {
        valueToPersist = validation.normalizedValue;
      }

      if (!validationResult || validationResult.isValid) {
        const saved = await SubmissionService.preSaveAnswer(
          activeSubmissionId,
          currentQuestionId,
          valueToPersist,
        );
        if (saved) {
          effectiveResponses = {
            ...effectiveResponses,
            [currentQuestionId]: valueToPersist,
          };
        }
      }
    } else if (
      !partialSubmission &&
      currentQuestion &&
      (submissionBehaviorNorm === "auto" ||
        submissionBehaviorNorm === "manualClear") &&
      currentQuestionId
    ) {
      // Optimistic update for non-partial
      const valueToApply =
        justSavedAnswer?.value ??
        validationResult?.normalizedValue ??
        candidateAnswerValue;
      effectiveResponses = {
        ...effectiveResponses,
        [currentQuestionId]: valueToApply,
      };
    }

    // 5. Calculate Next Step
    const nextQuestionId = FlowService.findFirstUnanswered(
      formSchema,
      effectiveResponses,
    );
    if (
      effectiveCurrentQuestionId &&
      !formSchema?.questions?.some(
        (q: Question) => q.id === effectiveCurrentQuestionId,
      )
    ) {
      effectiveCurrentQuestionId = nextQuestionId;
    }

    // 6. Build Context Payload
    const contextPayload = ChatContextService.stabilizeObject({
      submissionBehavior: submissionBehaviorNorm,
      partialSubmission,
      currentQuestionId: effectiveCurrentQuestionId,
      firstUnansweredId: nextQuestionId,
      mustCompleteNow: nextQuestionId === null,
      answeredIds: Object.keys(effectiveResponses || {}),
      initiate,
      startMode,
      branchingEnabled: Boolean(formSchema?.settings?.branching?.enabled),
      journeyScript: String(formSchema?.settings?.journeyScript || ""),
      responses: effectiveResponses,
      questions: Array.isArray(formSchema?.questions)
        ? formSchema.questions.map((q: Question) => ({
            id: q.id,
            title: q.title ?? null,
            type: q.type?.name ?? null,
            required: Boolean(q.validations?.required),
            mightBranchOffNext: Boolean(q.mightBranchOffNext),
          }))
        : [],
      submissionId: activeSubmissionId,
      formId: formSchema?.id ?? null,
    });

    const modelMessages = ChatContextService.injectXmlContext(
      messages,
      contextPayload,
      sanitizedUserText,
    );

    const coreMessages = convertToModelMessages(modelMessages);
    const systemPrompt = await ChatContextService.loadSystemPrompt(formSchema);

    // 7. Prepare Tools & Model
    const tools = createAITools({
      submissionId: activeSubmissionId,
      userId: userId ?? undefined,
      formSchema,
      responses: effectiveResponses,
      partialSubmission,
    }) as ToolSet;

    const model = getModel();

    // 8. Stream Response
    const uiStream = await createUIMessageStream({
      async execute({ writer }) {
        const response = await streamText({
          model,
          system: systemPrompt,
          messages: coreMessages,
          tools,
          stopWhen: stepCountIs(STREAM_STEP_LIMIT),
          onFinish: async (result) => {
            const toolCalls = (result as any).toolCalls;
            const duration = Date.now() - startTime;
            trackServerEvent("api.form_assist.duration", {
              duration,
              formId: formSchema.id,
              toolCallCount: toolCalls?.length || 0,
            });
            toolCalls?.forEach((call: any) => {
              trackServerEvent("tool.usage", {
                toolName: call.toolName,
                formId: formSchema.id,
              });
            });

            if (CHAT_ASSIST_DEBUG_ENABLED) {
              console.log("[chat-assist][server] finish", {
                traceId,
                duration,
              });
            }
          },
        });

        writer.merge(response.toUIMessageStream());
      },
      originalMessages: messages,
      onError: (error) => {
        console.error("[chat-assist] Stream error:", {
          traceId,
          error: error instanceof Error ? error.message : error,
        });
        return `Error: ${error instanceof Error ? error.message : "Unknown error"}`;
      },
      onFinish: async ({ messages: finishedMessages }) => {
        const assistantMessages = finishedMessages.filter(
          (message: any) => message.role === "assistant",
        );
        const lastAssistant = assistantMessages[assistantMessages.length - 1];
        if (lastAssistant) {
          await SubmissionService.saveSubmissionMessage(
            activeSubmissionId,
            lastAssistant,
            userId ?? undefined,
          );
        }
      },
    });

    if (!suppressUserMessagePersistence) {
      const lastUserMessage = [...messages]
        .reverse()
        .find((msg: any) => msg.role === "user");
      if (lastUserMessage) {
        await SubmissionService.saveSubmissionMessage(
          activeSubmissionId,
          lastUserMessage,
          userId ?? undefined,
        );
      }
    }

    trackServerEvent("api.form_assist.request", {
      formId: formSchema.id,
      submissionBehavior: submissionBehaviorNorm || "none",
      partialSubmission,
    });

    const resp = createUIMessageStreamResponse({ stream: uiStream });
    try {
      resp.headers.set("Access-Control-Allow-Origin", "*");
      resp.headers.set("Access-Control-Allow-Methods", "POST,OPTIONS");
      resp.headers.set(
        "Access-Control-Allow-Headers",
        "content-type,authorization",
      );
      resp.headers.set(CHAT_ASSIST_TRACE_HEADER, traceId);
    } catch {}
    return resp;
  } catch (error) {
    const traceId =
      req.headers.get(CHAT_ASSIST_TRACE_HEADER) ?? createChatAssistTraceId();
    console.error(
      "[chat-assist] Critical error:",
      error instanceof Error ? error.message : error,
    );
    trackServerEvent("api.form_assist.critical_error");

    const json = NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
        fallback: true,
      },
      { status: 500 },
    );
    json.headers.set("Access-Control-Allow-Origin", "*");
    json.headers.set("Access-Control-Allow-Methods", "POST,OPTIONS");
    json.headers.set(
      "Access-Control-Allow-Headers",
      "content-type,authorization",
    );
    json.headers.set(CHAT_ASSIST_TRACE_HEADER, traceId);
    return json;
  }
}

export async function OPTIONS() {
  const res = new NextResponse(null, { status: 204 });
  res.headers.set("Access-Control-Allow-Origin", "*");
  res.headers.set("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "content-type,authorization");
  return res;
}
