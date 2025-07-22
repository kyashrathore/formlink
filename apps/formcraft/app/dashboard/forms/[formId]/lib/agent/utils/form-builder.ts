import { Form, Question, QuestionSchema } from "@formlink/schema"
import { v4 as uuidv4 } from "uuid"
import { AgentState } from "../state"

export function buildFormFromState(agentState: AgentState): Form {
  // Ensure generatedQuestionSchemas are valid Questions.
  // This might involve parsing or validating if they are not already in the correct format.
  // For now, we assume they are mostly compatible but might need ID and questionNo.
  const questions: Question[] = (agentState.generatedQuestionSchemas || []).map(
    (qSchema: any, index: number) => {
      // Attempt to validate each question schema if necessary, or ensure it conforms to Question type
      // This is a simplified mapping; a more robust one might involve Zod parsing per question type
      const baseQuestion: Partial<Question> = {
        id: qSchema.id || uuidv4(),
        questionNo: qSchema.order !== undefined ? qSchema.order + 1 : index + 1, // Use order if available
        title: qSchema.title || `Question ${index + 1}`,
        description: qSchema.description || "",
        questionType: qSchema.questionType || "text", // Default to text
        validations: qSchema.validations || {},
        readableValidations: qSchema.readableValidations || [],
        display: qSchema.display || {
          inputType: "text",
          showTitle: true,
          showDescription: true,
        },
        options: qSchema.options || [],
        conditionalLogic: qSchema.conditionalLogic || {
          jsonata: "",
          prompt: "",
        },
        readableConditionalLogic: qSchema.readableConditionalLogic || [],
        submissionBehavior: qSchema.submissionBehavior || "manualUnclear", // Default from schema
        type: "question", // From schema
        ...qSchema, // Spread the rest of the properties from qSchema
      }
      // Ensure it fits the Question schema, this is a basic cast.
      // A more robust solution would be `QuestionSchema.parse(baseQuestion)` after ensuring all required fields.
      return baseQuestion as Question
    }
  )

  // Determine version_id. If a version is actively being worked on in AgentState, use that.
  // Otherwise, for a new snapshot, a new version_id might be appropriate.
  // The current AgentState doesn't explicitly track a "current working version_id".
  // For simplicity in this utility, we'll generate one if not obvious.
  // This logic might need to be more sophisticated based on how form versions are managed.
  const version_id = uuidv4() // Placeholder: always new for this snapshot utility

  // Check if this is a new form (no questions generated yet)
  const isNewForm =
    questions.length === 0 &&
    (!agentState.formMetadata?.title ||
      agentState.formMetadata.title === "Untitled Form")

  // Don't include journey script for new forms to prevent stale data
  const settings: any = {
    ...agentState.settings,
    resultPageGenerationPrompt: agentState.resultPageGenerationPrompt || "",
  }

  // Only include journey script if it's not a new form
  if (!isNewForm && agentState.journeyScript) {
    settings.journeyScript = agentState.journeyScript
  }

  return {
    id: agentState.formId,
    short_id: agentState.shortId,
    version_id: version_id,
    title: agentState.formMetadata?.title || "Untitled Form",
    description: agentState.formMetadata?.description || "",
    questions: questions,
    settings: settings,
  }
}
