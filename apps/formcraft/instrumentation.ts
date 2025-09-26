import { initLogger } from "braintrust"

// Next.js instrumentation entry. Runs on the server at startup.
export async function register() {
  if (!process.env.BRAINTRUST_API_KEY) return
  initLogger({
    projectName: process.env.BRAINTRUST_PROJECT_NAME || "formcraft",
    apiKey: process.env.BRAINTRUST_API_KEY,
  })
}
