import { getAllowedComposioToolkits } from "@/app/lib/actions/catalog"
import { isComposioEnabled } from "@/app/lib/actions/composio-client"
import { CURATED_ACTIONS } from "@/app/lib/actions/registry"

export type ActionsPromptContext = {
  lines: string[]
  summary: {
    curatedActionCount: number
    composioEnabled: boolean
    allowedComposioToolkitCount: number
    usesendEnabled: boolean
    curatedActionSlugs: string[]
  }
}

export function buildActionsPromptContext(): ActionsPromptContext {
  const composioEnabled = isComposioEnabled()
  const allowedToolkits = composioEnabled ? getAllowedComposioToolkits() : []
  const allowedToolkitSlugs = allowedToolkits.map((toolkit) => toolkit.toolkit)

  const curatedActions = CURATED_ACTIONS.filter((action) => {
    if (action.provider === "composio") {
      if (!composioEnabled) return false
      if (!action.toolkit) return true
      return allowedToolkitSlugs.includes(action.toolkit)
    }
    return true
  })

  const lines = curatedActions.map((action) => {
    const description = action.description || action.label
    return `${action.slug}: ${description}`
  })

  const usesendEnabled = Boolean(process.env.USE_SEND_API_KEY)

  return {
    lines,
    summary: {
      curatedActionCount: curatedActions.length,
      composioEnabled,
      allowedComposioToolkitCount: allowedToolkitSlugs.length,
      usesendEnabled,
      curatedActionSlugs: curatedActions.map((action) => action.slug),
    },
  }
}
