import { ChatToolContext } from "../types"
import { createFormTool } from "./create-form"
import { generateCodeTool } from "./generate-code"
import { getFormContextTool } from "./get-form-context"
import {
  createResponseViewTool,
  updateResponseViewTool,
} from "./response-intelligence/index"
import { proposeLifecycleAutomationTool } from "./submission-automations/index"
import { updateFormTool } from "./update-form"

const CODEGEN_ENABLED = process.env.CODEGEN_PREVIEW_UI === "true"

export function createChatTools(context: ChatToolContext) {
  const baseTools = {
    updateForm: updateFormTool(context),
    getFormContext: getFormContextTool(context),
    createResponseView: createResponseViewTool(context),
    updateResponseView: updateResponseViewTool(context),
    proposeLifecycleAutomation: proposeLifecycleAutomationTool(context),
  }

  if (CODEGEN_ENABLED) {
    return {
      generateCode: generateCodeTool(context),
      ...baseTools,
    }
  }

  return {
    createForm: createFormTool(context),
    ...baseTools,
  }
}
