import { ChatToolContext } from "../types"
import { createFormTool } from "./create-form"
import { getFormContextTool } from "./get-form-context"
import { updateFormTool } from "./update-form"

export function createChatTools(context: ChatToolContext) {
  return {
    createFormAgent: createFormTool(context),
    updateForm: updateFormTool(context),
    getFormContext: getFormContextTool(context),
  }
}
