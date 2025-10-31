interface TitleOptions {
  formTitle?: string | null
  agent?: "claude" | "codex"
}

export function buildRunTitle(options: TitleOptions = {}): string {
  const { formTitle, agent } = options
  const base = formTitle ? `Generate ${formTitle}` : "Generate form runtime"
  const agentSuffix = agent
    ? agent.charAt(0).toUpperCase() + agent.slice(1)
    : "Agent"
  return `${base} · ${agentSuffix}`
}
