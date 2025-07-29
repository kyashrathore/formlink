# Implementation Guide: AI-Directed Branching

This document provides a detailed, step-by-step technical guide for implementing the "AI-Directed Flow" feature, using the existing `journeyScript` as its foundation.

## 1. The Core Architecture

The architecture consists of three main components:

1.  **The Schema:** A single boolean flag, `isCheckpoint`, is added to the `Question` schema. This marks a question as a trigger for an AI decision.
2.  **The `journeyScript`:** A form-level, natural language script stored in `settings.journeyScript`. This is the "rulebook" or "director's script" that the AI uses to make branching decisions.
3.  **The `formfiller` Engine:** The frontend rendering logic that identifies checkpoints, calls the AI with the correct context, and navigates to the question indicated by the AI's response.

This is a simple, powerful, and UI-agnostic architecture that can be applied to any form rendering mode (`typeform`, `classic`, etc.).

---

## 2. Step-by-Step Implementation Plan

### **Part 1: Schema Modification (The Foundation)**

This is the first and simplest step.

**File to Modify:** `packages/schema/src/index.ts`

**Action:**
Add a single, optional boolean field to the `BaseQuestionSchema`.

```typescript
// In packages/schema/src/index.ts

const BaseQuestionSchema = z.object({
  type: z.literal("question").default("question"),
  id: z.string().min(1),
  questionNo: z.number(),
  title: z.string(),
  description: z.string().optional(),
  isCheckpoint: z.boolean().optional(), // <--- ADD THIS LINE

  validations: QuestionValidationsSchema.optional().default({}),
  // ... rest of the schema
});
```

**Result:** The schema can now describe which questions are AI decision points. This is a non-breaking change.

### **Part 2: The Authoring Experience (`formcraft`)**

We need to provide the user with the tools to create the branching logic.

**Sub-step 2.1: The Checkpoint Toggle**

- **File to Modify:** `apps/formcraft/app/dashboard/forms/[formId]/components/form/FormEditor/QuestionDetails/QuestionDetails.tsx`
- **Logic:** This component renders the properties panel for a selected question. We will add a new UI element to this panel.
- **Implementation:**
  1.  Add a `<Switch />` component from the `@formlink/ui` library.
  2.  Label it "Enable AI Decision Point" or "Make this a branching point."
  3.  The switch's `checked` state should be bound to the `selectedQuestion.isCheckpoint` property from the `useFormEditorStore`.
  4.  The `onCheckedChange` handler should call a store action (e.g., `updateQuestion(questionId, { isCheckpoint: newValue }))` to update the state.

**Sub-step 2.2: The Rulebook Editor**

- **File to Leverage:** `apps/formcraft/app/dashboard/forms/[formId]/components/form/FormJourneyStep.tsx`
- **Logic:** This component already exists and provides a text editor for the `settings.journeyScript`. Our task is to ensure it's presented correctly in the UI and that users understand its new role in branching.
- **Implementation:**
  1.  In the main editor layout (`apps/formcraft/app/dashboard/forms/[formId]/components/TabContentManager.tsx` or similar), ensure the "Journey" tab is clearly visible and perhaps renamed to "Journey & Branching."
  2.  Update the placeholder text or template within `FormJourneyStep.tsx` to guide the user on how to write branching rules. For example:
      > `<!--
      > This script guides the AI. To create branching, first mark a question as an "AI Decision Point".
      > Then, write the rules here. For example:
      >
      > ## Branching Logic
      >
      > - After the 'employment_status' question, if the user answers 'Fresher', the next question should be 'graduation_date'.
      > - If they answer 'Experienced', the next question should be 'job_experience'.
      >   -->`

**Sub-step 2.3: The AI Agent (`formcraft`)**

- **File to Modify:** The system prompt for the main form-creation AI agent (likely in `apps/formcraft/app/lib/chat/prompts/system-prompt.ts`).
- **Logic:** We need to teach the AI how to generate the `journeyScript` and set the `isCheckpoint` flags when a user asks for branching.
- **Implementation:**
  1.  Add instructions to the system prompt:
      > "To create branching logic, you must do two things. First, identify the question that will trigger the decision and set its `isCheckpoint` property to `true`. Second, you must add the branching rules to the `settings.journeyScript` field, clearly explaining the conditions and the ID of the question to jump to."

### **Part 3: The Rendering Engine (`formfiller`)**

This is the core runtime logic that executes the AI-directed flow.

- **File to Modify:** The main rendering component (e.g., `TypeFormView.tsx` for the typeform mode, or the new `ClassicFormView.tsx` for the classic mode).
- **Logic:** We need to create a stateful "director" that manages the flow.
- **Implementation:**
  1.  **State Management:** Introduce state variables to manage the flow:
      ```typescript
      const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
      const [isAiDeciding, setIsAiDeciding] = useState(false);
      const [answers, setAnswers] = useState({});
      ```
  2.  **The Navigation Function (`handleNext`)**: This function is called when the user clicks "Next" or auto-advances. This is where the main logic lives.

      ```typescript
      const handleNext = async () => {
        const currentQuestion = questions[currentQuestionIndex];
        // Store the latest answer
        // ...

        if (currentQuestion.isCheckpoint) {
          setIsAiDeciding(true); // Show a loading spinner in the UI

          try {
            // Make the API call to the backend
            const response = await fetch("/api/ai/next-question", {
              method: "POST",
              body: JSON.stringify({
                journeyScript: form.settings.journeyScript,
                answerHistory: answers,
              }),
            });
            const { nextQuestionId } = await response.json();

            // Find the index of the next question
            const nextIndex = questions.findIndex(
              (q) => q.id === nextQuestionId,
            );

            if (nextIndex !== -1) {
              setCurrentQuestionIndex(nextIndex); // Jump to the new question
            } else {
              // Handle error or end of form
            }
          } finally {
            setIsAiDeciding(false); // Hide the loading spinner
          }
        } else {
          // Default behavior: just go to the next question in the list
          setCurrentQuestionIndex(currentQuestionIndex + 1);
        }
      };
      ```

  3.  **The Backend API (`/api/ai/next-question`)**:
      - Create a new API route in `formfiller`.
      - This route will receive the `journeyScript` and the `answerHistory`.
      - It will construct a prompt for the AI, combining the `journeyScript` and the user's answers.
      - It will call the AI model and parse the response to extract the `nextQuestionId`.
      - It will return this ID to the frontend.

This architecture is robust, scalable, and provides a clear separation of concerns. The `formcraft` application is responsible for _authoring_ the logic, and the `formfiller` application is responsible for _executing_ it.
