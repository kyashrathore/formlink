export type SupportedAgent = "claude" | "codex" | "gemini"

export function validateEnvironmentVariables(
  selectedAgent: SupportedAgent = "codex",
  githubToken?: string | null,
  apiKeys?: {
    OPENAI_API_KEY?: string
    ANTHROPIC_API_KEY?: string
    AI_GATEWAY_API_KEY?: string
    GEMINI_API_KEY?: string
  }
) {
  const errors: string[] = []

  // Check for required environment variables based on selected agent
  if (
    selectedAgent === "gemini" &&
    !apiKeys?.GEMINI_API_KEY &&
    !process.env.GEMINI_API_KEY
  ) {
    errors.push(
      "GEMINI_API_KEY is required for Gemini CLI. Please add your API key in your profile."
    )
  }

  // Check for required environment variables based on selected agent
  if (
    selectedAgent === "claude" &&
    !apiKeys?.ANTHROPIC_API_KEY &&
    !process.env.ANTHROPIC_API_KEY
  ) {
    errors.push(
      "ANTHROPIC_API_KEY is required for Claude CLI. Please add your API key in your profile."
    )
  }

  if (selectedAgent === "codex") {
    const hasGatewayKey =
      apiKeys?.AI_GATEWAY_API_KEY || process.env.AI_GATEWAY_API_KEY
    const hasOpenAIKey = apiKeys?.OPENAI_API_KEY || process.env.OPENAI_API_KEY
    if (!hasGatewayKey && !hasOpenAIKey) {
      errors.push(
        "AI_GATEWAY_API_KEY or OPENAI_API_KEY is required for Codex CLI."
      )
    }
  }

  // Check for GitHub token for private repositories
  // Use user's token if provided
  if (!githubToken && !process.env.CODEGEN_GITHUB_TOKEN) {
    errors.push("CODEGEN_GITHUB_TOKEN is required for repository access.")
  }

  if (!process.env.CODEGEN_GITHUB_REPO) {
    errors.push(
      "CODEGEN_GITHUB_REPO is required to locate the template repository."
    )
  }

  // Check for Vercel sandbox environment variables
  if (!process.env.SANDBOX_VERCEL_TEAM_ID) {
    errors.push("SANDBOX_VERCEL_TEAM_ID is required for sandbox creation")
  }

  if (!process.env.SANDBOX_VERCEL_PROJECT_ID) {
    errors.push("SANDBOX_VERCEL_PROJECT_ID is required for sandbox creation")
  }

  if (!process.env.SANDBOX_VERCEL_TOKEN && !process.env.VERCEL_OIDC_TOKEN) {
    errors.push(
      "SANDBOX_VERCEL_TOKEN (or VERCEL_OIDC_TOKEN) is required for sandbox creation"
    )
  }

  return {
    valid: errors.length === 0,
    error: errors.length > 0 ? errors.join(", ") : undefined,
  }
}

export function normalizeRepoUrl(repoUrl: string): string {
  if (!repoUrl) return repoUrl

  // Defensively trim whitespace/newlines; users often set envs with trailing spaces
  const trimmed = repoUrl.trim()

  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("git@")
  ) {
    return trimmed
  }

  try {
    const [owner, repo = ""] = trimmed.split("/")
    if (!owner || !repo) return repoUrl
    const cleanRepo = repo.endsWith(".git") ? repo : `${repo}.git`
    return `https://github.com/${owner}/${cleanRepo}`
  } catch {
    return trimmed
  }
}

export function getGitAuthHeader(
  githubToken?: string | null
): string | undefined {
  const token = githubToken || process.env.CODEGEN_GITHUB_TOKEN
  if (!token) return undefined
  const username = process.env.CODEGEN_GITHUB_USER || "x-access-token"
  // Use HTTP Basic for Git over HTTPS
  const basic = Buffer.from(`${username}:${token}`).toString("base64")
  return `Authorization: Basic ${basic}`
}

export function createSandboxConfiguration(config: {
  repoUrl: string
  timeout?: string
  ports?: number[]
  runtime?: string
  resources?: { vcpus?: number }
  branchName?: string
}) {
  return {
    template: "node",
    git: {
      url: config.repoUrl,
      branch: config.branchName || "main",
    },
    timeout: config.timeout || "20m",
    ports: config.ports || [3000],
    runtime: config.runtime || "node22",
    resources: config.resources || { vcpus: 4 },
  }
}
