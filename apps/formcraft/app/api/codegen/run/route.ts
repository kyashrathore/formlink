import { executeClaudeInSandbox } from "@/app/lib/codegen/agents/claude"
import { executeCodexInSandbox } from "@/app/lib/codegen/agents/codex"
import { buildFormBranchName } from "@/app/lib/codegen/generation/branch"
import { buildCommitMessage } from "@/app/lib/codegen/generation/commit"
import { runCommandInSandbox } from "@/app/lib/codegen/sandbox/commands"
import { validateEnvironmentVariables } from "@/app/lib/codegen/sandbox/config"
import { createSandbox } from "@/app/lib/codegen/sandbox/creation"
import {
  pushChangesToBranch,
  shutdownSandbox,
} from "@/app/lib/codegen/sandbox/git"
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
  agent: z.enum(["claude", "codex"]).optional(),
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
  console.log("[codegen/run] route revision watermark", "2025-10-25T13:50:00Z")
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
      console.log("[codegen/run]", ...args)
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

  const repoUrl = providedRepoUrl || process.env.CODEGEN_GITHUB_REPO
  if (!repoUrl) {
    return new Response(
      JSON.stringify({ error: "CODEGEN_GITHUB_REPO is not configured" }),
      {
        status: 500,
      }
    )
  }

  const githubToken = process.env.CODEGEN_GITHUB_TOKEN
  const accountId = process.env.CF_ACCOUNT_ID
  const apiToken = process.env.CF_API_TOKEN
  const projectName = process.env.CF_PAGES_PROJECT
  const missingDeployConfig = !accountId || !apiToken || !projectName
  const skipDeploy =
    process.env.CODEGEN_SKIP_DEPLOY === "true" || missingDeployConfig

  if (!githubToken) {
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
      else if (event === "status") console.log("[codegen/run] status", payload)
      else if (debug) console.log("[codegen/run] emit", event, payload)
      if (!isClosed) {
        await writeSseEvent(writer, event, payload)
      }
    } catch (error) {
      console.error("[codegen/run] Failed to emit SSE event", event, error)
    }
  }

  const logger = new StreamLogger(taskId, emit)

  // Important: do not write to the stream before returning the Response.
  // We start the SSE handshake and orchestration asynchronously below.
  console.log("[codegen/run] Scheduling orchestration")
  ;(async () => {
    let sandbox: Sandbox | undefined
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
      console.log("[codegen/run] SSE connection established")

      // Preflight env validation (emit to SSE, do not return HTTP errors)
      const envValidation = validateEnvironmentVariables(agent, githubToken, {
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
        AI_GATEWAY_API_KEY: process.env.AI_GATEWAY_API_KEY,
        OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      })
      if (!envValidation.valid) {
        await emit("error", {
          code: "invalid_environment",
          message: envValidation.error,
        })
        await emit("complete", { success: false })
        return
      }

      console.log("[codegen/run] Starting orchestration")
      console.log("[codegen/run] Creating sandbox")
      const sandboxResult = await createSandbox(
        {
          taskId,
          repoUrl,
          githubToken,
          gitAuthorName: process.env.CODEGEN_GIT_AUTHOR_NAME || undefined,
          gitAuthorEmail: process.env.CODEGEN_GIT_AUTHOR_EMAIL || undefined,
          selectedAgent: agent,
          apiKeys: {
            ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
            AI_GATEWAY_API_KEY: process.env.AI_GATEWAY_API_KEY,
            OPENAI_API_KEY: process.env.OPENAI_API_KEY,
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
      const workingBranch = sandboxResult.branchName || branchName
      const sandboxPreviewDomain = sandboxResult.domain
      const sandboxId = sandbox.sandboxId
      console.log("[codegen/run] Sandbox ready", { sandboxId, workingBranch })
      // Expose the sandbox preview domain immediately so the UI can embed it
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
            await executeCodexInSandbox(sandbox, instruction, logger, undefined)
          : await executeClaudeInSandbox(sandbox, instruction, logger, model)
      console.log("[codegen/run] Agent result", agentResult)

      if (!agentResult.success) {
        dbg("Agent execution failed", agentResult.error)
        await emit("error", {
          code: "agent_failed",
          message: agentResult.error || "Code generation agent failed",
        })
        await emit("complete", { success: false, branchName: workingBranch })
        return
      }

      // Prevent no-op success: require real changes beyond sandbox prep (.gitignore)
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
      console.log("[codegen/run] Push result", pushResult)

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

      // Start vite preview server so sandbox domain serves the build immediately
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
        console.log("[codegen/run] Deploy complete", deployUrl)
      } else {
        await logger.updateStatus(
          "deploy_skipped",
          missingDeployConfig
            ? "Skipping Cloudflare deploy (credentials missing)"
            : "Skipping Cloudflare deploy (CODEGEN_SKIP_DEPLOY=true)"
        )
        console.log("[codegen/run] Deploy skipped")
      }

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
          console.log("[codegen/run] Failed to update forms table", updateError)
          // Downgrade to info to avoid alarming logs when columns are not yet migrated
          await logger.info(
            `Skipped form metadata update: ${updateError.message}`
          )
        }
      } catch (e: any) {
        await logger.info("Skipped form metadata update: migration not applied")
      }

      await emit("complete", {
        success: true,
        branchName: workingBranch,
        previewUrl: deployUrl,
        pushFailed: Boolean(pushResult.pushFailed),
      })
      console.log("[codegen/run] Task completed")
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unexpected error"
      console.error("[codegen/run] Unhandled error", error)
      await logger.error(message)
      await emit("error", { code: "unexpected_error", message })
      await emit("complete", { success: false })
    } finally {
      if (sandbox) {
        await shutdownSandbox(sandbox)
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
