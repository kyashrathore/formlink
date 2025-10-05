import { ChatToolContext } from "../types"
import { createFormTool } from "./create-form"
import { getFormContextTool } from "./get-form-context"
import {
  createResponseViewTool,
  updateResponseViewTool,
} from "./response-intelligence/index"
import { proposeLifecycleAutomationTool } from "./submission-automations/index"
import { updateFormTool } from "./update-form"

export function createChatTools(context: ChatToolContext) {
  return {
    createForm: createFormTool(context),
    updateForm: updateFormTool(context),
    getFormContext: getFormContextTool(context),
    createResponseView: createResponseViewTool(context),
    updateResponseView: updateResponseViewTool(context),
    proposeLifecycleAutomation: proposeLifecycleAutomationTool(context),
  }
}
