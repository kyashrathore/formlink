import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { stepCountIs, streamText, tool } from "ai";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";

import type { ChatContext, QuestionResponse } from "@/lib/types";
import { createServerClient } from "@formlink/db";
import {
  AIContext,
  FormValidator,
  Question,
  sanitizeUserInput,
  trackServerEvent,
  triggerWebhook,
  ValidationResult,
} from "./utils";

// AI provider configuration
function createAIProvider() {
  const apiKey = process.env.OPENROUTER_API_KEY || "";
  if (!apiKey) {
    console.warn("OPENROUTER_API_KEY not found in environment");
    throw new Error("OpenRouter API key is required");
  }

  const provider = createOpenRouter({ apiKey });
  return provider("openai/gpt-4o"); // Much faster than Gemini 2.5 Pro
}

// Message persistence utilities
async function saveMessage(
  submissionId: string,
  message: any,
  userId?: string,
): Promise<void> {
  try {
    const supabase = await createServerClient(null, "service");
    const { error } = await supabase.from("submission_messages").insert({
      submission_id: submissionId,
      role: message.role,
      content: message,
      user_id: userId || null,
    });

    if (error) {
      console.error("Error saving message to submission_messages:", error);
      trackServerEvent("message.save.error", { role: message.role });
      throw new Error(
        `Failed to save ${message.role} message: ${error.message}`,
      );
    }
  } catch (err) {
    console.error("Exception while saving message:", err);
    trackServerEvent("message.save.exception", { role: message.role });
    throw err;
  }
}

// AI Tools factory
function createAITools(context: ChatContext) {
  return {
    saveAnswer: tool({
      description: "Save a validated value to the database",
      inputSchema: z.object({
        questionId: z.string(),
        value: z.union([
          z.string(),
          z.number(),
          z.boolean(),
          z.array(z.string()),
          z.null(),
        ]),
      }),
      execute: async (params) => {
        console.error(
          "[saveAnswer] Called with params:",
          JSON.stringify(params, null, 2),
        );
        console.error(
          "[saveAnswer] Current context responses:",
          Object.keys(context.responses || {}),
        );
        console.error(
          "[saveAnswer] Full context.responses:",
          JSON.stringify(context.responses, null, 2),
        );
        console.error(
          "[saveAnswer] Context formSchema questions:",
          context.formSchema?.questions?.map((q: any) => q.id),
        );

        // Try to extract questionId and value
        const { questionId, value } = params;
        console.error(
          "[saveAnswer] Saving answer for:",
          questionId,
          "with value:",
          value,
        );

        // Validate against form schema for manualUnclear path too
        // Determine effective questionId: prefer provided if valid, else fallback to first unanswered
        const answeredMap = (context.responses || {}) as Record<
          string,
          QuestionResponse
        >;

        // If no questionId provided at all, try to use the first unanswered question
        let effectiveQuestionId: string | undefined = questionId;

        if (!questionId) {
          const firstUnanswered = context.formSchema?.questions?.find(
            (q: Question) =>
              !Object.prototype.hasOwnProperty.call(answeredMap, q.id),
          );
          effectiveQuestionId = firstUnanswered?.id;
        } else {
          // Check if provided questionId is valid
          const providedIsValid = !!context.formSchema?.questions?.some(
            (q: Question) => q.id === questionId,
          );

          if (!providedIsValid) {
            const fallbackNext = context.formSchema?.questions?.find(
              (q: Question) =>
                !Object.prototype.hasOwnProperty.call(answeredMap, q.id),
            );
            effectiveQuestionId = fallbackNext?.id;
          }
        }

        const question = context.formSchema?.questions?.find(
          (q: Question) => q.id === effectiveQuestionId,
        );
        if (!question) {
          console.error(
            "[saveAnswer] ERROR: invalid or missing questionId. Provided:",
            questionId,
            "Effective:",
            effectiveQuestionId,
            "Answered questions:",
            Object.keys(answeredMap),
          );
          return { saved: false, error: "No pending question to save" };
        }

        // Normalize and validate the value
        let valueToPersist: any = value as any;
        const validation = FormValidator.validate(valueToPersist, question);
        if (!validation.isValid) {
          console.warn("[saveAnswer] validation failed:", validation.error);
          return { saved: false, error: validation.error || "Invalid value" };
        }
        if (validation.normalizedValue !== undefined) {
          valueToPersist = validation.normalizedValue;
        }
        // Cross-field validation using current responses
        const cross = FormValidator.validateCrossField(
          effectiveQuestionId as string,
          valueToPersist as any,
          (context.responses || {}) as Record<string, QuestionResponse>,
          context.formSchema as any,
        );
        if (!cross.isValid) {
          console.warn(
            "[saveAnswer] cross-field validation failed:",
            cross.error,
          );
          return { saved: false, error: cross.error || "Invalid value" };
        }

        // Validate required parameters
        if (!effectiveQuestionId) {
          console.error("[saveAnswer] ERROR: unable to resolve questionId");
          return { saved: false, error: "Unable to resolve questionId" };
        }

        if (value === undefined) {
          console.error("[saveAnswer] ERROR: value is undefined");
          return { saved: false, error: "Missing value parameter" };
        }

        try {
          const supabase = await createServerClient(null, "service");

          // Retry logic with exponential backoff
          let retries = 3;
          let lastError = null;

          while (retries > 0) {
            try {
              const { error } = await supabase.from("form_answers").upsert(
                {
                  submission_id: context.submissionId,
                  question_id: effectiveQuestionId as string, // Safe to cast after validation above
                  answer_value: valueToPersist,
                },
                {
                  onConflict: "submission_id,question_id",
                  ignoreDuplicates: false,
                },
              );

              if (!error) {
                // Update submission last_updated_at
                await supabase
                  .from("form_submissions")
                  .update({ last_updated_at: new Date().toISOString() })
                  .eq("submission_id", context.submissionId);

                // Update the context responses to reflect the saved answer
                if (context.responses) {
                  context.responses[effectiveQuestionId] =
                    valueToPersist as QuestionResponse;
                }

                trackServerEvent("tool.save_answer.success", { questionId });

                // Find the next unanswered question
                const updatedResponses = {
                  ...context.responses,
                  [effectiveQuestionId]: valueToPersist as QuestionResponse,
                };
                const nextQuestion = context.formSchema?.questions.find(
                  (q: Question) =>
                    !Object.prototype.hasOwnProperty.call(
                      updatedResponses,
                      q.id,
                    ),
                );

                return {
                  saved: true,
                  questionId: effectiveQuestionId,
                  value: valueToPersist,
                  nextQuestionId: nextQuestion?.id || null,
                  nextQuestionTitle: nextQuestion?.title || null,
                  allQuestionsAnswered: !nextQuestion,
                  message: `Answer saved for ${effectiveQuestionId}. ${nextQuestion ? `Next question is: ${nextQuestion.id}` : "All questions answered."}`,
                };
              }

              lastError = error;
              console.error("[saveAnswer] Database save error:", error);
              retries--;
              if (retries > 0) {
                await new Promise((resolve) =>
                  setTimeout(resolve, 1000 * (4 - retries)),
                );
              }
            } catch (e) {
              lastError = e;
              retries--;
            }
          }

          console.error(
            "[saveAnswer] FAILED after all retries. Last error:",
            lastError,
          );
          trackServerEvent("tool.save_answer.failure", {
            questionId,
            error:
              lastError instanceof Error ? lastError.message : "Unknown error",
          });
          return { saved: false, error: "Failed to save answer after retries" };
        } catch (error) {
          console.error("SaveAnswer tool error:", error);
          return { saved: false, error: "An unexpected error occurred" };
        }
      },
    }),

    presentQuestion: tool({
      description:
        "Present a question without saving any data. Auto-corrects to the first unanswered question if the provided id is missing or invalid.",
      inputSchema: z.object({
        questionId: z.string(),
      }),
      execute: async ({ questionId }) => {
        // If a valid id is provided and exists in the schema, use it
        if (questionId) {
          const exists = context.formSchema?.questions?.some(
            (q: Question) => q.id === questionId,
          );
          if (exists) {
            return { questionId };
          }
        }

        // Fall back to the first unanswered question
        const answeredMap = (context.responses || {}) as Record<
          string,
          QuestionResponse
        >;
        const firstUnanswered = context.formSchema?.questions?.find(
          (q: Question) =>
            !Object.prototype.hasOwnProperty.call(answeredMap, q.id),
        );

        if (firstUnanswered?.id) {
          return { questionId: firstUnanswered.id };
        }

        return { questionId: null, error: "No unanswered questions available" };
      },
    }),

    refreshFormContext: tool({
      description: "Get latest form submission state from database",
      inputSchema: z.object({
        includeMetadata: z.boolean().optional().default(false),
      }),
      execute: async ({ includeMetadata }) => {
        try {
          const supabase = await createServerClient(null, "service");

          // Get submission and answers in parallel
          const [submissionResult, answersResult] = await Promise.all([
            supabase
              .from("form_submissions")
              .select("status, metadata, created_at, last_updated_at")
              .eq("submission_id", context.submissionId)
              .single(),
            supabase
              .from("form_answers")
              .select("question_id, answer_value")
              .eq("submission_id", context.submissionId),
          ]);

          if (submissionResult.error || answersResult.error) {
            throw new Error("Failed to fetch form context");
          }

          const responses =
            answersResult.data?.reduce(
              (acc: Record<string, QuestionResponse>, ans: any) => ({
                ...acc,
                [ans.question_id]: ans.answer_value as QuestionResponse,
              }),
              {},
            ) || {};

          const result: Record<string, unknown> = {
            responses,
            answerCount: Object.keys(responses).length,
            status: submissionResult.data?.status,
          };

          if (includeMetadata) {
            result.metadata = submissionResult.data?.metadata;
            result.timing = {
              started: submissionResult.data?.created_at,
              lastUpdate: submissionResult.data?.last_updated_at,
            };
          }

          trackServerEvent("tool.refresh_context.success");
          return result;
        } catch (error) {
          trackServerEvent("tool.refresh_context.failure");
          throw error;
        }
      },
    }),

    completeSubmission: tool({
      description: "Mark form submission as complete",
      inputSchema: z.object({
        finalValidation: z.boolean().optional().default(true),
      }),
      execute: async ({ finalValidation }) => {
        try {
          // Final validation check if requested
          if (finalValidation && context.formSchema) {
            const requiredQuestions = context.formSchema.questions.filter(
              (q: Question) => q.validations?.required,
            );
            const answeredMap = context.responses || {};
            const missingRequired = requiredQuestions.filter((q: Question) => {
              if (!Object.prototype.hasOwnProperty.call(answeredMap, q.id))
                return true;
              const v = answeredMap[q.id] as unknown;
              if (v === null || v === undefined) return true;
              if (typeof v === "string") return v.trim().length === 0;
              if (Array.isArray(v)) return v.length === 0;
              return false;
            });

            if (missingRequired.length > 0) {
              return {
                completed: false,
                error: `Missing required fields: ${missingRequired.map((q: Question) => q.title || q.id).join(", ")}`,
              };
            }
          }

          const supabase = await createServerClient(null, "service");
          const { error } = await supabase
            .from("form_submissions")
            .update({
              status: "completed",
              completed_at: new Date().toISOString(),
              metadata: {
                completion_metrics: {
                  total_questions: context.formSchema?.questions.length || 0,
                  answered_questions: Object.keys(context.responses || {})
                    .length,
                  completion_percentage: Math.round(
                    (Object.keys(context.responses || {}).length /
                      (context.formSchema?.questions.length || 1)) *
                      100,
                  ),
                },
              },
            })
            .eq("submission_id", context.submissionId);

          if (error) throw error;

          // Trigger webhook if configured
          if (context.formSchema?.settings?.integrations?.webhookUrl) {
            // Fire and forget webhook
            triggerWebhook(
              context.formSchema.settings.integrations.webhookUrl,
              {
                submissionId: context.submissionId,
                responses: context.responses || {},
                completedAt: new Date().toISOString(),
              },
            ).catch((e) => console.error("Webhook failed:", e));
          }

          trackServerEvent("form.completed", {
            formId: context.formSchema?.id,
            questionCount: Object.keys(context.responses || {}).length,
          });

          return { completed: true };
        } catch {
          trackServerEvent("tool.complete_submission.failure");
          return { completed: false, error: "Failed to complete submission" };
        }
      },
    }),
  };
}

const SIMPLE_FORM_ASSISTANT_PROMPT = `
You are a deterministic conversational form assistant.

Core principles:
- Never infer state from your own text. UI state changes only via tools.
- ALWAYS include a [question](url?qId=<questionId>) link immediately after asking each question to render the input component.
- Format EXACTLY: After your question text, add: [question](url?qId=q1_full_name) replacing q1_full_name with the actual question ID.
- Example: "What's your full name? [question](url?qId=q1_full_name)"
- Keep responses concise and focused on the current task.
- Never invent or request question IDs; always use currentQuestionId from FORM_CONTEXT or the id returned by presentQuestion.
- IMPORTANT: Always pass the questionId parameter when calling saveAnswer. Use the currentQuestionId from FORM_CONTEXT.

Submission behaviors:
- start (no currentQuestionId):
  - Immediately call presentQuestion with firstUnansweredId (from FORM_CONTEXT) or, if missing, compute the first unanswered from (formSchema.questions, responses).
  - Do not ask the user for clarification about question IDs; never request internal IDs.
- auto/manualClear:
  - The server has already saved the answer for currentQuestionId.
  - Determine the next unanswered question from (formSchema.questions, responses).
  - If there is a next question, call presentQuestion with that next question's id.
  - If there are no more questions (all questions answered), call completeSubmission.
  - Acknowledge the choice briefly, then ask the next question or provide completion message.
- manualUnclear:
  - IMPORTANT: When calling saveAnswer, you MUST include the questionId parameter.
  - If user input is a valid answer to currentQuestionId, call saveAnswer with {questionId: currentQuestionId, value: userInput}.
  - The currentQuestionId is provided in FORM_CONTEXT - use that exact value.
    - After saveAnswer returns:
      - If result.nextQuestionId, call presentQuestion with that id.
      - If result.allQuestionsAnswered, call completeSubmission.
  - If user input is a clarification/help/random (not a valid answer), call presentQuestion with currentQuestionId to re-present the same question and add a brief clarification.

Tool usage rules:
- presentQuestion: Use to explicitly set which question is active without saving anything.
- saveAnswer: ALWAYS include both questionId and value parameters. Use currentQuestionId from FORM_CONTEXT for the questionId.
- completeSubmission: Use only when all required questions are answered (saveAnswer result indicates completion).

Determining the next question:
- Use answeredIds from FORM_CONTEXT as the source of truth for answered questions.
- Iterate formSchema.questions in order; pick the first id not in answeredIds.

CRITICAL COMPLETION RULE:
- ALWAYS call completeSubmission when there are no more questions to present
- Check FORM_CONTEXT.answeredIds length against questions array length
- If answeredIds.length equals questions.length, you MUST call completeSubmission
- NEVER generate completion messages without calling completeSubmission first

Completion message generation:
- When calling completeSubmission, generate a personalized completion message using actual response values from FORM_CONTEXT.responses
- Access specific answers using question IDs (e.g., responses["q1_interest"], responses["q2_hobbies"])
- Make all answer values **bold** in the completion message using markdown
- Example: "Your main interest is **Software Development**, you enjoy **3** hobbies, you value **Innovation** the most"
- Provide a warm, personalized summary that references actual submitted values, not placeholders
- End with encouragement about next steps or how the information will be used

Tone:
- Friendly and concise. Acknowledge briefly, then move forward.
`;

/**
 * Request/Response API Schemas
 * This codifies the chat-assist request contract to avoid free-form parsing.
 */
const JustSavedAnswerSchema = z.object({
  questionId: z.string(),
  value: z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.array(z.string()),
    z.record(z.any()), // For address objects and other complex structures
    z.null(),
  ]),
});

const ChatAssistBodySchema = z.object({
  submissionId: z.string().optional().nullable(),
  userInput: z.any().optional(),
  submissionBehavior: z
    .enum(["auto", "manualClear", "manualUnclear"])
    .optional()
    .nullable(),
  currentQuestionId: z.string().optional().nullable(),
  formSchema: z.any(), // validated upstream
  responses: z.record(z.any()).default({}),
  justSavedAnswer: JustSavedAnswerSchema.optional(),
  userId: z.string().optional().nullable(),
  isTestSubmission: z.boolean().optional().default(false),
  messages: z.any().optional(),
});

// Submission management utilities
async function ensureSubmissionExists(
  submissionId: string | null | undefined,
  formSchema: any,
  userId?: string | null | undefined,
  isTestSubmission = false,
  ip = "unknown",
  userAgent = "unknown",
): Promise<string> {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  let activeSubmissionId = submissionId;
  if (!activeSubmissionId || !uuidRegex.test(activeSubmissionId)) {
    if (activeSubmissionId && !uuidRegex.test(activeSubmissionId)) {
      console.warn(
        `[chat-assist] Invalid submission ID format, generating new: ${activeSubmissionId}`,
      );
    }
    activeSubmissionId = uuidv4();
  }

  const supabase = await createServerClient(null, "service");
  const { error: submissionError } = await supabase
    .from("form_submissions")
    .upsert(
      {
        submission_id: activeSubmissionId,
        form_version_id: formSchema.version_id || formSchema.id,
        status: "in_progress",
        user_id: userId,
        testmode: isTestSubmission,
        metadata: {
          ip_address: ip,
          user_agent: userAgent,
          started_at: new Date().toISOString(),
        },
      },
      { onConflict: "submission_id" },
    );

  if (submissionError) {
    console.error("Failed to create/update submission:", submissionError);
    trackServerEvent("submission.upsert.error", {
      error: submissionError.message,
    });
    throw new Error("Failed to initialize form submission");
  }

  return activeSubmissionId;
}

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

// Context building utilities
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

// AI streaming utilities
async function streamAIResponse(
  messages: any[],
  systemPrompt: string,
  tools: any,
  submissionId: string,
  formSchema: any,
  userId?: string,
  startTime = Date.now(),
) {
  const model = createAIProvider();

  const validMessages = messages
    .filter((msg: any) => msg && msg.role && msg.content)
    .map((msg: any) => {
      // Convert content to proper format for AI SDK v5
      let content = msg.content;

      // Convert content to string format for AI SDK v5
      if (Array.isArray(content)) {
        if (content.every((item) => typeof item === "string")) {
          // Array of strings: convert to comma-separated string
          content = content.join(", ");
        } else if (
          content.some(
            (item) =>
              item instanceof File ||
              (item && item.constructor && item.constructor.name === "File") ||
              (item &&
                typeof item === "object" &&
                "url" in item &&
                "name" in item),
          )
        ) {
          // Array containing files or file metadata: convert to file descriptions
          content = content
            .map((item) => {
              if (
                item instanceof File ||
                (item && item.constructor && item.constructor.name === "File")
              ) {
                return `Uploaded: ${item.name || "unknown"}`;
              } else if (
                item &&
                typeof item === "object" &&
                "url" in item &&
                "name" in item
              ) {
                return `Uploaded: ${item.name || "unknown"}`;
              }
              return String(item);
            })
            .join(", ");
        } else {
          // Array of other types: convert to comma-separated string
          content = content.map((item) => String(item)).join(", ");
        }
      } else if (typeof content === "number") {
        // Number: convert to string
        content = content.toString();
      } else if (typeof content === "boolean") {
        // Boolean: convert to string
        content = content.toString();
      } else if (
        typeof content === "object" &&
        content !== null &&
        !Array.isArray(content)
      ) {
        // Check if it's a File object or file metadata
        if (
          content instanceof File ||
          (content.constructor && content.constructor.name === "File")
        ) {
          // File object: convert to upload message
          content = `Uploaded: ${content.name || "unknown"}`;
        } else if (content && "url" in content && "name" in content) {
          // File metadata: convert to upload message
          content = `Uploaded: ${content.name || "unknown"}`;
        } else {
          // Other objects (like address): convert to JSON string
          content = JSON.stringify(content);
        }
      }

      return {
        ...msg,
        content,
      };
    });

  return streamText({
    model,
    system: systemPrompt,
    messages: validMessages,
    tools,
    toolChoice: "auto",
    stopWhen: stepCountIs(12),
    onFinish: async ({ text, toolCalls }) => {
      try {
        await saveMessage(
          submissionId,
          { role: "assistant", content: text, id: Date.now().toString() },
          userId,
        );

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
      } catch (finishError) {
        console.error("Error in onFinish callback:", finishError);
      }
    },
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
    try {
      const supabase = await createServerClient(null, "service");
      const { data: serverAns, error: serverAnsErr } = await supabase
        .from("form_answers")
        .select("question_id, answer_value")
        .eq("submission_id", activeSubmissionId);

      const serverMap =
        (serverAns ?? []).reduce((acc: Record<string, any>, r: any) => {
          acc[r.question_id] = r.answer_value;
          return acc;
        }, {}) || {};

      // Merge client responses with server answers, server wins on conflicts
      effectiveResponses = { ...(responses || {}), ...serverMap };

      if (serverAnsErr) {
        console.warn(
          "[chat-assist] Failed to fetch server answers:",
          serverAnsErr,
        );
      }
    } catch (err) {
      console.warn(
        "[chat-assist] Exception while fetching server answers:",
        err,
      );
    }

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
      try {
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
          const supabase = await createServerClient(null, "service");
          // Persist answer
          await supabase.from("form_answers").upsert({
            submission_id: activeSubmissionId,
            question_id: currentQuestionId,
            answer_value: valueToPersist,
          });

          // Touch submission updated time
          await supabase
            .from("form_submissions")
            .update({ last_updated_at: new Date().toISOString() })
            .eq("submission_id", activeSubmissionId);

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
      } catch (e) {
        console.warn(
          "[chat-assist] Server pre-save failed, continuing with model flow:",
          e,
        );
      }
    }

    // Server-side pre-save for manualUnclear when client currentQuestionId is stale/invalid/already answered
    if (
      submissionBehaviorNorm === "manualUnclear" &&
      effectiveCurrentQuestionId
    ) {
      try {
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
          const supabase = await createServerClient(null, "service");

          await supabase.from("form_answers").upsert({
            submission_id: activeSubmissionId,
            question_id: effectiveCurrentQuestionId,
            answer_value: valueToPersist,
          });

          await supabase
            .from("form_submissions")
            .update({ last_updated_at: new Date().toISOString() })
            .eq("submission_id", activeSubmissionId);

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
      } catch (e) {
        console.warn("[chat-assist] ManualUnclear pre-save failed:", e);
      }
    }

    // Build AI context
    const context = buildAIContext(
      sanitizedInput,
      submissionBehaviorNorm,
      formSchema,
      effectiveCurrentQuestionId ?? null,
      effectiveResponses,
      validationResult,
      justSavedAnswer,
    );

    const answeredQuestions = Object.keys(effectiveResponses || {});
    const nextQuestion = formSchema.questions.find(
      (q: Question) => !answeredQuestions.includes(q.id),
    );
    console.error(
      "[chat-assist] Next unanswered question:",
      nextQuestion?.id || "ALL_ANSWERED",
    );

    // Save user message
    if (sanitizedInput) {
      // Ensure content is a string for display
      let messageContent = sanitizedInput;
      if (Array.isArray(sanitizedInput)) {
        messageContent = sanitizedInput.join(", ");
      } else if (
        typeof sanitizedInput === "object" &&
        sanitizedInput !== null
      ) {
        messageContent = JSON.stringify(sanitizedInput);
      } else {
        messageContent = String(sanitizedInput);
      }

      await saveMessage(
        activeSubmissionId,
        { role: "user", content: messageContent, id: Date.now().toString() },
        userId ?? undefined,
      );
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

    let systemPrompt = SIMPLE_FORM_ASSISTANT_PROMPT;
    if (formSchema.settings?.journeyScript) {
      systemPrompt += `\n\n## FORM-SPECIFIC JOURNEY SCRIPT:\n${String(formSchema.settings.journeyScript)}`;
    }

    // Stream AI response
    try {
      // Ensure at least one valid message with content for the model
      const aiMessages = (Array.isArray(messages) ? messages : []).filter(
        (m: any) => m && m.role && m.content,
      );
      if (aiMessages.length === 0) {
        aiMessages.push({
          role: "user",
          content: sanitizedInput || "Start the form",
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
        questions: Array.isArray(formSchema?.questions)
          ? formSchema.questions.map((q: any) => ({
              id: q.id,
              title: q.title ?? null,
              type: q.type?.name ?? null,
              required: !!q.validations?.required,
            }))
          : [],
      };
      aiMessages.push({
        role: "user",
        content: `FORM_CONTEXT:${JSON.stringify(minimalContext)}`,
      });

      const result = await streamAIResponse(
        aiMessages,
        systemPrompt,
        tools,
        activeSubmissionId,
        formSchema,
        userId ?? undefined,
        startTime,
      );

      const responseHeaders: Record<string, string> = {
        "X-Submission-Id": activeSubmissionId,
        "X-Submission-Regenerated":
          activeSubmissionId !== submissionId ? "true" : "false",
      };
      if (serverNextQuestionId) {
        responseHeaders["X-Next-Question-Id"] = serverNextQuestionId;
      } else if (nextQuestion?.id) {
        responseHeaders["X-Next-Question-Id"] = nextQuestion.id;
      }

      return result.toUIMessageStreamResponse({
        headers: responseHeaders,
      });
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
