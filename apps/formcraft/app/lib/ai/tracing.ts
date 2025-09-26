import * as ai from "ai"
import { initLogger, wrapAISDK } from "braintrust"

// Initialize Braintrust if API key is present. Safe to call multiple times.
if (process.env.BRAINTRUST_API_KEY) {
  initLogger({
    projectName: process.env.BRAINTRUST_PROJECT_NAME || "formcraft",
    apiKey: process.env.BRAINTRUST_API_KEY,
  })
}

// Wrap top-level AI SDK functions to enable automatic tracing.
const wrapped = wrapAISDK(ai)

export const generateObject = wrapped.generateObject
export const generateText = wrapped.generateText
export const streamText = wrapped.streamText
export const streamObject = wrapped.streamObject
