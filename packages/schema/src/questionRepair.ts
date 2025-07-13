import { Question, InputType, Option, SubmissionBehavior } from "./index"; // Assuming Question is exported from index.ts

// Helper type to ensure structure for repair
// We use `any` for questions input to be robust before full Zod parsing
interface RepairableQuestion {
  id: string;
  questionType: string;
  display: {
    inputType: InputType | string; // Allow string initially for robustness
    // other display properties
  };
  options?: Option[];
  submissionBehavior?: SubmissionBehavior | string; // Allow string for robustness before full parsing
  // other question properties
}

/**
 * Repairs input type and submission behavior for questions to conform to schema rules.
 * - Ensures inputType is valid for questionType.
 * - Repairs inputType based on options count for choice questions.
 * - Ensures submissionBehavior matches inputType.
 *
 * @param questions An array of question objects (potentially unvalidated).
 * @returns The array of question objects with input types and submission behaviors repaired.
 */
export function repairQuestionInputTypes(questions: any[]): any[] {
  if (!Array.isArray(questions)) {
    console.warn(
      "repairQuestionInputTypes: input was not an array, returning as is."
    );
    return questions;
  }

  // Allowed input types per question type
  const allowedInputTypesMap: Record<string, string[]> = {
    multipleChoice: ["checkbox", "multiSelectDropdown"],
    singleChoice: ["radio", "dropdown"],
    text: [
      "text",
      "textarea",
      "email",
      "url",
      "tel",
      "number",
      "password",
      "country",
    ],
    date: ["date", "dateRange"],
    rating: ["star"],
    linearScale: ["linearScale"],
    address: ["addressBlock"],
    ranking: ["rankOrder"],
    fileUpload: ["file"],
  };

  // Expected submission behavior per input type
  const expectedBehavior: Record<string, string> = {
    radio: "autoAnswer",
    dropdown: "autoAnswer",
    date: "autoAnswer",
    dateRange: "autoAnswer",
    star: "autoAnswer",
    linearScale: "autoAnswer",
    file: "autoAnswer",

    checkbox: "manualAnswer",
    multiSelectDropdown: "manualAnswer",
    addressBlock: "manualAnswer",
    rankOrder: "manualAnswer",

    email: "manualUnclear",
    url: "manualUnclear",
    number: "manualUnclear",
    tel: "manualUnclear",
    textarea: "manualUnclear",
    text: "manualUnclear",
    password: "manualUnclear",
    country: "manualUnclear",
  };

  return questions.map((question) => {
    if (!question || typeof question !== "object") {
      return question; // Not a valid question object
    }

    let modifiedQuestion = { ...question } as RepairableQuestion;
    let hasBeenModified = false;

    const qType = modifiedQuestion.questionType;
    const display = modifiedQuestion.display;
    let inputType = display?.inputType;
    let optionsCount = Array.isArray(modifiedQuestion.options)
      ? modifiedQuestion.options.length
      : undefined;

    // 1. Repair inputType if not allowed for questionType
    if (
      qType &&
      display &&
      typeof inputType === "string" &&
      allowedInputTypesMap[qType]
    ) {
      const allowed = allowedInputTypesMap[qType];
      if (!allowed.includes(inputType)) {
        // Pick a default allowed inputType
        let newInputType: string | null = null;
        if (qType === "multipleChoice") {
          // Prefer multiSelectDropdown if options >= 4, else checkbox
          if (optionsCount !== undefined && optionsCount >= 4) {
            newInputType = "multiSelectDropdown";
          } else {
            newInputType = "checkbox";
          }
        } else if (qType === "singleChoice") {
          // Prefer dropdown if options >= 4, else radio
          if (optionsCount !== undefined && optionsCount >= 4) {
            newInputType = "dropdown";
          } else {
            newInputType = "radio";
          }
        } else {
          // Fallback to first allowed inputType
          newInputType = allowed[0];
        }
        if (newInputType && newInputType !== inputType) {
          modifiedQuestion.display = {
            ...modifiedQuestion.display,
            inputType: newInputType,
          };
          inputType = newInputType;
          hasBeenModified = true;
        }
      }
    }

    // 2. Repair inputType based on options count for choice questions (after above fix)
    if (
      (qType === "multipleChoice" || qType === "singleChoice") &&
      display &&
      typeof inputType === "string" &&
      optionsCount !== undefined
    ) {
      let newInputType: string | null = null;
      if (qType === "multipleChoice") {
        if (inputType === "checkbox" && optionsCount >= 4) {
          newInputType = "multiSelectDropdown";
        } else if (inputType === "multiSelectDropdown" && optionsCount < 4) {
          newInputType = "checkbox";
        }
      } else if (qType === "singleChoice") {
        if (inputType === "radio" && optionsCount >= 4) {
          newInputType = "dropdown";
        } else if (inputType === "dropdown" && optionsCount < 4) {
          newInputType = "radio";
        }
      }
      if (newInputType && newInputType !== inputType) {
        modifiedQuestion.display = {
          ...modifiedQuestion.display,
          inputType: newInputType,
        };
        inputType = newInputType;
        hasBeenModified = true;
      }
    }

    // 3. Repair submissionBehavior to match inputType
    if (
      display &&
      typeof inputType === "string" &&
      expectedBehavior[inputType] &&
      modifiedQuestion.submissionBehavior !== expectedBehavior[inputType]
    ) {
      const newSubmissionBehavior = expectedBehavior[inputType];
      modifiedQuestion.submissionBehavior = newSubmissionBehavior;
      hasBeenModified = true;
    }

    // 4. Special case: addressBlock manualUnclear -> manualAnswer (legacy)
    if (
      display &&
      inputType === "addressBlock" &&
      question.submissionBehavior === "manualUnclear"
    ) {
      const newSubmissionBehavior = "manualAnswer";
      if (modifiedQuestion.submissionBehavior !== newSubmissionBehavior) {
        modifiedQuestion.submissionBehavior = newSubmissionBehavior;
        hasBeenModified = true;
      }
    }

    return hasBeenModified ? modifiedQuestion : question;
  });
}
