import { Form, Question } from "@formlink/schema"
import { v4 as uuidv4 } from "uuid"
import { AgentState } from "../state"

export function buildFormFromState(agentState: AgentState): Form {
  const questions: Question[] = (agentState.generatedQuestionSchemas || []).map(
    (qSchema: any, index: number) => {
      const baseQuestion: Partial<Question> = {
        id: qSchema.id || uuidv4(),
        questionNo: qSchema.order !== undefined ? qSchema.order + 1 : index + 1,
        title: qSchema.title || `Question ${index + 1}`,
        description: qSchema.description || "",
        questionType: qSchema.questionType || "text",
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
        submissionBehavior: qSchema.submissionBehavior || "manualUnclear",
        type: "question",
        ...qSchema,
      }

      return baseQuestion as Question
    }
  )

  const version_id = uuidv4()

  const isNewForm =
    questions.length === 0 &&
    (!agentState.formMetadata?.title ||
      agentState.formMetadata.title === "Untitled Form")

  const settings: any = {
    ...agentState.settings,
    resultPageGenerationPrompt: agentState.resultPageGenerationPrompt || "",
  }

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
