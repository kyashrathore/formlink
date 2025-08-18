import { Question, QuestionSchema } from "@formlink/schema";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateObject } from "ai";
import { z } from "zod";
import { createAgentEvent } from "../../types/agent-events";

// Define QuestionType locally since it's not exported from schema
type QuestionType =
  | "text"
  | "singleChoice"
  | "multipleChoice"
  | "rating"
  | "date"
  | "ranking"
  | "fileUpload"
  | "address"
  | "linearScale"
  | "likertScale";

/**
 * Interface for question generation result
 */
export interface QuestionGenerationResult {
  success: boolean;
  question?: Question;
  error?: string;
}

/**
 * Interface for progress streaming
 */
interface DataStream {
  writeData: (data: unknown) => void;
}

/**
 * Interface for question generation parameters
 */
export interface GenerateQuestionParams {
  questionTitle: string;
  questionType: QuestionType;
  order: number;
  totalQuestions: number;
  formContext?: {
    title: string;
    description: string;
  };
}

/**
 * Generate a single question schema using AI SDK
 *
 * @param params - Question generation parameters
 * @param dataStream - Progress streaming interface
 * @param systemPrompt - The system prompt for question generation
 * @returns Promise<QuestionGenerationResult>
 */
export async function generateQuestion(
  params: GenerateQuestionParams,
  dataStream: DataStream,
  systemPrompt: string,
  formId: string,
  userId: string,
  getSequence: () => number,
): Promise<QuestionGenerationResult> {
  try {
    const { questionTitle, questionType, order, totalQuestions, formContext } =
      params;

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error("OPENROUTER_API_KEY environment variable is not set");
    }

    if (!systemPrompt || systemPrompt.trim() === "") {
      throw new Error("System prompt is required for question generation");
    }

    dataStream.writeData({
      type: "progress",
      message: `Generating question ${
        order + 1
      } of ${totalQuestions}: \"${questionTitle}\"`, 
      step: "question_generation",
      progress: Math.round(((order + 1) / totalQuestions) * 100),
      questionTitle,
      questionType,
    });

    const openRouterProvider = createOpenRouter({
      apiKey,
    });

    let userPrompt = `Generate a complete JSON schema for the question: \"${questionTitle}\" (type: ${questionType}). This is question ${
      order + 1
    } of ${totalQuestions}.`;

    if (formContext) {
      userPrompt += `\n\nForm context:\nTitle: ${formContext.title}\nDescription: ${formContext.description}`;
    }

    dataStream.writeData({
      type: "progress",
      message: `Processing AI generation for \"${questionTitle}\"...`,
      step: "ai_processing",
      progress: Math.round(((order + 0.5) / totalQuestions) * 100),
    });

    const generateSchemaResult = await generateObject({
      model: openRouterProvider("openai/gpt-4o"),
      schema: QuestionSchema,
      system: systemPrompt,
      prompt: userPrompt,
    });

    if (!generateSchemaResult?.object) {
      throw new Error(
        `AI call for schema generation failed. Question: \"${questionTitle}\". Result: ${JSON.stringify(
          generateSchemaResult,
        )}`,
      );
    }

    const generatedQuestion = generateSchemaResult.object;

    dataStream.writeData({
      type: "custom_agent_event",
      payload: createAgentEvent(
        "question_schema_generated",
        "progress",
        {
          questionTitle: questionTitle,
          questionIndex: order,
          totalQuestions: totalQuestions,
          question: generatedQuestion,
          message: `Generated question: \"${questionTitle}\"`, 
        },
        formId,
        userId,
        getSequence(),
      ),
    });

    dataStream.writeData({
      type: "progress",
      message: `Completed question: \"${questionTitle}\"`, 
      step: "question_complete",
      progress: Math.round(((order + 1) / totalQuestions) * 100),
      questionGenerated: true,
    });

    return {
      success: true,
      question: generatedQuestion,
    };
  } catch (error) {
    const errorMessage =
      (error as Error)?.message ||
      `Unknown error generating question: \"${params.questionTitle}\"`;

    console.error(`[QUESTION_GENERATION_ERROR] Failed to generate question "${params.questionTitle}":`, {
      error: errorMessage,
      questionType: params.questionType,
      order: params.order,
      fullError: error
    });

    dataStream.writeData({
      type: "error",
      message: `Failed to generate question: \"${params.questionTitle}\"`, 
      error: errorMessage,
      step: "question_error",
      questionTitle: params.questionTitle,
    });

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Generate multiple questions in parallel
 */
export async function generateQuestionsParallel(
  questionParams: GenerateQuestionParams[],
  dataStream: DataStream,
  systemPrompt: string,
  formId: string,
  userId: string,
  getSequence: () => number,
): Promise<QuestionGenerationResult[]> {
  dataStream.writeData({
    type: "custom_agent_event",
    payload: createAgentEvent(
      "agent_warning",
      "system",
      {
        message: `Starting generation of ${questionParams.length} questions`,
        details: {
          event_source: "metadata_generator_task_list",
          questionTaskCount: questionParams.length,
        },
      },
      formId,
      userId,
      getSequence(),
    ),
  });

  dataStream.writeData({
    type: "progress",
    message: `Starting parallel generation of ${questionParams.length} questions...`,
    step: "parallel_start",
    progress: 0,
    totalQuestions: questionParams.length,
  });

  const results = await Promise.all(
    questionParams.map((params) =>
      generateQuestion(
        params,
        dataStream,
        systemPrompt,
        formId,
        userId,
        getSequence,
      ),
    ),
  );

  const successCount = results.filter((r) => r.success).length;
  const errorCount = results.filter((r) => !r.success).length;

  dataStream.writeData({
    type: "progress",
    message: `Parallel generation complete: ${successCount} successful, ${errorCount} failed`,
    step: "parallel_complete",
    progress: 100,
    successCount,
    errorCount,
  });

  return results;
}