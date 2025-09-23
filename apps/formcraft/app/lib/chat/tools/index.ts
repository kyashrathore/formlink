import { ChatToolContext } from "../types"
import { createFormTool } from "./create-form"
import { getFormContextTool } from "./get-form-context"
import { responseIntelligenceTool } from "./response-intelligence/index"
import { updateFormTool } from "./update-form"

export function createChatTools(context: ChatToolContext) {
  return {
    createForm: createFormTool(context),
    updateForm: updateFormTool(context),
    getFormContext: getFormContextTool(context),
    responseIntelligence: responseIntelligenceTool(context),
  }
}
