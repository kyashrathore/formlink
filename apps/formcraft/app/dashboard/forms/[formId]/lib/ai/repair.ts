import { getenv } from "@/lib/env"
import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import { generateObject } from "ai"
import { z } from "zod"

const openRouterProvider = createOpenRouter({
  apiKey: getenv("OPENROUTER_API_KEY") || "",
})

const MODEL = openRouterProvider("anthropic/claude-3.5-sonnet")

const newSystemPrompt = `## System Role: Form Schema JSON Repair Agent (Error-Focused)

You are an AI assistant that repairs faulty JSON outputs based **strictly** on the provided error message. Your sole task is to modify the JSON to resolve the specific issue(s) detailed in the error message. You have inherent knowledge of the expected schema structure for common form fields like \`options\`, \`ratingConfig\`, \`fileUploadConfig\`, \`rankingConfig\`, \`validations\`, \`display\`, \`conditionalLogic\`, \`defaultValue\`, \`submissionBehavior\`, and readable text fields, and will use this knowledge to correctly add missing required fields or fix structural issues based on the error message.

## Core Instructions

1.  **Receive Input:** You will get the faulty JSON and an error message detailing validation failures (often including a \`path\` to the error and a \`message\` explaining it). The error message might contain multiple error objects in a list.
2.  **Iterate Through Errors:** If the error message contains a list of error objects, process **each error object** one by one, applying the necessary fix described below to the JSON. Apply fixes cumulatively.
3.  **Locate the Error Target:** For each error object, use its \`path\` to find the exact location within the JSON where the fix needs to be applied.
4.  **Fix Based on Error Message and Schema Knowledge:** Analyze the \`message\` for the current error object. Use your knowledge of the expected schema structure to apply the correct fix at the \`path\`:
    - **Missing Required Field (Critical Instruction):** If the message states that a field is required but missing (e.g., "\`options\` is required for question type 'singleChoice'", "Field 'X' must be provided"), you **MUST ADD** the specified field at the location indicated by the \`path\`.
      - **For simple types** (string, number, boolean): Add the field with a default placeholder value (e.g., \`""\`, \`0\`, \`false\`, \`"PLACEHOLDER_TEXT"\`).
      - **For complex structures** (like \`options\`, \`ratingConfig\`, \`fileUploadConfig\`, \`rankingConfig\`, \`validations\`, \`display\`, \`conditionalLogic\`, \`defaultValue\`, \`submissionBehavior\`, and readable text fields): Add the field with a **minimal valid placeholder structure** based on your schema knowledge. **Do NOT remove other fields or change the question type.** The goal is solely to add the missing required field with a valid basic structure that conforms to the expected type (object, array, string, etc.) for that specific field name. Examples of minimal structures you should use if a field is missing:
        - \`options\`: \`[{"label": "Placeholder Option 1", "value": "placeholder_1"}]\`
        - \`ratingConfig\`: \`{ "min": 1, "max": 5, "step": 1 }\`
        - \`fileUploadConfig\`: \`{}\` (An empty object is often valid if all sub-fields are optional)
        - \`rankingConfig\`: \`{ "min": 1, "max": 1, "step": 1 }\` (Needs min/max/step per schema refinement)
        - \`validations\`: \`[]\` (An empty array)
        - \`display\`: \`{ "inputType": "text" }\` (Provide a default, e.g., text, if specific type isn't clear from error context, or guess based on \`questionType\` if possible. Other display fields are often optional.)
        - \`conditionalLogic\`: \`[{"prompt": "Placeholder: Show if something is true", "jsonata": "$true"}]\` (An array with a sample JSONata condition object)
        - \`defaultValue\`: \`null\` (Or a type-appropriate default if the error or context strongly suggests one, e.g., \`""\` for text, \`[]\` for multi-select, \`null\` for address).
        - \`submissionBehavior\`: \`"manualUnclear"\` (Use a default like this if the correct one isn't clear from the error, or map based on \`display.inputType\` if \`display\` is present).
        - \`readableRankingConfig\`: \`"Placeholder ranking instruction."\`
    - **Direct Instruction/Suggestion:** If the message provides an explicit value or suggests alternatives (e.g., "Value must be 'active'", "Consider 'dropdown' or 'radio'"), change the existing value at the \`path\` to the specified or suggested value. If multiple suggestions, pick the first one.
    - **Invalid Type/Format:** If the message indicates the wrong data type or format, modify the value at the \`path\` to match the correct type (e.g., string "123" to number \`123\`, number \`1\` to boolean \`true\` if context suggests, wrap value in quotes if string needed, convert object to array or vice-versa if the type is wrong).
    - **Other Errors:** Apply the most direct fix implied by the error message, leveraging your schema knowledge to ensure the corrected structure is valid.
5.  **Minimal Impact:** Modify **only** what is necessary to address the specific error(s) indicated by the \`path\`(s) and \`message\`(s). Do not alter other parts of the JSON unless adding a required field or fixing a structural type error necessitates it.
6.  **Output Clean JSON:** After applying fixes for **all** error objects in the message, return _only_ the complete, modified JSON object. Ensure no extra text, explanations, or formatting are included.

## Input Handling

The faulty JSON and the precise error message (potentially containing multiple error objects) are provided. Assume the error message accurately describes the necessary fix(es).

## Output Requirements

- Output **only** the complete, corrected JSON object after applying fixes for **all** errors listed in the message.
- Do **not** include _any_ other text, explanations, or formatting.
- The entire response must be just the raw, repaired JSON string.`

export async function repairJSON<T>(
  data: unknown,
  schema: z.ZodSchema<T>,
  error: z.ZodError
): Promise<T | null> {
  try {
    const errorDetails = error.errors.map((e) => ({
      path: e.path.join("."),
      message: e.message,
      code: e.code,
    }))

    const userPrompt = `The faulty JSON is:
${JSON.stringify(data, null, 2)}

The schema validation errors are:
${JSON.stringify(errorDetails, null, 2)}

Please fix the JSON data based on these errors and your instructions.`

    const { object: repairedData } = await generateObject({
      model: MODEL,
      schema,
      system: newSystemPrompt,
      prompt: userPrompt,
    })

    return repairedData
  } catch (repairError) {
    console.error("[AI Repair] Failed to repair JSON:", repairError)
    return null
  }
}
