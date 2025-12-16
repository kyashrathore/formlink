import { promises as fs } from "node:fs"
import path from "node:path"
import type { ChatToolContext } from "@/app/lib/chat/types"
import { buildFormBranchName } from "@/app/lib/codegen/generation/branch"
import logger from "@/app/lib/logger"
import { SupabaseClient } from "@formlink/db"
import { tool } from "ai"
import { z } from "zod"
import { TOOL_DESCRIPTIONS } from "../prompts"

const GenerateCodeSchema = z.object({
  prompt: z.string().min(1).describe("User intent for code generation"),
  agent: z.enum(["claude", "codex", "gemini"]).optional(),
  model: z.string().optional(),
})

interface CodegenResult {
  success: boolean
  branchName?: string
  previewUrl?: string
  error?: string
  duration?: string
}

let cachedRuntimeSpec: string | null = null
let cachedRuntimeSpecPath: string | null = null

async function loadRuntimeSpec(): Promise<string> {
  if (cachedRuntimeSpec) {
    return cachedRuntimeSpec
  }

  const envOverride = process.env.CODEGEN_RUNTIME_SPEC_PATH
  const triedPaths: string[] = []

  const candidates: string[] = []
  if (envOverride) {
    candidates.push(path.resolve(envOverride))
  }

  // Prefer the Formcraft-scoped spec; keep root docs as a fallback
  const targetFormcraftRelative = path.join(
    "apps",
    "formcraft",
    "docs",
    "runtime",
    "formlink-runtime-spec_v1.md"
  )
  const targetRootRelative = path.join(
    "docs",
    "runtime",
    "formlink-runtime-spec_v1.md"
  )
  let currentDir = process.cwd()
  const rootDir = path.parse(currentDir).root

  for (let i = 0; i < 6; i++) {
    candidates.push(path.join(currentDir, targetFormcraftRelative))
    candidates.push(path.join(currentDir, targetRootRelative))
    if (currentDir === rootDir) {
      break
    }
    currentDir = path.dirname(currentDir)
  }

  for (const specPath of candidates) {
    try {
      cachedRuntimeSpec = await fs.readFile(specPath, "utf8")
      cachedRuntimeSpecPath = specPath
      return cachedRuntimeSpec
    } catch (error) {
      triedPaths.push(specPath)
      if (typeof logger.debug === "function") {
        logger.debug("[generateCode] Runtime spec candidate not found", {
          specPath,
        })
      }
    }
  }

  logger.warn(
    "[generateCode] Failed to load runtime spec, using fallback text",
    { triedPaths }
  )
  cachedRuntimeSpec =
    "Follow the latest Formlink runtime specification and ensure Bun + Vite build succeeds."
  return cachedRuntimeSpec
}

async function fetchFormSnapshot(supabase: SupabaseClient, formId: string) {
  const { data: formRow, error: formError } = await supabase
    .from("forms")
    .select("short_id, current_draft_version_id, current_published_version_id")
    .eq("id", formId)
    .single()

  if (formError || !formRow) {
    throw new Error(formError?.message || "Form not found")
  }

  const activeVersionId =
    formRow.current_draft_version_id || formRow.current_published_version_id

  if (!activeVersionId) {
    return {
      shortId: formRow.short_id,
      title: null,
      description: null,
      questions: [],
      settings: {},
    }
  }

  const { data: versionRow, error: versionError } = await supabase
    .from("form_versions")
    .select("title, description, questions, settings, status")
    .eq("version_id", activeVersionId)
    .single()

  if (versionError || !versionRow) {
    throw new Error(versionError?.message || "Form version not found")
  }

  return {
    shortId: formRow.short_id,
    title: extractText(versionRow.title),
    description: extractText(versionRow.description),
    questions: Array.isArray(versionRow.questions)
      ? (versionRow.questions as any[])
      : [],
    settings: versionRow.settings ?? {},
    status: versionRow.status,
  }
}

function extractText(value: unknown): string | null {
  if (typeof value === "string") return value
  if (value && typeof value === "object" && "text" in (value as any)) {
    const textValue = (value as any).text
    return typeof textValue === "string" ? textValue : null
  }
  return null
}

function summariseQuestions(questions: any[]): string {
  if (!questions.length) return "No questions defined yet."
  const summary = questions.slice(0, 10).map((question: any, index) => {
    const label =
      question?.title ?? question?.question ?? `Question ${index + 1}`
    const type = question?.type || question?.questionType || "unknown"
    return `- [${type}] ${String(label).slice(0, 80)}`
  })
  const truncated =
    questions.length > 10 ? "\n- (additional questions omitted)" : ""
  return summary.join("\n") + truncated
}

function resolveCodegenBaseUrl(): string {
  const raw =
    process.env.CODEGEN_API_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)

  const base = raw || "http://127.0.0.1:3000"
  return base.replace(/\/+$/, "")
}

function buildInstruction(params: {
  prompt: string
  formId: string
  branchName: string
  formContext: Awaited<ReturnType<typeof fetchFormSnapshot>>
  runtimeSpec: string
}): string {
  const { prompt, formId, branchName, formContext, runtimeSpec } = params
  const questionSummary = summariseQuestions(formContext.questions)

  return `You are the Formlink code generation agent.

Context:
- Form ID: ${formId}
- Form Short ID: ${formContext.shortId ?? "n/a"}
- Target Branch: ${branchName}
- Current Version Status: ${formContext.status ?? "unknown"}
- Form Title: ${formContext.title ?? "Untitled Form"}
- Form Description: ${formContext.description ?? "None"}
- Existing Questions:\n${questionSummary}

User Prompt:
${prompt}

Requirements:
1. Default to Bun + Vite. Detect package manager by lockfile if needed; prefer Bun, fallback to pnpm/yarn/npm.
2. Generate all form code in a single file under \\\`components/\\\`, named exactly \\\`[shortId].tsx\\\`.
3. Route path must be \\\`/f/[shortId]\\\`:
   - Next.js Pages Router: create \\\`pages/f/[shortId]/index.tsx\\\` that re-exports the default export from \\\`@/components/[shortId]\\\`.
   - Next.js App Router: create \\\`app/f/[shortId]/page.tsx\\\` that re-exports the default export from \\\`@/components/[shortId]\\\`.
   - Vite/SPA: in \\\`app.tsx\\\`, add a React Router route \\\`/f/:shortId\\\` rendering \\\`components/[shortId]\\\`.
4. Always wrap the page in \\\`<RuntimeProvider runtime={rt} showDevtools>\\\` (show devtools until publish). Do not offer non-provider variants or devtools modes.
5. Use \\\`@formlink/runtime/ui/react\\\` primitives only (no \\\`@formlink/ui\\\`). Map your design system via \\\`ShadCnProvider\\\` inline; do not create a wrapper component.
6. Import types from \\\`@formlink/runtime/schema\\\` (do not use \\\`@formlink/schema\\\`).
7. During draft, set transport to \\\`createMockTransport\\\` aliased as \\\`mockTransportInDraft\\\`; publish will swap server-side.
8. Run \\\`bun run build\\\` to verify the build; avoid unrelated repo config changes.

Runtime Specification:
${runtimeSpec}

Execution Rules (critical):
1. You must produce actual file changes in this repository. Use apply_patch blocks exclusively to add/modify files. Do not output plans without patches.
2. Keep edits minimal and focused on the prompt. Create missing folders as needed (e.g., src/components, app/f/[shortId]).
3. After writing files, ensure imports compile. Do not change unrelated config. Prefer Bun; if unavailable, fall back per Quickstart.
4. Do not commit or push; the host pipeline handles git. Your output should be only patches (and, if strictly necessary, short stdout logs of what you changed).
5. Never open browsers or use --open flags. Avoid interactive prompts.
`
}

type CodegenEventHandler = (event: string, data: any) => void

async function streamCodegen(options: {
  baseUrl: string
  body: Record<string, unknown>
  cookieHeader?: string
  onEvent?: CodegenEventHandler
}): Promise<CodegenResult> {
  const { baseUrl, body, cookieHeader, onEvent } = options

  // Fail-fast handshake timeout so the UI isn’t left hanging
  const controller = new AbortController()
  const handshakeMs = Number(
    process.env.NEXT_PUBLIC_CODEGEN_HANDSHAKE_MS || 30000
  )
  const handshakeTimer = setTimeout(() => controller.abort(), handshakeMs)

  const response = await fetch(`${baseUrl}/api/codegen/run`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cookieHeader ? { cookie: cookieHeader } : {}),
    },
    body: JSON.stringify(body),
    signal: controller.signal,
  })

  if (!response.ok) {
    const message = `Codegen API failed with status ${response.status}`
    return { success: false, error: message }
  }

  if (!response.body) {
    const message = "Codegen API response missing body stream"
    return { success: false, error: message }
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder("utf-8")
  let buffer = ""
  let result: CodegenResult = { success: false }
  let receivedAnyEvent = false

  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    let boundary = buffer.indexOf("\n\n")
    while (boundary !== -1) {
      const rawEvent = buffer.slice(0, boundary)
      buffer = buffer.slice(boundary + 2)
      boundary = buffer.indexOf("\n\n")

      if (!rawEvent.trim()) continue

      const { event, data } = parseSseMessage(rawEvent)
      receivedAnyEvent = true
      // First event received: clear the handshake abort
      if (receivedAnyEvent) {
        clearTimeout(handshakeTimer)
      }

      // Surface logs/status/progress to the chat UI data stream if provided
      try {
        onEvent?.(event, data)
      } catch {
        // best effort
      }

      if (event === "complete") {
        result = {
          success: Boolean(data?.success),
          branchName: data?.branchName,
          previewUrl: data?.previewUrl,
          duration: data?.duration,
        }
        // We can stop reading further — server will close shortly
        reader.cancel().catch(() => {})
        break
      }

      if (event === "error") {
        result = {
          success: false,
          error: data?.message || "Code generation error",
        }
        reader.cancel().catch(() => {})
        break
      }
    }
  }

  // If we aborted due to handshake timeout, return a descriptive error
  if (!receivedAnyEvent && controller.signal.aborted) {
    return {
      success: false,
      error: `No SSE events from /api/codegen/run within ${handshakeMs}ms (handshake timeout)`,
    }
  }

  return result
}

function parseSseMessage(raw: string): { event: string; data: any } {
  const lines = raw.split("\n")
  let event = "message"
  let dataPayload = ""
  for (const line of lines) {
    if (line.startsWith("event:")) {
      event = line.slice(6).trim()
    } else if (line.startsWith("data:")) {
      dataPayload += line.slice(5).trim()
    }
  }

  if (!dataPayload) return { event, data: null }

  try {
    return { event, data: JSON.parse(dataPayload) }
  } catch {
    return { event, data: { raw: dataPayload } }
  }
}

export function generateCodeTool(context: ChatToolContext) {
  return tool({
    description: TOOL_DESCRIPTIONS.generateCode,
    inputSchema: GenerateCodeSchema,
    execute: async ({ prompt, agent, model }) => {
      const { formId, supabase, cookieHeader, options, dataStream } = context

      try {
        const formSnapshot = await fetchFormSnapshot(supabase, formId)
        const runtimeSpec = await loadRuntimeSpec()
        if (cachedRuntimeSpecPath && typeof logger.info === "function") {
          logger.info("[generateCode] Loaded runtime spec", {
            path: cachedRuntimeSpecPath,
          })
        }
        const branchName = buildFormBranchName(formId)
        const instruction = buildInstruction({
          prompt,
          formId,
          branchName,
          formContext: formSnapshot,
          runtimeSpec,
        })

        const baseUrl = resolveCodegenBaseUrl()
        const agentToUse = agent || (options as any)?.agent || "gemini"
        const payload: Record<string, unknown> = {
          formId,
          instruction,
          branchName,
          agent: agentToUse,
        }
        // Do not propagate UI model into Codex runs; Codex must use gpt-5-codex.
        if (agentToUse !== "codex") {
          const uiModel = model || (options as any)?.model
          if (uiModel) payload.model = uiModel
        }

        const result = await streamCodegen({
          baseUrl,
          body: payload,
          cookieHeader,
          onEvent: (event, data) => {
            // Ignore heartbeat/default 'message' events and null payloads
            if (event === "message" || data == null) return
            // Forward as generic AI SDK data event to avoid schema errors
            // Shape: { type: 'data', value: [{ eventName: 'codegen', eventType: string, data: any }] }
            try {
              dataStream.write({
                type: "data-codegen",
                data: [
                  {
                    eventName: "codegen",
                    eventType: String(event),
                    data: data ?? null,
                  },
                ],
              })
            } catch {}
          },
        })

        if (!result.success) {
          return {
            success: false,
            message: result.error || "Code generation failed",
          }
        }

        return {
          success: true,
          branchName: result.branchName,
          previewUrl: result.previewUrl,
          message: "Code generation completed",
          duration: result.duration,
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        logger.error("[generateCode] Tool execution failed", {
          formId,
          error: message,
        })
        return {
          success: false,
          message,
        }
      }
    },
  })
}
