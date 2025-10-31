interface CommitMessageOptions {
  formId: string
  formTitle?: string | null
  context?: string
}

const MAX_LENGTH = 72

export function buildCommitMessage(options: CommitMessageOptions): string {
  const { formId, formTitle, context } = options

  const scope = formTitle ? slugifyTitle(formTitle) : formId
  const base = `feat(form-${scope}): update runtime`

  if (!context) {
    return truncate(base)
  }

  const contextualMessage = `${base} - ${context}`
  return truncate(contextualMessage)
}

function slugifyTitle(title: string): string {
  return (
    title
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 20) || "draft"
  )
}

function truncate(message: string): string {
  if (message.length <= MAX_LENGTH) {
    return message
  }
  return `${message.slice(0, MAX_LENGTH - 3)}...`
}
