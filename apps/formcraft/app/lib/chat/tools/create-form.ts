import { createFormAgent } from "@/app/lib/agents/simple-agent"
import { getModel } from "@/app/lib/ai/provider"
import { generateObject } from "@/app/lib/ai/tracing"
import logger from "@/app/lib/logger"
import { getDefaultSettings } from "@/app/lib/settings-defaults"
import { createAgentEvent } from "@/app/lib/types/agent-events"
import { CreateFormAgentSchema } from "@/app/lib/types/chat"
import { sanitizeAgentEventForSerialization } from "@/app/lib/utils/serialization"
import { loadPrompt } from "@formlink/prompts"
import { Form, FormSchema, type Settings } from "@formlink/schema"
import { tool } from "ai"
import { TOOL_DESCRIPTIONS } from "../prompts"
import { ChatToolContext, FormCreationResult } from "../types"
import { finalizeForm } from "./finalize-form"

interface DataStream {
  write: (data: { type: string; [key: string]: unknown }) => void
}

interface FormAgentOptions {
  model?: string
  [key: string]: unknown
}

export function createFormTool(context: ChatToolContext) {
  return tool({
    description: TOOL_DESCRIPTIONS.createForm,
    inputSchema: CreateFormAgentSchema,
    execute: async ({ prompt }): Promise<FormCreationResult> => {
      const { dataStream, formId, supabase, userId, options } = context

      try {
        const { data: formData, error: fetchError } = await supabase
          .from("forms")
          .select("short_id")
          .eq("id", formId)
          .single()

        if (fetchError || !formData) {
          logger.error("[TOOL] Form not found in database", {
            formId,
            error: fetchError,
          })
          throw new Error(`Form ${formId} not found in database`)
        }

        const shortId = formData.short_id
        logger.info("[TOOL] Using existing form", { formId, shortId })

        // If singlePass option is enabled, run all-in-one creation
        if ((options as any)?.singlePass === true) {
          return await processFormCreationSinglePass({
            dataStream: dataStream as unknown as DataStream,
            formId,
            shortId,
            userId,
            prompt,
            selectedModel: (options as any)?.model,
          })
        }

        // Fallback to workflow-based path (metadata + parallel questions)
        return await processFormCreation(
          dataStream,
          formId,
          shortId,
          userId,
          prompt,
          options
        )
      } catch (error) {
        logger.error("[TOOL] Error in createForm tool", { error })
        return {
          success: false,
          formId,
          message: "Form creation failed due to an error",
          error: error instanceof Error ? error.message : String(error),
        }
      }
    },
  })
}

async function processFormCreation(
  dataStream: DataStream,
  formId: string,
  shortId: string,
  userId: string,
  prompt: string,
  options?: FormAgentOptions
): Promise<FormCreationResult> {
  logger.info("[TOOL] createForm called", {
    formId,
    userId,
    prompt: prompt.substring(0, 100) + "...",
  })

  let formTitle = "Untitled Form"
  let questionCount = 0
  let formDescription = ""
  let success = false

  const agentParams = {
    prompt,
    formId,
    shortId,
    selectedModel: options?.model,
  }

  for await (const agentEvent of createFormAgent(agentParams, userId)) {
    logger.info({
      message: "[TOOL] Processing agentEvent from createForm",
      type: agentEvent.type,
      category: agentEvent.category,
      sequence: agentEvent.sequence,
    })

    // Remove circular references before serialization
    const safeAgentEvent = sanitizeAgentEventForSerialization(agentEvent)

    dataStream.write({
      type: "data-agent_event",
      data: safeAgentEvent,
    })

    if (
      agentEvent.category === "state" &&
      agentEvent.type === "state_snapshot"
    ) {
      logger.info({
        message: "[TOOL] StateSnapshot received",
        isComplete: agentEvent.data.isComplete,
        status: agentEvent.data.agentState?.status,
        formTitleInData: agentEvent.data.form?.title,
        questionCountInData: agentEvent.data.form?.questions?.length,
      })

      if (agentEvent.data.isComplete) {
        success = agentEvent.data.agentState.status === "COMPLETED"
        formTitle = agentEvent.data.form.title || "Untitled Form"
        questionCount = agentEvent.data.form.questions.length
        formDescription = agentEvent.data.form.description || ""
        logger.info({
          message: "[TOOL] Final state snapshot processed",
          success,
          formTitle,
          questionCount,
        })
      }
    } else if (
      agentEvent.category === "error" &&
      agentEvent.type === "agent_error"
    ) {
      success = false
      logger.warn({
        message: "[TOOL] Agent error event processed, setting success=false",
        errorData: agentEvent.data,
      })
    }
  }

  logger.info("[TOOL] Simplified workflow agent execution completed", {
    formId,
    success,
    questionCount,
  })

  return {
    success,
    formId,
    formTitle,
    questionCount,
    formDescription,
    message: success
      ? `Form creation completed successfully. Created "${formTitle}" with ${questionCount} questions.`
      : "Form creation failed",
  }
}

async function processFormCreationSinglePass({
  dataStream,
  formId,
  shortId,
  userId,
  prompt,
  selectedModel,
}: {
  dataStream: DataStream
  formId: string
  shortId: string
  userId: string
  prompt: string
  selectedModel?: string
}): Promise<FormCreationResult> {
  logger.info("[TOOL] single-pass createForm invoked", { formId, userId })

  // 1) Initialization
  dataStream.write({
    type: "data-agent_event",
    data: createAgentEvent(
      "agent_initialized",
      "system",
      {
        message: "Single-pass workflow initialized.",
        details: { inputType: "prompt", prompt },
      },
      formId,
      userId,
      Date.now()
    ),
  })

  // 2) Generate full form (one call)
  let repairAttempts = 3
  const repairFunction = async ({
    text,
    error,
  }: {
    text: string
    error: unknown
  }): Promise<string> => {
    repairAttempts--
    const repairSystem = await loadPrompt("form/create-form-repair.md")
    const { object: repaired }: { object: Form } = await generateObject({
      model: getModel(selectedModel) as any,
      schema: FormSchema,
      system: repairSystem,
      experimental_repairText:
        repairAttempts > 0 ? async (p) => repairFunction(p) : undefined,
      prompt: `Repair the following JSON schema based on the error: ${JSON.stringify(error)}\nOriginal prompt: ${prompt}\nErroneous json:\n${text}`,
    })
    return JSON.stringify(repaired)
  }

  const system = await loadPrompt("form/create-form-single-pass_v1.md", {
    include_guards: true,
    user_prompt: prompt,
    session_form_id: formId,
  })

  const { object: formObj }: { object: Form } = await generateObject({
    model: getModel(selectedModel) as any,
    schema: FormSchema,
    experimental_repairText: repairFunction,
    system,
    prompt,
  })

  // 3) Normalize and stream synthesized progress
  const title = String((formObj as any)?.title || "Untitled Form")
  const description = String((formObj as any)?.description || "")
  const questions = Array.isArray((formObj as any)?.questions)
    ? ((formObj as any).questions as any[])
    : []
  const baseSettings = (formObj as any)?.settings
  let settings: Settings = getDefaultSettings()
  if (baseSettings && typeof baseSettings === "object") {
    settings = {
      ...getDefaultSettings(),
      ...(baseSettings as Partial<Settings>),
    } as Settings
  }
  const journeyScript =
    typeof (settings as any)?.journeyScript === "string"
      ? ((settings as any).journeyScript as string)
      : undefined

  // Metadata snapshot
  dataStream.write({
    type: "data-agent_event",
    data: createAgentEvent(
      "state_snapshot",
      "state",
      {
        form: {
          id: formId,
          version_id: "temp-" + Date.now(),
          title,
          description,
          questions: [],
          settings,
          current_draft_version_id: null,
          current_published_version_id: null,
          short_id: shortId,
        },
        agentState: {
          formId,
          shortId,
          userId,
          originalInput: prompt,
          inputType: "prompt" as const,
          tasksToPersist: [],
          generatedQuestionSchemas: [],
          agentMessages: [],
          iteration: 1,
          eventSequence: Date.now(),
          formMetadata: { title, description },
          ...(journeyScript ? { settings: { journeyScript } } : {}),
        },
        isComplete: false,
      },
      formId,
      userId,
      Date.now()
    ),
  })

  // Question count warning
  dataStream.write({
    type: "data-agent_event",
    data: createAgentEvent(
      "agent_warning",
      "system",
      {
        message: `Starting generation of ${questions.length} questions (single-pass result)`,
        details: {
          event_source: "single_pass_task_list",
          questionTaskCount: questions.length,
        },
      },
      formId,
      userId,
      Date.now()
    ),
  })

  // Per-question progress events
  questions.forEach((q, idx) => {
    dataStream.write({
      type: "data-agent_event",
      data: createAgentEvent(
        "question_schema_generated",
        "progress",
        {
          questionTitle: (q as any)?.title || `Question ${idx + 1}`,
          questionIndex: idx,
          totalQuestions: questions.length,
          question: q as any,
          message: `Generated question: "${
            (q as any)?.title || `Q${idx + 1}`
          }"`,
        },
        formId,
        userId,
        Date.now()
      ),
    })
  })

  // 4) Persist
  const finalization = await finalizeForm({
    formId,
    userId,
    formContent: {
      title,
      description,
      questions,
      settings,
      ...(journeyScript ? { journeyScript } : {}),
    },
    dataStream,
  })

  // Final snapshot
  dataStream.write({
    type: "data-agent_event",
    data: createAgentEvent(
      "state_snapshot",
      "state",
      {
        form: {
          id: formId,
          version_id: finalization.success
            ? (finalization.newVersionId as string)
            : "temp-err",
          title,
          description,
          questions,
          settings,
          current_draft_version_id: finalization.success
            ? (finalization.newVersionId as string)
            : null,
          current_published_version_id: undefined,
          short_id: shortId,
        },
        agentState: {
          formId,
          shortId,
          userId,
          originalInput: prompt,
          inputType: "prompt" as const,
          tasksToPersist: [],
          generatedQuestionSchemas: questions as any,
          agentMessages: [],
          iteration: 1,
          eventSequence: Date.now(),
          status: finalization.success
            ? ("COMPLETED" as const)
            : ("FAILED" as const),
          formMetadata: { title, description },
          settings,
        },
        isComplete: true,
      },
      formId,
      userId,
      Date.now()
    ),
  })

  dataStream.write({
    type: "data-agent_event",
    data: createAgentEvent(
      "agent_finalized",
      "system",
      {
        message: finalization.success
          ? "Single-pass workflow completed successfully."
          : "Single-pass workflow completed with errors.",
        details: {
          questionCount: questions.length,
          ...(finalization.success
            ? { versionId: finalization.newVersionId }
            : {}),
        },
      },
      formId,
      userId,
      Date.now()
    ),
  })

  return {
    success: finalization.success,
    formId,
    formTitle: title,
    questionCount: questions.length,
    formDescription: description,
    message: finalization.success
      ? `Form creation completed successfully. Created "${title}" with ${questions.length} questions.`
      : "Form creation failed",
  }
}
