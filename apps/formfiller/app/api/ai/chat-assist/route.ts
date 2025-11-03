import { getModel } from "@/app/lib/ai/provider";
import { FormValidator } from "@/lib/validation/FormValidator";
import { loadPrompt } from "@formlink/prompts";
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
import {
  ensureSubmissionExists,
  hydrateEffectiveResponses,
  preSaveAnswer,
  saveSubmissionMessage,
} from "./_lib/submission";
import { createAITools } from "./_lib/tools";
import { ChatAssistBodySchema } from "./schema";
import {
  Question,
  sanitizeUserInput,
  trackServerEvent,
  ValidationResult,
} from "./utils";

const STREAM_STEP_LIMIT = 10;

function formatUserText(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (value === null || value === undefined) {
    return "";
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function normalizeBehavior(
  value: unknown,
): "auto" | "manualClear" | "manualUnclear" | null {
  if (
    value === "auto" ||
    value === "manualClear" ||
    value === "manualUnclear"
  ) {
    return value;
  }
  return null;
}

function findFirstUnanswered(
  formSchema: any,
  responses: Record<string, unknown>,
): string | null {
  if (!Array.isArray(formSchema?.questions)) {
    return null;
  }
  return (
    formSchema.questions.find(
      (q: Question) =>
        !Object.prototype.hasOwnProperty.call(responses || {}, q.id),
    )?.id ?? null
  );
}

function stabilizeObject<T>(input: T): T {
  if (Array.isArray(input)) {
    return input.map((item) => stabilizeObject(item)) as T;
  }
  if (input && typeof input === "object") {
    const sortedEntries = Object.keys(input as Record<string, unknown>)
      .sort()
      .map((key) => {
        const value = (input as Record<string, unknown>)[key];
        return [key, stabilizeObject(value)];
      });
    return Object.fromEntries(sortedEntries) as T;
  }
  return input;
}

function injectXmlContext(
  messages: any[],
  xmlBlock: string,
  fallbackText: string,
): any[] {
  const cloned = messages.map((message) => ({
    ...message,
    parts: Array.isArray(message.parts)
      ? message.parts.map((part: any) => ({ ...part }))
      : message.parts,
  }));
  let lastUserIndex = -1;
  for (let i = cloned.length - 1; i >= 0; i -= 1) {
    if (cloned[i]?.role === "user") {
      lastUserIndex = i;
      break;
    }
  }

  const blockWithNewline = `${xmlBlock}\n`;

  if (lastUserIndex >= 0) {
    const target = cloned[lastUserIndex];
    const existingParts = Array.isArray(target.parts) ? [...target.parts] : [];
    const firstTextIndex = existingParts.findIndex(
      (part) => part?.type === "text",
    );
    if (firstTextIndex >= 0) {
      const originalText = existingParts[firstTextIndex]?.text ?? "";
      existingParts[firstTextIndex] = {
        ...existingParts[firstTextIndex],
        text: `${blockWithNewline}${originalText}`,
      };
    } else {
      existingParts.unshift({
        type: "text",
        text: `${blockWithNewline}${fallbackText}`,
      });
    }
    target.parts = existingParts;
  } else {
    cloned.push({
      id: `server-user-${Date.now()}`,
      role: "user",
      parts: [{ type: "text", text: `${blockWithNewline}${fallbackText}` }],
    });
  }

  return cloned;
}

function sanitizeUserMessageForPersistence(message: any): any {
  if (!message) return message;
  if (Array.isArray(message.parts)) {
    const sanitizedParts = message.parts.map((part: any) => {
      if (part?.type === "text" && typeof part.text === "string") {
        const text = part.text.replace(
          /<current_turn_context>[\s\S]*?<\/current_turn_context>\n?/,
          "",
        );
        return { ...part, text };
      }
      return part;
    });
    return { ...message, parts: sanitizedParts };
  }
  if (typeof message.content === "string") {
    const updated = message.content.replace(
      /<current_turn_context>[\s\S]*?<\/current_turn_context>\n?/,
      "",
    );
    return { ...message, content: updated };
  }
  return message;
}

export async function POST(req: Request) {
  const startTime = Date.now();

  try {
    const headersList = await headers();
    const ip =
      headersList.get("x-forwarded-for") ||
      headersList.get("x-real-ip") ||
      "unknown";
    const userAgent = headersList.get("user-agent") || "unknown";
    const requestData = await req.json();

    const messages = Array.isArray(requestData?.messages)
      ? requestData.messages
      : [];
    const body = requestData?.body || requestData || {};

    const parsed = ChatAssistBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", issues: parsed.error.flatten() },
        { status: 400 },
      );
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

    const submissionBehaviorNorm = normalizeBehavior(submissionBehavior);
    const partialSubmission = Boolean(formSchema?.settings?.partialSubmission);

    const formattedUserText = formatUserText(userInput);
    const sanitizedUserText = sanitizeUserInput(formattedUserText);

    const activeSubmissionId = await ensureSubmissionExists(
      submissionId,
      formSchema,
      userId,
      isTestSubmission,
      ip,
      userAgent,
    );

    let effectiveResponses = await hydrateEffectiveResponses(
      activeSubmissionId,
      responses,
    );

    const answeredIds = Object.keys(effectiveResponses || {});
    const fallbackQuestionId = findFirstUnanswered(
      formSchema,
      effectiveResponses,
    );

    const questionIdFromBehavior =
      submissionBehaviorNorm === "manualUnclear"
        ? currentQuestionId || fallbackQuestionId
        : currentQuestionId;

    let effectiveCurrentQuestionId =
      questionIdFromBehavior || fallbackQuestionId;

    const currentQuestion = formSchema?.questions?.find(
      (q: Question) => q.id === effectiveCurrentQuestionId,
    );

    const candidateAnswerValue =
      justSavedAnswer && justSavedAnswer.questionId === currentQuestionId
        ? justSavedAnswer.value
        : sanitizedUserText;

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
        const saved = await preSaveAnswer(
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
      const valueToApply =
        justSavedAnswer?.value ??
        validationResult?.normalizedValue ??
        candidateAnswerValue;
      effectiveResponses = {
        ...effectiveResponses,
        [currentQuestionId]: valueToApply,
      };
    }

    const nextQuestionId = findFirstUnanswered(formSchema, effectiveResponses);

    if (
      effectiveCurrentQuestionId &&
      !formSchema?.questions?.some(
        (q: Question) => q.id === effectiveCurrentQuestionId,
      )
    ) {
      effectiveCurrentQuestionId = nextQuestionId;
    }

    const questionSummaries = Array.isArray(formSchema?.questions)
      ? formSchema.questions.map((q: Question) => ({
          id: q.id,
          title: q.title ?? null,
          type: q.type?.name ?? null,
          required: Boolean(q.validations?.required),
          mightBranchOffNext: Boolean(q.mightBranchOffNext),
        }))
      : [];

    const contextPayload = stabilizeObject({
      submissionBehavior: submissionBehaviorNorm,
      partialSubmission,
      currentQuestionId: effectiveCurrentQuestionId,
      firstUnansweredId: nextQuestionId,
      mustCompleteNow: nextQuestionId === null,
      answeredIds,
      initiate,
      startMode,
      branchingEnabled: Boolean(formSchema?.settings?.branching?.enabled),
      journeyScript: String(formSchema?.settings?.journeyScript || ""),
      responses: effectiveResponses,
      questions: questionSummaries,
      submissionId: activeSubmissionId,
      formId: formSchema?.id ?? null,
    });

    const xmlBlock = `<current_turn_context>${JSON.stringify(
      contextPayload,
    )}</current_turn_context>`;

    const modelMessages = injectXmlContext(
      messages,
      xmlBlock,
      sanitizedUserText,
    );

    const tools = createAITools({
      submissionId: activeSubmissionId,
      userId: userId ?? undefined,
      formSchema,
      responses: effectiveResponses,
      partialSubmission,
    }) as ToolSet;

    const systemPrompt = await loadPrompt("filler/form-assistant-system.md", {
      journey_script: String(formSchema?.settings?.journeyScript || ""),
      include_guards: true,
    });

    const model = getModel();

    const uiStream = await createUIMessageStream({
      async execute({ writer }) {
        const response = await streamText({
          model,
          system: systemPrompt,
          messages: convertToModelMessages(modelMessages),
          tools,
          stopWhen: stepCountIs(STREAM_STEP_LIMIT),
          onFinish: async ({ toolCalls }) => {
            const duration = Date.now() - startTime;
            trackServerEvent("api.form_assist.duration", {
              duration,
              formId: formSchema.id,
              toolCallCount: toolCalls?.length || 0,
            });
            toolCalls?.forEach((call) => {
              trackServerEvent("tool.usage", {
                toolName: call.toolName,
                formId: formSchema.id,
              });
            });
          },
        });

        writer.merge(response.toUIMessageStream());
      },
      originalMessages: messages,
      onError: (error) => {
        console.error(
          "[chat-assist] Stream error:",
          error instanceof Error ? error.message : error,
        );
        return `Error: ${error instanceof Error ? error.message : "Unknown error"}`;
      },
      onFinish: async ({ messages: finishedMessages }) => {
        const assistantMessages = finishedMessages.filter(
          (message: any) => message.role === "assistant",
        );
        const lastAssistant = assistantMessages[assistantMessages.length - 1];
        if (lastAssistant) {
          await saveSubmissionMessage(
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
        const sanitizedMessage =
          sanitizeUserMessageForPersistence(lastUserMessage);
        await saveSubmissionMessage(
          activeSubmissionId,
          sanitizedMessage,
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
    } catch {}
    return resp;
  } catch (error) {
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
