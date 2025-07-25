import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { streamText, tool } from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";
import { headers } from "next/headers";
import { v4 as uuidv4 } from "uuid";

import type { ChatContext, FormAnswer, QuestionResponse } from "@/lib/types";
import { createServerClient } from "@formlink/db";
import {
  FormValidator,
  ContextManager,
  sanitizeUserInput,
  triggerWebhook,
  trackServerEvent,
  AIContext,
  ValidationResult,
  Question,
} from "./utils";

// Initialize OpenRouter provider with debugging
const apiKey = process.env.OPENROUTER_API_KEY || "";
if (!apiKey) {
  console.error("OPENROUTER_API_KEY not found in environment");
}

const openRouterProvider = createOpenRouter({
  apiKey,
});

// Use a more stable model
const MODEL = openRouterProvider("google/gemini-2.5-flash");

// Helper function to save message to database
async function saveMessage(
  submissionId: string,
  role: "user" | "assistant",
  content: string,
  userId?: string,
) {
  try {
    const supabase = await createServerClient(null, "service");
    const { error } = await supabase.from("submission_messages").insert({
      submission_id: submissionId,
      role,
      content: { text: content },
      user_id: userId || null,
    });

    if (error) {
      console.error("Error saving message to submission_messages:", error);
      trackServerEvent("message.save.error", { role });
    }
  } catch (err) {
    console.error("Exception while saving message:", err);
    trackServerEvent("message.save.exception", { role });
  }
}

// Create tools factory function to access context
function createTools(context: ChatContext) {
  return {
    saveAnswer: tool({
      description: "Save a validated answer to the database",
      parameters: z.object({
        questionId: z.string(),
        answer: z.union([
          z.string(),
          z.number(),
          z.boolean(),
          z.array(z.string()),
          z.null(),
        ]),
      }),
      execute: async ({ questionId, answer }) => {
        try {
          const supabase = await createServerClient(null, "service");

          // Retry logic with exponential backoff
          let retries = 3;
          let lastError = null;

          while (retries > 0) {
            try {
              const { error } = await supabase.from("form_answers").upsert({
                submission_id: context.submissionId,
                question_id: questionId,
                answer_value: answer,
              });

              if (!error) {
                // Update submission last_updated_at
                await supabase
                  .from("form_submissions")
                  .update({ last_updated_at: new Date().toISOString() })
                  .eq("submission_id", context.submissionId);

                // Update the context responses to reflect the saved answer
                if (context.responses) {
                  context.responses[questionId] = answer;
                }

                trackServerEvent("tool.save_answer.success", { questionId });
                return { saved: true, questionId, answer };
              }

              lastError = error;
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

          trackServerEvent("tool.save_answer.failure", {
            questionId,
            error: lastError?.message || "Unknown error",
          });
          return { saved: false, error: "Failed to save answer after retries" };
        } catch (error) {
          console.error("SaveAnswer tool error:", error);
          return { saved: false, error: "An unexpected error occurred" };
        }
      },
    }),

    refreshFormContext: tool({
      description: "Get latest form submission state from database",
      parameters: z.object({
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
              .eq("submission_id", context.submissionId)
              .order("created_at", { ascending: true }),
          ]);

          if (submissionResult.error || answersResult.error) {
            throw new Error("Failed to fetch form context");
          }

          const responses =
            answersResult.data?.reduce(
              (acc: Record<string, QuestionResponse>, ans: FormAnswer) => ({
                ...acc,
                [ans.question_id]: ans.answer_value,
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
      parameters: z.object({
        finalValidation: z.boolean().optional().default(true),
      }),
      execute: async ({ finalValidation }) => {
        try {
          // Final validation check if requested
          if (finalValidation && context.formSchema) {
            const requiredQuestions = context.formSchema.questions.filter(
              (q: Question) => q.validations?.required,
            );
            const missingRequired = requiredQuestions.filter(
              (q: Question) => !context.responses?.[q.id],
            );

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

// Enhanced system prompt with psychological principles
const ENHANCED_FORM_ASSISTANT_PROMPT = `
You are a psychologically-aware conversational form assistant designed to maximize form completion through strategic communication.

## CONTEXT YOU RECEIVE:
- userInput: What the user said/typed
- submissionBehavior: How they submitted (auto = clicked component, manualClear = selected and clicked next, manualUnclear = just typed)
- currentQuestionId: Current question they're on
- responses: All their saved answers (including any just saved)
- validationResult: Pre-computed validation if submissionBehavior suggests an answer
- formSchema: Complete form structure with all questions
- progress: Form completion progress
- journeyScript: Strategic guidance for this specific form (if available)
- justSavedAnswer: If present, contains {questionId, value} of answer that was JUST saved to database

## CRITICAL RULES:
1. NEVER re-ask questions that are already in the responses object
2. The currentQuestionId indicates which question the user is CURRENTLY answering
3. If userInput contains an answer, it's for the currentQuestionId question
4. After saving an answer, move to the NEXT unanswered question, not the same one

## YOUR PSYCHOLOGICAL TOOLKIT:

1. **Build Rapport**: Mirror the user's communication style (formal/casual)
2. **Reciprocity**: Before sensitive asks (email, phone), provide genuine value based on their previous answers
3. **Progress Momentum**: Celebrate milestones naturally (25%, 50%, 75%)
4. **Resistance Handling**: 
   - Privacy concerns → Emphasize security and direct benefit
   - Time concerns → Acknowledge and show remaining progress
   - Confusion → Clarify value and purpose
5. **Micro-Commitments**: Use assumptive language that implies completion

## SUBMISSION BEHAVIORS & PRE-SAVED ANSWERS:
- auto: User clicked an option in an input component - Answer ALREADY SAVED to database
- manualClear: User selected value and clicked Next - Answer ALREADY SAVED to database  
- manualUnclear: User typed free text - You need to validate and save

IMPORTANT: When you receive 'auto' or 'manualClear' submissions:
- The answer in userInput has ALREADY been saved for currentQuestionId
- The 'justSavedAnswer' field contains { questionId, value } of what was saved
- DO NOT call saveAnswer tool - it's redundant
- Simply acknowledge the answer and present the next question
- The responses object already includes this saved answer

## YOUR DECISION PROCESS:

1. If userInput is "Start the form" and responses are empty → Begin the form journey
   - Use the journey script's <strategy> section to craft an opening
   - Build rapport and set expectations
   - Present the first question with psychological framing
   - Create excitement and reduce anxiety about the process

2. If submissionBehavior is 'auto' or 'manualClear' → Answer already saved
   - Check 'justSavedAnswer' field to see what was saved
   - Acknowledge with positive reinforcement (e.g., "Great choice!", "Perfect!")
   - Find the next unanswered question in formSchema
   - Present it with appropriate framing and [question] link

3. If submissionBehavior is 'manualUnclear' → Analyze intent
   - If it's an answer attempt → Validate for currentQuestionId
   - If valid → Call saveAnswer tool, acknowledge, present next
   - If invalid → Explain issue, re-present current question with [question] link
   - If it's a question/concern → Address it, keep current question active

4. When presenting questions:
   - Frame benefits, not just asks
   - Use conversational bridges between questions
   - Apply value exchange before sensitive questions

5. CRITICAL - Question Link Rule:
   - ALWAYS include [question](https://localhost:3000?qId=QUESTION_ID) at the end of EVERY response about an unanswered question
   - Include it when first presenting a question
   - Include it when validation fails or input is invalid
   - Include it when providing clarification about the current question
   - Include it when the user asks for help with the current question
   - NEVER omit the question link until the question is successfully answered and saved
   - The question link ensures the input component remains visible for the user

## AVAILABLE TOOLS:
- saveAnswer: Use after confirming answer is valid
- refreshFormContext: Use if you need latest saved state  
- completeSubmission: Use when all required questions are answered

## HOW TO FIND THE NEXT QUESTION:
When 'justSavedAnswer' is present:
1. The answer for justSavedAnswer.questionId is already saved
2. Look through formSchema.questions in order
3. Find the first question whose ID is NOT in the responses object
4. That's your next question to present

For other cases:
1. Look at the formSchema.questions array
2. Skip any questions whose IDs are already in the responses object
3. Present the first question that is NOT in responses
4. If all questions are answered, call completeSubmission

## FORM COMPLETION & RESULT GENERATION:
1. When all required questions are answered:
   - Call completeSubmission tool
   - Generate a result page based on the journey script's <result-generation> section
   - If no result-generation section exists, provide a simple thank you message

2. Result page should:
   - Acknowledge the user's specific responses
   - Provide the value/insights promised in the form
   - Include clear next steps if applicable
   - Match the tone specified in the journey script

## TONE GUIDANCE:
Adapt based on the form's journeyScript strategy section if provided, otherwise be warm, encouraging, and professional.

Remember: Guide users to completion through genuine value and psychological comfort, not manipulation.
`;

export async function POST(req: Request) {
  const startTime = Date.now();

  try {
    // Get headers for tracking
    const headersList = await headers();
    const ip =
      headersList.get("x-forwarded-for") ||
      headersList.get("x-real-ip") ||
      "unknown";

    const {
      userInput,
      submissionBehavior,
      currentQuestionId,
      formSchema,
      responses = {},
      submissionId,
      userId,
      justSavedAnswer,
      isTestSubmission = false,
    } = await req.json();

    // Input sanitization for security - only for string inputs
    let sanitizedInput = userInput;

    // Check if we need to sanitize based on question type
    if (currentQuestionId) {
      const currentQuestion = formSchema.questions.find(
        (q: Question) => q.id === currentQuestionId,
      );
      if (currentQuestion) {
        // Only sanitize text-based inputs
        const needsSanitization =
          currentQuestion.questionType === "text" ||
          (currentQuestion.questionType === "text" &&
            currentQuestion.display.inputType === "text") ||
          !["address", "multipleChoice", "fileUpload", "ranking"].includes(
            currentQuestion.questionType,
          );

        if (needsSanitization && typeof userInput === "string") {
          sanitizedInput = sanitizeUserInput(userInput);
        }
      }
    } else if (typeof userInput === "string") {
      // If no current question (like chat messages), sanitize if it's a string
      sanitizedInput = sanitizeUserInput(userInput);
    }

    // Initialize submission if needed
    let activeSubmissionId = submissionId;
    if (!activeSubmissionId) {
      activeSubmissionId = uuidv4();
    }

    // Always ensure submission exists (upsert)
    const supabase = await createServerClient(null, "service");
    const { error: submissionError } = await supabase
      .from("form_submissions")
      .upsert(
        {
          submission_id: activeSubmissionId,
          form_version_id: formSchema.version_id || formSchema.id,
          status: "in_progress",
          user_id: userId,
          testmode: isTestSubmission || false,
          metadata: {
            ip_address: ip,
            user_agent: headersList.get("user-agent") || "unknown",
            started_at: new Date().toISOString(),
          },
        },
        {
          onConflict: "submission_id",
        },
      );

    if (submissionError) {
      console.error("Failed to create/update submission:", submissionError);
      trackServerEvent("submission.upsert.error", {
        error: submissionError.message,
      });
      return NextResponse.json(
        { error: "Failed to initialize form submission" },
        { status: 500 },
      );
    }

    // Pre-validate if submission behavior indicates answer
    let validationResult: ValidationResult | undefined = undefined;
    if (
      (submissionBehavior === "auto" || submissionBehavior === "manualClear") &&
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

        // Cross-field validation if initial validation passed
        if (validationResult.isValid) {
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

    // Build context
    const context: AIContext = {
      userInput: sanitizedInput,
      submissionBehavior,
      formSchema,
      currentQuestionId,
      responses,
      validationResult,
      justSavedAnswer, // Include the just saved answer info
      progress: {
        answered: Object.keys(responses).length,
        total: formSchema.questions.length,
        percentage: Math.round(
          (Object.keys(responses).length / formSchema.questions.length) * 100,
        ),
      },
      journeyScript: formSchema.settings?.journeyScript,
    };

    // Compress context if needed
    const compressedContext = ContextManager.compressContext(context);

    // Save user message
    if (sanitizedInput) {
      await saveMessage(activeSubmissionId, "user", sanitizedInput, userId);
    }

    // Track request metrics
    trackServerEvent("api.form_assist.request", {
      formId: formSchema.id,
      submissionBehavior: submissionBehavior || "none",
      hasValidationResult: !!validationResult,
    });

    // Create tools with context
    const tools = createTools({
      submissionId: activeSubmissionId,
      userId,
      formSchema,
      responses,
    });

    // Build system prompt with journey script if available
    let systemPrompt = ENHANCED_FORM_ASSISTANT_PROMPT;
    if (formSchema.settings?.journeyScript) {
      systemPrompt += `\n\n## FORM-SPECIFIC JOURNEY SCRIPT:\n${formSchema.settings.journeyScript}`;
    }

    // Stream AI response with enhanced error handling
    try {
      const result = await streamText({
        model: MODEL,
        system: systemPrompt,
        prompt: JSON.stringify(compressedContext),
        tools,
        toolChoice: "auto",
        maxSteps: 5,
        onFinish: async ({ text, toolCalls }) => {
          try {
            // Save assistant message
            await saveMessage(activeSubmissionId, "assistant", text, userId);

            // Track AI performance
            const duration = Date.now() - startTime;
            trackServerEvent("api.form_assist.duration", {
              duration,
              formId: formSchema.id,
              toolCallCount: toolCalls?.length || 0,
            });

            // Track tool usage
            toolCalls?.forEach((call) => {
              trackServerEvent("tool.usage", {
                toolName: call.toolName,
                formId: formSchema.id,
              });
            });
          } catch (finishError) {
            console.error("Error in onFinish callback:", finishError);
            // Don't throw - let response complete
          }
        },
        onError: async (error: Error) => {
          console.error("StreamText onError:", error);
          trackServerEvent("api.form_assist.error", {
            formId: formSchema.id,
            errorType: error?.name || "unknown",
            errorMessage: error?.message || "unknown",
          });

          // Try to save error message for user context
          try {
            await saveMessage(
              activeSubmissionId,
              "assistant",
              "I encountered an error while processing your request. Please try again.",
              userId,
            );
          } catch (saveError) {
            console.error("Failed to save error message:", saveError);
          }
        },
      });

      return result.toDataStreamResponse({
        headers: {
          "X-Submission-Id": activeSubmissionId,
        },
      });
    } catch (aiError) {
      console.error("AI processing failed:", {
        error: aiError,
        message: aiError?.message,
        name: aiError?.name,
        stack: aiError?.stack,
        cause: aiError?.cause,
      });

      // Fallback response
      if (validationResult && !validationResult.isValid) {
        return new Response(
          JSON.stringify({
            message: `There was an issue with your input: ${validationResult.error}. Please try again.`,
            fallback: true,
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "X-Fallback-Mode": "true",
            },
          },
        );
      }

      return new Response(
        JSON.stringify({
          message:
            "I'm having trouble processing your request. Please try again in a moment.",
          fallback: true,
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "X-Fallback-Mode": "true",
          },
        },
      );
    }
  } catch (error) {
    console.error("Form assist API critical error:", {
      error,
      message: error?.message,
      name: error?.name,
      stack: error?.stack,
      cause: error?.cause,
    });
    trackServerEvent("api.form_assist.critical_error");

    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: error?.message || "Unknown error",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  }
}
