import type { ChatContext, QuestionResponse } from "@/lib/types";
import { createServerClient } from "@formlink/db";
import { tool } from "ai";
import { z } from "zod";
import { FormValidator } from "@/lib/validation/FormValidator";
import { Question, trackServerEvent, triggerWebhook } from "../utils";

export function createAITools(context: ChatContext) {
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
          z.record(z.any()), // For address objects and other complex structures
          z.null(),
        ]),
      }),
      execute: async (params) => {
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

                // Determine next question: prefer branching when enabled
                const updatedResponses = {
                  ...context.responses,
                  [effectiveQuestionId]: valueToPersist as QuestionResponse,
                } as Record<string, QuestionResponse>;

                // Let the assistant compute branching when needed via prompt.
                // We only provide the next unanswered as a convenience fallback.
                const next = context.formSchema?.questions.find(
                  (q: Question) =>
                    !Object.prototype.hasOwnProperty.call(updatedResponses, q.id),
                );
                const nextQuestionId: string | null = next?.id || null;

                const nextQuestion = context.formSchema?.questions.find(
                  (q: Question) => q.id === nextQuestionId,
                );

                return {
                  saved: true,
                  questionId: effectiveQuestionId,
                  value: valueToPersist,
                  nextQuestionId,
                  nextQuestionTitle: nextQuestion?.title || null,
                  allQuestionsAnswered: !nextQuestionId,
                  message: `Answer saved for ${effectiveQuestionId}. ${nextQuestionId ? `Next question is: ${nextQuestionId}` : "All questions answered."}`,
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
