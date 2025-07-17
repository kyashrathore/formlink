import { tool } from "ai"
import { QueryDocsSchema } from "../../types/chat"
import { TOOL_DESCRIPTIONS } from "../prompts"
import { ChatToolContext, QueryDocsResult } from "../types"

const commonQuestions = {
  integrations:
    "FormCraft supports various integrations including Slack notifications, webhook endpoints, email notifications, and custom API integrations. You can configure these in the form settings.",
  "question types":
    "FormCraft supports multiple question types: text input, multiple choice, single choice, rating scales, linear scales, file uploads, date pickers, address fields, and ranking questions.",
  "form sharing":
    "You can share forms via direct links, embed them in websites, or integrate them into your applications using our API.",
  "data export":
    "Form responses can be exported in various formats including CSV, JSON, and Excel. You can also access data via our REST API.",
  customization:
    "Forms can be customized with themes, custom CSS, conditional logic, validation rules, and custom result pages.",
}

export function queryDocsTool(context: ChatToolContext) {
  return tool({
    description: TOOL_DESCRIPTIONS.queryDocs,
    parameters: QueryDocsSchema,
    execute: async ({
      query,
      context: queryContext,
    }): Promise<QueryDocsResult> => {
      const lowerQuery = query.toLowerCase()
      let response = "I'd be happy to help with that! "

      for (const [topic, answer] of Object.entries(commonQuestions)) {
        if (lowerQuery.includes(topic)) {
          response += answer
          break
        }
      }

      if (response === "I'd be happy to help with that! ") {
        response +=
          "Could you be more specific about what you'd like to know about FormCraft? I can help with questions about form creation, integrations, question types, sharing options, and more."
      }

      return {
        success: true,
        answer: response,
        query,
        context: queryContext,
      }
    },
  })
}
