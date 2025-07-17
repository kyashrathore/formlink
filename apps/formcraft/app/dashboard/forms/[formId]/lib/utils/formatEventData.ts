export function formatEventData(eventName: string, data: any): string {
  if (data === null || data === undefined) {
    return "No data"
  }

  switch (eventName) {
    case "sse_stream_init":
    case "realtime_subscribed":
      return data?.message || JSON.stringify(data)
    case "agent_init":
      return `Input: "${data?.input}", User: ${data?.userId?.substring(0, 8)}, Type: ${data?.inputType}`
    case "agent_start":
      return `Input: "${data?.input}", User: ${data?.userId?.substring(0, 8)}, Type: ${data?.inputType}`
    case "agent_state_update": {
      let summary = []
      if (data?.current_step) summary.push(`Step: ${data.current_step}`)
      else if (data?._last_completed_node)
        summary.push(`Last Node: ${data._last_completed_node}`)
      if (data?.formMetadata?.title)
        summary.push(`Form: "${data.formMetadata.title}"`)
      if (data?.tasksToPersist)
        summary.push(`Tasks: ${data.tasksToPersist.length}`)
      if (data?.generatedQuestionSchemas)
        summary.push(`Questions: ${data.generatedQuestionSchemas.length}`)
      if (data?.journeyScript)
        summary.push("Journey script with strategy generated")
      if (data?.resultPageGenerationPrompt)
        summary.push("Result page prompt generated")
      if (summary.length === 0) return "State updated (see details)"
      return summary.join(", ")
    }
    case "task_started":
    case "task_failed":
    case "task_completed": {
      // Base message from the event data itself
      let taskSummary =
        data?.message ||
        `Task ${data?.taskId?.substring(0, 8)}: ${eventName.replace("task_", "")}`

      // Append specific details for completed tasks with output
      if (eventName === "task_completed" && data?.output) {
        if (typeof data.output === "string") {
          taskSummary += ` - Output: "${data.output.substring(0, 50)}${data.output.length > 50 ? "..." : ""}"`
        } else if (data.output?.title) {
          taskSummary += ` - Output: Question "${data.output.title}"`
        } else if (Object.keys(data.output).length > 0) {
          taskSummary += ` - Output: (object)`
        }
      }
      // Append error details for failed tasks
      if (eventName === "task_failed" && data?.error) {
        const errorMessage =
          typeof data.error === "string"
            ? data.error
            : JSON.stringify(data.error)
        taskSummary += ` - Error: ${errorMessage.substring(0, 100)}${errorMessage.length > 100 ? "..." : ""}`
      }
      return taskSummary
    }
    case "agent_complete":
      return `Agent processing complete. ${data?.resultPageGenerationPrompt ? "Result page prompt generated." : ""}`
    case "agent_error":
      return `Error: ${data?.message || data?.error || JSON.stringify(data)}`
    case "agent_end":
      return "Agent processing ended."
    case "db_forms_intermediate_save_warning":
    case "db_forms_final_save_error":
    case "sse_history_error":
    case "realtime_error":
      return `Warning/Error: ${data?.message || JSON.stringify(data)}`
    case "agent_warning":
      // Special handling for specific event sources
      if (data?.details?.event_source === "metadata_generator_journey_script") {
        return data?.message || "Form journey script generated"
      }
      return (
        data?.message || `Warning: ${JSON.stringify(data?.details || data)}`
      )
    case "question_schema_generated":
      return (
        data?.message ||
        `Generated schema for Q${data?.questionIndex + 1}/${data?.totalQuestions}: "${data?.questionTitle}"`
      )
    default:
      // For unhandled event types, return a summarized JSON or a specific message
      if (typeof data === "object" && Object.keys(data).length > 0) {
        return `Event data: ${Object.keys(data).slice(0, 3).join(", ")}${Object.keys(data).length > 3 ? "..." : ""}`
      }
      return JSON.stringify(data)
  }
}
