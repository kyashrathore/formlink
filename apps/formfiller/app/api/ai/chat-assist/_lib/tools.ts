import { runSubmissionJob } from "@/app/lib/intel/submission-job";
import type { ChatContext, QuestionResponse } from "@/lib/types";
import { FormValidator } from "@/lib/validation/FormValidator";
import { tool } from "ai";
import { z } from "zod";
import { Question, trackServerEvent, triggerWebhook } from "../utils";
import {
  markSubmissionCompleted,
  preSaveAnswer,
  upsertAnswerBatch,
} from "./submission";

const SAVE_ANSWER_INPUT = z.object({
  questionId: z.string(),
  value: z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.array(z.string()),
    z.record(z.any()),
    z.null(),
  ]),
});

const COMPLETE_SUBMISSION_INPUT = z.object({
  finalValidation: z.boolean().optional().default(true),
});

type CreateAIToolsOptions = ChatContext & {
  partialSubmission: boolean;
};

type SaveAnswerInput = z.infer<typeof SAVE_ANSWER_INPUT>;
type CompleteSubmissionInput = z.infer<typeof COMPLETE_SUBMISSION_INPUT>;

function findQuestion(
  formSchema: ChatContext["formSchema"],
  questionId?: string | null,
): Question | undefined {
  if (!questionId || !formSchema?.questions) {
    return undefined;
  }
  return formSchema.questions.find((q: Question) => q.id === questionId);
}

function computeNextQuestion(
  formSchema: ChatContext["formSchema"],
  responses: Record<string, QuestionResponse> = {},
): { nextQuestionId: string | null; hasRemaining: boolean } {
  if (!formSchema?.questions?.length) {
    return { nextQuestionId: null, hasRemaining: false };
  }
  for (const question of formSchema.questions) {
    if (!Object.prototype.hasOwnProperty.call(responses, question.id)) {
      return { nextQuestionId: question.id, hasRemaining: true };
    }
  }
  return { nextQuestionId: null, hasRemaining: false };
}

function validateAnswer(
  question: Question,
  rawValue: QuestionResponse,
  responses: Record<string, QuestionResponse>,
  formSchema: ChatContext["formSchema"],
): { isValid: boolean; value?: QuestionResponse; error?: string } {
  const validation = FormValidator.validate(rawValue, question);
  if (!validation.isValid) {
    return { isValid: false, error: validation.error || "Invalid value" };
  }

  let normalizedValue: QuestionResponse = rawValue;
  if (validation.normalizedValue !== undefined) {
    normalizedValue = validation.normalizedValue as QuestionResponse;
  }

  const cross = FormValidator.validateCrossField(
    question.id,
    normalizedValue,
    responses,
    formSchema as any,
  );

  if (!cross.isValid) {
    return { isValid: false, error: cross.error || "Invalid value" };
  }

  return { isValid: true, value: normalizedValue };
}

export function createAITools(options: CreateAIToolsOptions) {
  const {
    submissionId,
    userId,
    formSchema,
    responses = {},
    partialSubmission,
  } = options;

  const safeResponses: Record<string, QuestionResponse> = { ...responses };

  const completeSubmissionTool = tool({
    description:
      "Mark the submission as complete and persist outstanding answers when needed.",
    inputSchema: COMPLETE_SUBMISSION_INPUT,
    execute: async ({ finalValidation = true }: CompleteSubmissionInput) => {
      if (!formSchema) {
        return { completed: false, error: "Missing form schema" };
      }

      if (finalValidation) {
        const requiredQuestions = formSchema.questions.filter(
          (q: Question) => q.validations?.required,
        );
        const missing = requiredQuestions.filter((q: Question) => {
          const value = safeResponses[q.id];
          if (value === undefined || value === null) return true;
          if (typeof value === "string") return value.trim().length === 0;
          if (Array.isArray(value)) return value.length === 0;
          return false;
        });

        if (missing.length > 0) {
          return {
            completed: false,
            error: `Missing required fields: ${missing
              .map((q: Question) => q.title || q.id)
              .join(", ")}`,
          };
        }
      }

      if (!partialSubmission) {
        const payload = Object.entries(safeResponses).map(
          ([questionId, value]) => ({ questionId, value }),
        );
        const persisted = await upsertAnswerBatch(submissionId, payload);
        if (!persisted) {
          return {
            completed: false,
            error: "Unable to persist responses",
          };
        }
      }

      const completionMetrics = {
        total_questions: formSchema.questions.length,
        answered_questions: Object.keys(safeResponses).length,
      };

      const marked = await markSubmissionCompleted(submissionId, {
        completion_metrics: {
          ...completionMetrics,
          completion_percentage: formSchema.questions.length
            ? Math.round(
                (completionMetrics.answered_questions /
                  formSchema.questions.length) *
                  100,
              )
            : 100,
        },
      });

      if (!marked) {
        return {
          completed: false,
          error: "Unable to update submission status",
        };
      }

      if (formSchema?.settings?.integrations?.webhookUrl) {
        triggerWebhook(formSchema.settings.integrations.webhookUrl, {
          submissionId,
          responses: safeResponses,
          completedAt: new Date().toISOString(),
        }).catch((error) => {
          console.error(
            "[chat-assist] Webhook failed:",
            error instanceof Error ? error.message : error,
          );
        });
      }

      void runSubmissionJob({
        submissionId,
        formVersionId: formSchema.version_id ?? null,
        trigger: "completed",
      }).catch((error) => {
        console.error(
          "[chat-assist] lifecycle job failed:",
          error instanceof Error ? error.message : error,
        );
      });

      trackServerEvent("form.completed", {
        formId: formSchema.id,
        questionCount: formSchema.questions.length,
        partialSubmission,
      });

      return { completed: true };
    },
  });

  const saveAnswerTool = tool({
    description:
      "Persist an answer for the active question. ALWAYS call this when you have extracted a valid answer from the user.",
    inputSchema: SAVE_ANSWER_INPUT,
    execute: async ({ questionId, value }: SaveAnswerInput) => {
      const question = findQuestion(formSchema, questionId);
      if (!question) {
        return {
          saved: false,
          error: "Question not found",
        };
      }

      const {
        isValid,
        value: normalized,
        error,
      } = validateAnswer(
        question,
        value as QuestionResponse,
        safeResponses,
        formSchema,
      );
      if (!isValid || normalized === undefined) {
        return {
          saved: false,
          error: error || "Invalid value",
        };
      }

      // Only adhere to partialSubmission strictly for DB persistence.
      // We still "save" it to the run state so the client stays in sync.
      if (partialSubmission) {
        const persisted = await preSaveAnswer(
          submissionId,
          question.id,
          normalized,
        );

        if (!persisted) {
          return {
            saved: false,
            error: "Failed to save answer",
          };
        }
      }

      safeResponses[question.id] = normalized;
      const { nextQuestionId, hasRemaining } = computeNextQuestion(
        formSchema,
        safeResponses,
      );

      trackServerEvent("tool.save_answer.success", {
        questionId: question.id,
        formId: formSchema?.id,
        persisted: partialSubmission,
      });

      return {
        saved: true,
        questionId: question.id,
        value: normalized,
        nextQuestionId,
        allQuestionsAnswered: !hasRemaining,
      };
    },
  });

  return {
    saveAnswer: saveAnswerTool,
    completeSubmission: completeSubmissionTool,
  };
}
