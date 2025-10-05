import { headers } from "next/headers";
import { NextResponse, after } from "next/server";
// Types used inline within this file
import { FormValidator } from "@/lib/validation/FormValidator";
import { createUIMessageStreamResponse } from "ai";
import { streamAIResponse } from "./_lib/ai";
import { loadPrompt } from "@formlink/prompts";
import {
  ensureSubmissionExists,
  hydrateEffectiveResponses,
  preSaveAnswer,
  saveSubmissionMessage,
} from "./_lib/submission";
import { createAITools } from "./_lib/tools";
import { ChatAssistBodySchema } from "./schema";
import {
  AIContext,
  Question,
  sanitizeUserInput,
  trackServerEvent,
  ValidationResult,
} from "./utils";
import { runSubmissionJob } from "@/app/lib/intel/submission-job";
import logger from "@/app/lib/logger";

// Input processing utilities
function processUserInput(requestData: any): {
  messages: any[];
  body: any;
  userInput: string;
} {
  const messages = Array.isArray(requestData.messages)
    ? requestData.messages
    : [];
  const body = requestData.body || requestData;

  const lastUserMessage = [...messages]
    .reverse()
    .find((msg: any) => msg.role === "user");
  const userInput = lastUserMessage?.content || body.userInput || "";

  return { messages, body, userInput };
}

// Context building utilities - currently unused but may be needed for debugging
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function buildAIContext(
  sanitizedInput: string,
  submissionBehavior: "auto" | "manualClear" | "manualUnclear" | null,
  formSchema: any,
  currentQuestionId: string | null,
  responses: Record<string, any>,
  validationResult: ValidationResult | undefined,
  justSavedAnswer: any,
): AIContext {
  return {
    userInput: sanitizedInput,
    submissionBehavior,
    formSchema,
    currentQuestionId,
    responses,
    validationResult,
    justSavedAnswer,
    progress: {
      answered: Object.keys(responses).length,
      total: formSchema.questions.length,
      percentage: Math.round(
        (Object.keys(responses).length / formSchema.questions.length) * 100,
      ),
    },
    journeyScript: formSchema.settings?.journeyScript,
  };
}

// Error response utilities
function createErrorResponse(error: string, status = 500) {
  return new Response(JSON.stringify({ error, fallback: true }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(req: Request) {
  const startTime = Date.now();

  try {
    // Extract request data and headers
    const headersList = await headers();
    const ip =
      headersList.get("x-forwarded-for") ||
      headersList.get("x-real-ip") ||
      "unknown";
    const userAgent = headersList.get("user-agent") || "unknown";
    const requestData = await req.json();

    // Process input and validate request
    const { messages, body, userInput } = processUserInput(requestData);

    // Extract and validate request body data (typed via Zod)
    const parsedResult = ChatAssistBodySchema.safeParse(body);
    if (!parsedResult.success) {
      return NextResponse.json(
        { error: "Invalid request body", issues: parsedResult.error.flatten() },
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
    } = parsedResult.data;

    const submissionBehaviorNorm:
      | "auto"
      | "manualClear"
      | "manualUnclear"
      | null =
      typeof submissionBehavior === "string" &&
      (submissionBehavior === "auto" ||
        submissionBehavior === "manualClear" ||
        submissionBehavior === "manualUnclear")
        ? submissionBehavior
        : null;

    // Effective responses may be updated by server pre-save path for auto/manualClear
    let effectiveResponses = responses as Record<string, any>;
    // If server computes a next question (e.g., after pre-save), expose it via response headers
    let serverNextQuestionId: string | null = null;

    // Sanitize user input based on question type
    let sanitizedInput = userInput;
    if (currentQuestionId) {
      const currentQuestion = formSchema.questions.find(
        (q: Question) => q.id === currentQuestionId,
      );
      if (currentQuestion) {
        const needsSanitization =
          currentQuestion.type.name === "text" ||
          !["address", "multipleChoice", "fileUpload", "ranking"].includes(
            currentQuestion.type.name,
          );

        if (needsSanitization && typeof userInput === "string") {
          sanitizedInput = sanitizeUserInput(userInput);
        }
      }
    } else if (typeof userInput === "string") {
      sanitizedInput = sanitizeUserInput(userInput);
    }

    // Ensure submission exists in database
    const activeSubmissionId = await ensureSubmissionExists(
      submissionId,
      formSchema,
      userId,
      isTestSubmission,
      ip,
      userAgent,
    );

    // Hydrate effective responses from server DB to avoid stale client state
    effectiveResponses = await hydrateEffectiveResponses(
      activeSubmissionId,
      responses,
    );

    // Determine server-derived active question and normalize currentQuestionId for manualUnclear
    const serverActiveQuestionId =
      formSchema.questions.find(
        (q: Question) =>
          !Object.prototype.hasOwnProperty.call(effectiveResponses, q.id),
      )?.id ?? null;

    let effectiveCurrentQuestionId =
      currentQuestionId ?? serverActiveQuestionId;

    if (submissionBehaviorNorm === "manualUnclear") {
      const invalidOrAnswered =
        !effectiveCurrentQuestionId ||
        !formSchema.questions.some(
          (q: Question) => q.id === effectiveCurrentQuestionId,
        ) ||
        Object.prototype.hasOwnProperty.call(
          effectiveResponses,
          effectiveCurrentQuestionId,
        );
      if (invalidOrAnswered) {
        effectiveCurrentQuestionId = serverActiveQuestionId;
      }
    }

    // Pre-validate submission if behavior indicates an answer
    let validationResult: ValidationResult | undefined;
    if (
      (submissionBehaviorNorm === "auto" ||
        submissionBehaviorNorm === "manualClear") &&
      currentQuestionId
    ) {
      const currentQuestion = formSchema.questions.find(
        (q: Question) => q.id === currentQuestionId,
      );

      if (currentQuestion) {
        validationResult = FormValidator.validate(
          sanitizedInput,
          currentQuestion,
        );

        if (
          validationResult.isValid &&
          validationResult.normalizedValue !== undefined
        ) {
          const crossFieldValidation = FormValidator.validateCrossField(
            currentQuestionId,
            validationResult.normalizedValue,
            responses,
            formSchema,
          );
          if (!crossFieldValidation.isValid) {
            validationResult = crossFieldValidation;
          }
        }
      }
    }

    // Server-side pre-save for auto/manualClear to avoid tool roundtrip + ensure persistence
    if (
      submissionBehaviorNorm &&
      (submissionBehaviorNorm === "auto" ||
        submissionBehaviorNorm === "manualClear") &&
      currentQuestionId
    ) {
      const currentQuestion = formSchema.questions.find(
        (q: Question) => q.id === currentQuestionId,
      );

      // Prefer value from justSavedAnswer, else use normalized validated input or sanitized text
      let valueToPersist: any =
        justSavedAnswer &&
        Object.prototype.hasOwnProperty.call(justSavedAnswer, "value")
          ? (justSavedAnswer as any).value
          : (validationResult?.normalizedValue ?? sanitizedInput);

      // Validate against question config if available
      let validatedOk = true;
      if (currentQuestion) {
        const v = FormValidator.validate(valueToPersist, currentQuestion);
        if (!v.isValid) {
          validatedOk = false;
        } else if (v.normalizedValue !== undefined) {
          valueToPersist = v.normalizedValue;
        }
      }

      if (validatedOk) {
        const saved = await preSaveAnswer(
          activeSubmissionId,
          currentQuestionId,
          valueToPersist,
        );

        if (saved) {
          // Update effective responses locally
          effectiveResponses = {
            ...effectiveResponses,
            [currentQuestionId]: valueToPersist,
          };

          // Compute next unanswered question (linear for now; branching integration can hook here)
          const nextQ = formSchema.questions.find(
            (q: Question) =>
              !Object.prototype.hasOwnProperty.call(effectiveResponses, q.id),
          );
          serverNextQuestionId = nextQ?.id ?? null;
        }
      }
    }

    // Server-side pre-save for manualUnclear when client currentQuestionId is stale/invalid/already answered
    if (
      submissionBehaviorNorm === "manualUnclear" &&
      effectiveCurrentQuestionId
    ) {
      const activeQuestion = formSchema.questions.find(
        (q: Question) => q.id === effectiveCurrentQuestionId,
      );

      let valueToPersist: any = sanitizedInput;
      let validatedOk = true;

      if (activeQuestion) {
        const v = FormValidator.validate(valueToPersist, activeQuestion);
        if (!v.isValid) {
          validatedOk = false;
        } else if (v.normalizedValue !== undefined) {
          valueToPersist = v.normalizedValue;
        }
      }

      if (validatedOk) {
        const saved = await preSaveAnswer(
          activeSubmissionId,
          effectiveCurrentQuestionId,
          valueToPersist,
        );

        if (saved) {
          effectiveResponses = {
            ...effectiveResponses,
            [effectiveCurrentQuestionId]: valueToPersist,
          };

          const nextQ2 = formSchema.questions.find(
            (q: Question) =>
              !Object.prototype.hasOwnProperty.call(effectiveResponses, q.id),
          );
          serverNextQuestionId = nextQ2?.id ?? null;
        }
      }
    }

    // Build AI context (for logging/debugging if needed)
    // const context = buildAIContext(
    //   sanitizedInput,
    //   submissionBehaviorNorm,
    //   formSchema,
    //   effectiveCurrentQuestionId ?? null,
    //   effectiveResponses,
    //   validationResult,
    //   justSavedAnswer,
    // );

    const answeredQuestions = Object.keys(effectiveResponses || {});
    const nextQuestion = formSchema.questions.find(
      (q: Question) => !answeredQuestions.includes(q.id),
    );
    console.error(
      "[chat-assist] Next unanswered question:",
      nextQuestion?.id || "ALL_ANSWERED",
    );

    if (!nextQuestion && activeSubmissionId) {
      after(() =>
        runSubmissionJob({
          submissionId: activeSubmissionId,
          formVersionId: formSchema.version_id ?? null,
          trigger: "completed",
        }).catch((error: unknown) => {
          logger.error("[Lifecycle] chat-assist job failed", {
            submissionId: activeSubmissionId,
            error: error instanceof Error ? error.message : String(error),
          });
        }),
      );
    }

    // Save user message - find the last user message from the request
    if (sanitizedInput && messages.length > 0) {
      const lastUserMessage = [...messages]
        .reverse()
        .find((msg: any) => msg.role === "user");

      if (lastUserMessage) {
        await saveSubmissionMessage(
          activeSubmissionId,
          lastUserMessage,
          userId ?? undefined,
        );
      }
    }

    // Track metrics
    trackServerEvent("api.form_assist.request", {
      formId: formSchema.id,
      submissionBehavior: submissionBehaviorNorm || "none",
      hasValidationResult: !!validationResult,
    });

    // Create AI tools and build system prompt
    const tools = createAITools({
      submissionId: activeSubmissionId,
      userId: userId ?? undefined,
      formSchema,
      responses: effectiveResponses,
    });

    const systemPrompt = await loadPrompt("filler/form-assistant-system.md", {
      journey_script: String(formSchema.settings?.journeyScript || ""),
      // Include guardrails only for user-facing chat-assist endpoint
      include_guards: true,
    });

    // Stream AI response
    try {
      // Ensure at least one valid message for the model
      // Messages can have either 'content' or 'parts' format
      const aiMessages = (Array.isArray(messages) ? messages : []).filter(
        (m: any) => m && m.role && (m.content || m.parts),
      );
      if (aiMessages.length === 0) {
        aiMessages.push({
          role: "user",
          parts: [{ type: "text", text: sanitizedInput || "Start the form" }],
        });
      }

      // Inject minimal, structured form context so the model can choose correct tool/question IDs
      const minimalContext = {
        submissionBehavior: submissionBehaviorNorm,
        currentQuestionId: effectiveCurrentQuestionId ?? null,
        firstUnansweredId: nextQuestion?.id ?? null,
        answeredIds: Object.keys(effectiveResponses || {}),
        justSavedAnswer: justSavedAnswer ?? null,
        responses: effectiveResponses || {},
        branchingEnabled: Boolean(formSchema.settings?.branching?.enabled),
        journeyScript: String(formSchema.settings?.journeyScript || ""),
        questions: Array.isArray(formSchema?.questions)
          ? formSchema.questions.map((q: any) => ({
              id: q.id,
              title: q.title ?? null,
              type: q.type?.name ?? null,
              required: !!q.validations?.required,
              mightBranchOffNext: Boolean(q.mightBranchOffNext),
            }))
          : [],
      };
      aiMessages.push({
        role: "user",
        parts: [
          {
            type: "text",
            text: `FORM_CONTEXT:${JSON.stringify(minimalContext)}`,
          },
        ],
      });

      const stream = await streamAIResponse(
        aiMessages,
        systemPrompt,
        tools,
        activeSubmissionId,
        formSchema,
        userId ?? undefined,
        startTime,
      );

      return createUIMessageStreamResponse({ stream });
    } catch (aiError) {
      console.error("AI processing failed:", {
        error: aiError,
        message: aiError instanceof Error ? aiError.message : "Unknown error",
        name: aiError instanceof Error ? aiError.name : "Unknown",
        stack: aiError instanceof Error ? aiError.stack : undefined,
      });

      // Return appropriate fallback response
      if (validationResult && !validationResult.isValid) {
        return createErrorResponse(
          `There was an issue with your input: ${validationResult.error}. Please try again.`,
        );
      }

      return createErrorResponse(
        "I'm having trouble processing your request. Please try again in a moment.",
      );
    }
  } catch (error) {
    console.error("Form assist API critical error:", {
      error,
      message: error instanceof Error ? error.message : "Unknown error",
      name: error instanceof Error ? error.name : "Unknown",
      stack: error instanceof Error ? error.stack : undefined,
    });
    trackServerEvent("api.form_assist.critical_error");

    return createErrorResponse(
      error instanceof Error ? error.message : "Internal server error",
    );
  }
}
