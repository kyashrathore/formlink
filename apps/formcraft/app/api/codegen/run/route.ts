import { executeClaudeInSandbox } from "@/app/lib/codegen/agents/claude"
import { executeCodexInSandbox } from "@/app/lib/codegen/agents/codex"
import { executeGeminiInSandbox } from "@/app/lib/codegen/agents/gemini"
import { buildFormBranchName } from "@/app/lib/codegen/generation/branch"
import { buildCommitMessage } from "@/app/lib/codegen/generation/commit"
import { runCommandInSandbox } from "@/app/lib/codegen/sandbox/commands"
import { validateEnvironmentVariables } from "@/app/lib/codegen/sandbox/config"
import { createSandbox } from "@/app/lib/codegen/sandbox/creation"
import {
  pushChangesToBranch,
  shutdownSandbox,
} from "@/app/lib/codegen/sandbox/git"
import { LocalSandbox } from "@/app/lib/codegen/sandbox/local"
import { StreamLogger } from "@/app/lib/codegen/stream-logger"
import { deployWithWrangler } from "@/app/lib/deploy/cloudflare"
import { authErrorResponse, requireAuth } from "@/app/lib/middleware/auth"
import { verifyUserOwnsForm } from "@/app/lib/middleware/authorization"
import { createServerClient, type Database } from "@formlink/db"
import type { Sandbox } from "@vercel/sandbox"
import { nanoid } from "nanoid"
import { cookies } from "next/headers"
import { NextRequest } from "next/server"
import { z } from "zod"

// Force Node runtime + dynamic streaming for reliable console logs and SSE
export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

const requestSchema = z.object({
  formId: z.string(),
  instruction: z.string().min(1),
  repoUrl: z.string().optional(),
  baseBranch: z.string().optional(),
  branchName: z.string().optional(),
  agent: z.enum(["claude", "codex", "gemini"]).optional(),
  model: z.string().optional(),
  keepAlive: z.boolean().optional(),
  maxDuration: z.number().positive().optional(),
})

const encoder = new TextEncoder()

async function writeSseEvent(
  writer: WritableStreamDefaultWriter<Uint8Array>,
  event: string,
  payload: unknown
) {
  await writer.write(encoder.encode(`event: ${event}\n`))
  await writer.write(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`))
}

export async function POST(request: NextRequest) {
  // Watermark this route build to verify hot reloads
  // Watermark this route build to verify hot reloads
  // console.warn("[codegen/run] route revision watermark", "2025-12-17T15:00:00Z")
  let authResult
  try {
    authResult = await requireAuth(request)
  } catch (error) {
    return authErrorResponse({
      name: "AuthError",
      message: error instanceof Error ? error.message : "Authentication failed",
      statusCode: 401,
    })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON payload" }), {
      status: 400,
    })
  }

  const parsed = requestSchema.safeParse(body)
  if (!parsed.success) {
    return new Response(
      JSON.stringify({
        error: "Invalid request payload",
        details: parsed.error.flatten(),
      }),
      { status: 400 }
    )
  }

  const {
    formId,
    instruction,
    repoUrl: providedRepoUrl,
    baseBranch: providedBaseBranch,
    branchName: requestedBranch,
    agent = "codex",
    model,
    keepAlive = false,
    maxDuration,
  } = parsed.data

  const debug = process.env.CODEGEN_DEBUG === "true"
  const dbg = (...args: unknown[]) => {
    if (debug) {
      console.warn("[codegen/run]", ...args)
    }
  }

  dbg("Received request", { formId, agent, keepAlive, maxDuration })

  const ownership = await verifyUserOwnsForm(formId, authResult.user.id)

  if (!ownership.formExists) {
    return new Response(JSON.stringify({ error: "Form not found" }), {
      status: 404,
    })
  }

  if (!ownership.isOwner) {
    return new Response(
      JSON.stringify({ error: "Unauthorized to run code generation" }),
      {
        status: 403,
      }
    )
  }

  // Configuration checks skip if local (implicitly, but better to keep them for now)
  const repoUrl = providedRepoUrl || process.env.CODEGEN_GITHUB_REPO

  // In development, we might not have github token set if we use local git identity
  const githubToken = process.env.CODEGEN_GITHUB_TOKEN
  const accountId = process.env.CF_ACCOUNT_ID
  const apiToken = process.env.CF_API_TOKEN
  const projectName = process.env.CF_PAGES_PROJECT
  const missingDeployConfig = !accountId || !apiToken || !projectName
  const skipDeploy =
    process.env.CODEGEN_SKIP_DEPLOY === "true" || missingDeployConfig

  if (!githubToken && process.env.NODE_ENV !== "development") {
    // Only require token in prod
    return new Response(
      JSON.stringify({ error: "CODEGEN_GITHUB_TOKEN is not configured" }),
      {
        status: 500,
      }
    )
  }

  if (!skipDeploy && missingDeployConfig) {
    return new Response(
      JSON.stringify({
        error:
          "Cloudflare Pages credentials (CF_ACCOUNT_ID, CF_API_TOKEN, CF_PAGES_PROJECT) are required",
      }),
      { status: 500 }
    )
  }

  const taskId = nanoid()
  const branchName = buildFormBranchName(formId, requestedBranch)
  const baseBranch = providedBaseBranch || "main"

  const cookieStore = await cookies()
  const supabase = await createServerClient(cookieStore)
  dbg("Supabase client created")

  const stream = new TransformStream()
  const writer = stream.writable.getWriter()
  // Heartbeat to keep SSE alive across proxies
  let heartbeat: ReturnType<typeof setInterval> | undefined
  let isClosed = false
  const safeClose = async () => {
    if (isClosed) return
    isClosed = true
    try {
      if (heartbeat) clearInterval(heartbeat)
    } catch {}
    try {
      await writer.close()
    } catch {}
  }

  const emit = async (event: string, payload: unknown) => {
    try {
      // Always mirror critical events to server console for debugging
      if (event === "error") console.error("[codegen/run] error", payload)
      else if (event === "status") console.warn("[codegen/run] status", payload)
      else if (debug) console.warn("[codegen/run] emit", event, payload)
      if (!isClosed) {
        await writeSseEvent(writer, event, payload)
      }
    } catch (error) {
      console.error("[codegen/run] Failed to emit SSE event", event, error)
    }
  }

  const logger = new StreamLogger(taskId, emit)

  // Determine if we are running in LOCAL DEV MODE
  const isLocalDev =
    process.env.NODE_ENV === "development" &&
    process.env.CODEGEN_USE_LOCAL_SANDBOX !== "false"

  // Important: do not write to the stream before returning the Response.
  console.warn("[codegen/run] Scheduling orchestration", { isLocalDev })
  ;(async () => {
    let sandbox: Sandbox | any | undefined
    try {
      // Kick off SSE after the Response is returned
      await writer.write(encoder.encode(":ok\n\n"))
      await writeSseEvent(writer, "status", {
        status: "received",
        message: "SSE connection established",
      })
      heartbeat = setInterval(() => {
        if (!isClosed) {
          writer.write(encoder.encode(":hb\n\n")).catch(() => {})
        }
      }, 5000)
      console.warn("[codegen/run] SSE connection established")

      let workingBranch = branchName
      let sandboxPreviewDomain: string | undefined

      if (isLocalDev) {
        // --- LOCAL DEV PATH ---
        console.warn("[codegen/run] Using LocalSandbox adapter")
        // In local mode, we skip: GitHub Clone, Sandbox Create, Branch Checkout (assume user is on branch)
        // We just wrap the local folder

        sandbox = new LocalSandbox() // Defaults to ../../apps/preview
        await emit("status", {
          status: "sandbox_ready",
          message: "Using local development environment",
        })

        // Assume preview is running locally
        sandboxPreviewDomain = "http://localhost:5173"
        await emit("preview", { url: sandboxPreviewDomain, sandboxId: "local" })

        // Execute Agent
        const agentResult =
          agent === "codex"
            ? await executeCodexInSandbox(
                sandbox,
                instruction,
                logger,
                undefined
              )
            : agent === "gemini"
              ? await executeGeminiInSandbox(
                  sandbox,
                  instruction,
                  logger,
                  model
                )
              : await executeClaudeInSandbox(
                  sandbox,
                  instruction,
                  logger,
                  model
                )

        console.warn("[codegen/run] Local Agent result", agentResult)

        if (!agentResult.success) {
          await emit("error", {
            code: "agent_failed",
            message: agentResult.error || "Local agent execution failed",
          })
          await emit("complete", { success: false })
          return
        }

        // In local dev, we don't necessarily need to commit/push/deploy automatically.
        // The user sees changes via HMR.
        await emit("complete", {
          success: true,
          branchName: "local",
          previewUrl: sandboxPreviewDomain,
          pushFailed: false,
          duration: agentResult.duration,
        })
        return
      } else {
        // --- PROD/CLOUD PATH (Vercel Sandbox) ---

        // Preflight env validation
        const envValidation = validateEnvironmentVariables(agent, githubToken, {
          ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
          AI_GATEWAY_API_KEY: process.env.AI_GATEWAY_API_KEY,
          OPENAI_API_KEY: process.env.OPENAI_API_KEY,
          GEMINI_API_KEY: process.env.GEMINI_API_KEY,
        })
        if (!envValidation.valid) {
          await emit("error", {
            code: "invalid_environment",
            message: envValidation.error,
          })
          await emit("complete", { success: false })
          return
        }

        console.warn("[codegen/run] Creating cloud sandbox")
        const sandboxResult = await createSandbox(
          {
            taskId,
            repoUrl: repoUrl!,
            githubToken,
            gitAuthorName: process.env.CODEGEN_GIT_AUTHOR_NAME || undefined,
            gitAuthorEmail: process.env.CODEGEN_GIT_AUTHOR_EMAIL || undefined,
            selectedAgent: agent,
            apiKeys: {
              ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
              AI_GATEWAY_API_KEY: process.env.AI_GATEWAY_API_KEY,
              OPENAI_API_KEY: process.env.OPENAI_API_KEY,
              GEMINI_API_KEY: process.env.GEMINI_API_KEY,
            },
            timeout: maxDuration ? `${maxDuration}m` : undefined,
            keepAlive,
            baseBranch,
            preDeterminedBranchName: branchName,
            ports: [5173],
            onProgress: async (progress, message) =>
              logger.updateProgress(progress, message),
          },
          logger
        )

        if (!sandboxResult.success || !sandboxResult.sandbox) {
          dbg("Sandbox creation failed", sandboxResult.error)
          await emit("error", {
            code: "sandbox_creation_failed",
            message: sandboxResult.error || "Failed to create sandbox",
          })
          await emit("complete", { success: false, branchName })
          return
        }

        sandbox = sandboxResult.sandbox
        workingBranch = sandboxResult.branchName || branchName
        sandboxPreviewDomain = sandboxResult.domain
        const sandboxId = sandbox.sandboxId
        console.warn("[codegen/run] Sandbox ready", {
          sandboxId,
          workingBranch,
        })

        if (sandboxPreviewDomain) {
          const sandboxUrl = sandboxPreviewDomain.startsWith("http")
            ? sandboxPreviewDomain
            : `https://${sandboxPreviewDomain}`
          await emit("preview", { url: sandboxUrl, sandboxId })
          // Best-effort: persist sandbox preview URL so Preview tab shows it even after refresh
          try {
            const { error: earlyUpdateError } = await supabase
              .from("forms")
              .update({ preview_url: sandboxUrl, sandbox_id: sandboxId })
              .eq("id", formId)
            if (earlyUpdateError) {
              await logger.info(
                `Skipped early preview_url persist: ${earlyUpdateError.message}`
              )
            }
          } catch {}
        }

        const agentResult =
          agent === "codex"
            ? // Force Codex to use its own model (gpt-5-codex). Ignore incoming model.
              await executeCodexInSandbox(
                sandbox,
                instruction,
                logger,
                undefined
              )
            : agent === "gemini"
              ? await executeGeminiInSandbox(
                  sandbox,
                  instruction,
                  logger,
                  model
                )
              : await executeClaudeInSandbox(
                  sandbox,
                  instruction,
                  logger,
                  model
                )

        console.warn("[codegen/run] Agent result", agentResult)

        if (!agentResult.success) {
          dbg("Agent execution failed", agentResult.error)
          await emit("error", {
            code: "agent_failed",
            message: agentResult.error || "Code generation agent failed",
          })
          await emit("complete", { success: false, branchName: workingBranch })
          return
        }

        if (!agentResult.changesDetected) {
          await emit("error", {
            code: "no_changes",
            message:
              "Code generation produced no changes. Adjust the prompt and try again.",
          })
          await emit("complete", { success: false, branchName: workingBranch })
          return
        }

        await logger.updateStatus("committing", "Committing generated changes")
        const commitMessage = buildCommitMessage({ formId })
        const pushResult = await pushChangesToBranch(
          sandbox,
          workingBranch,
          commitMessage,
          logger,
          githubToken
        )
        console.warn("[codegen/run] Push result", pushResult)

        await logger.logPushResult({
          branchName: workingBranch,
          success: !pushResult.pushFailed,
        })

        if (!pushResult.success) {
          dbg("Push failed", pushResult)
          await emit("error", {
            code: "git_push_failed",
            message: pushResult.pushFailed
              ? "Local commit succeeded but push to GitHub failed"
              : "Failed to commit generated changes",
          })
          await emit("complete", { success: false, branchName: workingBranch })
          return
        }

        await logger.updateStatus("building", "Running bun build")
        const bunCommand =
          'export BUN_INSTALL="$HOME/.bun"; export PATH="$BUN_INSTALL/bin:$PATH"; bun run build'
        const buildResult = await runCommandInSandbox(sandbox, "sh", [
          "-lc",
          bunCommand,
        ])

        if (!buildResult.success) {
          await emit("error", {
            code: "build_failed",
            message: buildResult.error || "Build step failed",
          })
          await emit("complete", { success: false, branchName: workingBranch })
          return
        }

        // Start vite preview in background
        if (sandboxPreviewDomain) {
          const startPreview =
            'export BUN_INSTALL=\"$HOME/.bun\"; export PATH=\"$BUN_INSTALL/bin:$PATH\"; nohup bunx vite preview --host 0.0.0.0 --port 5173 >/tmp/preview.log 2>&1 & echo $! > /tmp/preview.pid'
          await runCommandInSandbox(sandbox, "sh", ["-lc", startPreview])
          await emit("preview", { url: sandboxPreviewDomain, sandboxId })
        }

        let deployUrl: string | undefined
        if (!skipDeploy) {
          dbg("Starting Cloudflare deploy")
          const deployResult = await deployWithWrangler({
            sandbox,
            logger,
            branchName: workingBranch,
            projectName: projectName!,
            accountId: accountId!,
            apiToken: apiToken!,
          })
          deployUrl = deployResult.url
          console.warn("[codegen/run] Deploy complete", deployUrl)
        } else {
          await logger.updateStatus(
            "deploy_skipped",
            missingDeployConfig
              ? "Skipping Cloudflare deploy (credentials missing)"
              : "Skipping Cloudflare deploy (CODEGEN_SKIP_DEPLOY=true)"
          )
          console.warn("[codegen/run] Deploy skipped")
        }

        // DB Update Logic (Identical to before)
        const updatePayload: Database["public"]["Tables"]["forms"]["Update"] & {
          sandbox_id?: string | null
        } = {
          branch_name: workingBranch,
          last_deployed_at: new Date().toISOString(),
        }

        if (deployUrl) {
          updatePayload.preview_url = deployUrl
        } else if (sandboxPreviewDomain) {
          const sandboxUrl = sandboxPreviewDomain.startsWith("http")
            ? sandboxPreviewDomain
            : `https://${sandboxPreviewDomain}`
          updatePayload.preview_url = sandboxUrl
        }

        if (!("sandbox_id" in updatePayload)) {
          ;(updatePayload as any).sandbox_id = sandboxId
        }

        try {
          const { error: updateError } = await supabase
            .from("forms")
            .update(updatePayload)
            .eq("id", formId)
          if (updateError) {
            console.warn(
              "[codegen/run] Failed to update forms table",
              updateError
            )
            // Downgrade to info to avoid alarming logs when columns are not yet migrated
            await logger.info(
              `Skipped form metadata update: ${updateError.message}`
            )
          }
        } catch (e: any) {
          await logger.info(
            "Skipped form metadata update: migration not applied"
          )
        }

        await emit("complete", {
          success: true,
          branchName: workingBranch,
          previewUrl: deployUrl,
          pushFailed: Boolean(pushResult.pushFailed),
          duration: agentResult.duration,
        })
      } // End Else (Cloud Mode)

      console.warn("[codegen/run] Task completed")
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unexpected error"
      console.error("[codegen/run] Unhandled error", error)
      await logger.error(message)
      await emit("error", { code: "unexpected_error", message })
      await emit("complete", { success: false })
    } finally {
      if (sandbox && typeof sandbox.close === "function") {
        // LocalSandbox doesn't need close, but mapped Vercel sandbox might
        // shutdownSandbox expects Vercel Sandbox type, might need checking
        if (!isLocalDev) {
          await shutdownSandbox(sandbox)
        }
      }
      dbg("Closing writer")
      await safeClose()
    }
  })().catch(async (error) => {
    console.error("[codegen/run] Stream error", error)
    const message = error instanceof Error ? error.message : "Stream error"
    await emit("error", { code: "stream_error", message })
    await emit("complete", { success: false })
    await safeClose()
  })

  return new Response(stream.readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  })
}
