import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { stepCountIs, streamText } from "ai";
import { trackServerEvent } from "../utils";
import { saveSubmissionMessage } from "./submission";

export function createAIProvider(): any {
  const apiKey = process.env.OPENROUTER_API_KEY || "";
  if (!apiKey) {
    console.warn("OPENROUTER_API_KEY not found in environment");
    throw new Error("OpenRouter API key is required");
  }

  const provider = createOpenRouter({ apiKey });
  return provider("openai/gpt-4o");
}

export async function streamAIResponse(
  messages: any[],
  systemPrompt: string,
  tools: any,
  submissionId: string,
  formSchema: any,
  userId?: string,
  startTime = Date.now(),
) {
  const model = createAIProvider();

  const validMessages = messages
    .filter((msg: any) => msg && msg.role && msg.content)
    .map((msg: any) => {
      // Convert content to proper format for AI SDK v5
      let content = msg.content;

      // Convert content to string format for AI SDK v5
      if (Array.isArray(content)) {
        if (content.every((item) => typeof item === "string")) {
          // Array of strings: convert to comma-separated string
          content = content.join(", ");
        } else if (
          content.some(
            (item) =>
              item instanceof File ||
              (item && item.constructor && item.constructor.name === "File") ||
              (item &&
                typeof item === "object" &&
                "url" in item &&
                "name" in item),
          )
        ) {
          // Array containing files or file metadata: convert to file descriptions
          content = content
            .map((item) => {
              if (
                item instanceof File ||
                (item && item.constructor && item.constructor.name === "File")
              ) {
                return `Uploaded: ${item.name || "unknown"}`;
              } else if (
                item &&
                typeof item === "object" &&
                "url" in item &&
                "name" in item
              ) {
                return `Uploaded: ${item.name || "unknown"}`;
              }
              return String(item);
            })
            .join(", ");
        } else {
          // Array of other types: convert to comma-separated string
          content = content.map((item) => String(item)).join(", ");
        }
      } else if (typeof content === "number") {
        // Number: convert to string
        content = content.toString();
      } else if (typeof content === "boolean") {
        // Boolean: convert to string
        content = content.toString();
      } else if (
        typeof content === "object" &&
        content !== null &&
        !Array.isArray(content)
      ) {
        // Check if it's a File object or file metadata
        if (
          content instanceof File ||
          (content.constructor && content.constructor.name === "File")
        ) {
          // File object: convert to upload message
          content = `Uploaded: ${content.name || "unknown"}`;
        } else if (content && "url" in content && "name" in content) {
          // File metadata: convert to upload message
          content = `Uploaded: ${content.name || "unknown"}`;
        } else {
          // Other objects (like address): convert to JSON string
          content = JSON.stringify(content);
        }
      }

      return {
        ...msg,
        content,
      };
    });

  return streamText({
    model,
    system: systemPrompt,
    messages: validMessages,
    tools,
    toolChoice: "auto",
    stopWhen: stepCountIs(12),
    onFinish: async ({ text, toolCalls }) => {
      try {
        await saveSubmissionMessage(
          submissionId,
          { role: "assistant", content: text, id: Date.now().toString() },
          userId,
        );

        const duration = Date.now() - startTime;
        trackServerEvent("api.form_assist.duration", {
          duration,
          formId: formSchema.id,
          toolCallCount: toolCalls?.length || 0,
        });

        toolCalls?.forEach((call) => {
          trackServerEvent("tool.usage", {
            toolName: call.toolName,
            formId: formSchema.id,
          });
        });
      } catch (finishError) {
        console.error("Error in onFinish callback:", finishError);
      }
    },
  });
}
