import { ChatToolContext } from "../types"
import { createFormTool } from "./create-form"
import { getFormContextTool } from "./get-form-context"
import { queryDocsTool } from "./query-docs"
import { showConfigButtonTool } from "./show-config"
import { updateFormTool } from "./update-form"

export function createChatTools(context: ChatToolContext) {
  return {
    createFormAgent: createFormTool(context),
    updateForm: updateFormTool(context),
    queryDocs: queryDocsTool(context),
    showConfigButton: showConfigButtonTool(context),
    getFormContext: getFormContextTool(context),
  }
}
