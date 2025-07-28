type EventData =
  | { message?: string }
  | { input?: string; userId?: string; inputType?: string }
  | {
      current_step?: string
      _last_completed_node?: string
      formMetadata?: { title?: string }
      tasksToPersist?: unknown[]
      generatedQuestionSchemas?: unknown[]
      journeyScript?: string
      resultPageGenerationPrompt?: string
    }
  | {
      message?: string
      taskId?: string
      output?: string | { title?: string } | Record<string, unknown>
      error?: string | unknown
    }
  | {
      details?: { event_source?: string } | unknown
      questionIndex?: number
      totalQuestions?: number
      questionTitle?: string
    }
  | null
  | undefined
  | Record<string, unknown>

export function formatEventData(eventName: string, data: EventData): string {
  if (data === null || data === undefined) {
    return "No data"
  }

  switch (eventName) {
    case "sse_stream_init":
    case "realtime_subscribed":
      return (data as any)?.message || JSON.stringify(data)
    case "agent_init":
      return `Input: "${(data as any)?.input}", User: ${(data as any)?.userId?.substring(0, 8)}, Type: ${(data as any)?.inputType}`
    case "agent_start":
      return `Input: "${(data as any)?.input}", User: ${(data as any)?.userId?.substring(0, 8)}, Type: ${(data as any)?.inputType}`
    case "agent_state_update": {
      const summary = []
      const typedData = data as any
      if (typedData?.current_step)
        summary.push(`Step: ${typedData.current_step}`)
      else if (typedData?._last_completed_node)
        summary.push(`Last Node: ${typedData._last_completed_node}`)
      if (typedData?.formMetadata?.title)
        summary.push(`Form: "${typedData.formMetadata.title}"`)
      if (typedData?.tasksToPersist)
        summary.push(`Tasks: ${typedData.tasksToPersist.length}`)
      if (typedData?.generatedQuestionSchemas)
        summary.push(`Questions: ${typedData.generatedQuestionSchemas.length}`)
      if (typedData?.journeyScript)
        summary.push("Journey script with strategy generated")
      if (typedData?.resultPageGenerationPrompt)
        summary.push("Result page prompt generated")
      if (summary.length === 0) return "State updated (see details)"
      return summary.join(", ")
    }
    case "task_started":
    case "task_failed":
    case "task_completed": {
      const typedData = data as any
      let taskSummary =
        typedData?.message ||
        `Task ${typedData?.taskId?.substring(0, 8)}: ${eventName.replace("task_", "")}`

      if (eventName === "task_completed" && typedData?.output) {
        if (typeof typedData.output === "string") {
          taskSummary += ` - Output: "${typedData.output.substring(0, 50)}${typedData.output.length > 50 ? "..." : ""}"`
        } else if (typedData.output?.title) {
          taskSummary += ` - Output: Question "${typedData.output.title}"`
        } else if (Object.keys(typedData.output).length > 0) {
          taskSummary += ` - Output: (object)`
        }
      }

      if (eventName === "task_failed" && typedData?.error) {
        const errorMessage =
          typeof typedData.error === "string"
            ? typedData.error
            : JSON.stringify(typedData.error)
        taskSummary += ` - Error: ${errorMessage.substring(0, 100)}${errorMessage.length > 100 ? "..." : ""}`
      }
      return taskSummary
    }
    case "agent_complete":
      return `Agent processing complete. ${(data as any)?.resultPageGenerationPrompt ? "Result page prompt generated." : ""}`
    case "agent_error":
      return `Error: ${(data as any)?.message || (data as any)?.error || JSON.stringify(data)}`
    case "agent_end":
      return "Agent processing ended."
    case "db_forms_intermediate_save_warning":
    case "db_forms_final_save_error":
    case "sse_history_error":
    case "realtime_error":
      return `Warning/Error: ${(data as any)?.message || JSON.stringify(data)}`
    case "agent_warning":
      if (
        (data as any)?.details?.event_source ===
        "metadata_generator_journey_script"
      ) {
        return (data as any)?.message || "Form journey script generated"
      }
      return (
        (data as any)?.message ||
        `Warning: ${JSON.stringify((data as any)?.details || data)}`
      )
    case "question_schema_generated":
      return (
        (data as any)?.message ||
        `Generated schema for Q${(data as any)?.questionIndex + 1}/${(data as any)?.totalQuestions}: "${(data as any)?.questionTitle}"`
      )
    default:
      if (typeof data === "object" && Object.keys(data).length > 0) {
        return `Event data: ${Object.keys(data).slice(0, 3).join(", ")}${Object.keys(data).length > 3 ? "..." : ""}`
      }
      return JSON.stringify(data)
  }
}
