import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import {
  convertToModelMessages,
  createUIMessageStream,
  stepCountIs,
  streamText,
} from "ai";
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

  // Use AI SDK's built-in converter to handle UIMessages properly
  const modelMessages = convertToModelMessages(messages);

  // Create UI message stream with proper format
  return createUIMessageStream({
    async execute({ writer }) {
      // Stream the AI response
      const result = await streamText({
        model,
        system: systemPrompt,
        messages: modelMessages,
        tools,
        toolChoice: "auto",
        stopWhen: stepCountIs(12),
        onFinish: async ({ toolCalls }) => {
          // Track tool usage
          toolCalls?.forEach((call) => {
            trackServerEvent("tool.usage", {
              toolName: call.toolName,
              formId: formSchema.id,
            });
          });

          const duration = Date.now() - startTime;
          trackServerEvent("api.form_assist.duration", {
            duration,
            formId: formSchema.id,
            toolCallCount: toolCalls?.length || 0,
          });
        },
      });

      // Merge the streamText result as UI message stream
      writer.merge(result.toUIMessageStream());
    },
    onError: (error) => {
      console.error("Stream error:", error);
      return `Error: ${error instanceof Error ? error.message : "Unknown error"}`;
    },
    originalMessages: messages,
    onFinish: async ({ messages }) => {
      try {
        // Save the assistant message with proper parts format
        const assistantMessage = messages[messages.length - 1];
        if (assistantMessage && assistantMessage.role === "assistant") {
          await saveSubmissionMessage(submissionId, assistantMessage, userId);
        }
      } catch (finishError) {
        console.error("Error in onFinish callback:", finishError);
      }
    },
  });
}
