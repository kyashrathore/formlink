# The Definitive Architecture Guide: Formlink System

This document provides a deep, technical dive into the Formlink architecture, specifically the `formcraft` (editor) and `formfiller` (responder) applications. It is intended for engineers and replaces any previous high-level summaries with a detailed, practical guide for understanding the system and implementing new features like the "Classic Form" mode.

## 1. Core Principles

Two core principles underpin the entire system:

1.  **Schema as the Single Source of Truth**: The entire platform revolves around the Zod schemas defined in `packages/schema`. This ensures type safety and data consistency from the database, through the backend, to the frontend UI components. All features must first be described within this schema.
2.  **Monorepo with Clear Separation of Concerns**: The `pnpm` monorepo separates the system into distinct `apps` and shared `packages`. This allows for code reuse (especially for `schema`, `db`, and `ui`) while keeping the complex logic of the editor (`formcraft`) separate from the user-facing responder (`formfiller`).

## 2. `packages/schema`: The Heart of the System

The `QuestionSchema` is a **discriminated union** based on the `questionType` field. This is the most important concept to grasp. It means a "Question" object will have different properties depending on its type, and TypeScript can enforce this, preventing many potential bugs.

### Schema Analysis

| `questionType`   | Allowed `display.inputType`       | Key Properties | Purpose                        |
| :--------------- | :-------------------------------- | :------------- | :----------------------------- |
| `singleChoice`   | `radio`, `dropdown`               | `options`      | For single-answer questions.   |
| `multipleChoice` | `checkbox`, `multiSelectDropdown` | `options`      | For multiple-answer questions. |
| `text`           | `text`, `textarea`, `email`, etc. | `validations`  | For freeform text input.       |
| `rating`         | `star`                            | `ratingConfig` | For star-based ratings.        |
| `ranking`        | `rankOrder`                       | `options`      | For drag-and-drop ranking.     |
| ...              | ...                               | ...            | ...                            |

### Advantages

- **Type Safety**: The discriminated union is extremely powerful. When you check `if (question.questionType === 'singleChoice')`, TypeScript automatically knows that `question.options` is a valid property.
- **Centralized Logic**: All possible question variations are defined in one place.

### Limitations & Weaknesses

- **Conversational Focus**: The schema is designed for one-at-a-time interactions. The primary text field is `title` (e.g., "What is your name?"), which is a conversational prompt, not a concise `label` (e.g., "Full Name"). This is a major blocker for a classic form layout.
- **No Layout System**: The schema has no concept of a visual layout. It cannot describe that two questions should appear side-by-side using a responsive grid system. This makes a professional-looking classic form impossible without schema evolution.
- **Complex Conditional Logic**: The `conditionalLogic` field uses `jsonata`, a powerful but niche query language. While flexible, it can be difficult to debug and is not easily human-readable. This will be superseded by our new AI-directed branching model.

## 3. `formcraft`: How the AI _Really_ Works

The AI in `formcraft` is not a simple chatbot. It's a **tool-using agent** that operates in a structured, transactional manner.

### The AI Agent's Workflow

Here is the step-by-step process when a user types "add a question for their email":

1.  **User Prompt**: The prompt is sent to the AI model.
2.  **Tool Selection**: The AI, guided by its `system-prompt.ts`, determines that it needs to modify the form. It chooses the `updateForm` tool.
3.  **Parameter Generation**: The AI constructs the parameters for the `updateForm` tool. It will generate an `updates` object like this:
    ```json
    {
      "questions": [{
        "action": "add",
        "questionData": {
          "type": "question",
          "questionType": "text",
          "display": { "inputType": "email" },
          "title": "What is your email address?",
          ...
        }
      }]
    }
    ```
4.  **Tool Execution (`update-form.ts`)**: The application code receives this tool call. It does **not** blindly trust the AI. It invokes the `updateFormAgent`.
5.  **The `updateFormAgent` Transaction (`simple-agent.ts`)**: This is the core of the operation. It's a stateful, multi-step process:
    a. **Fetch Current State**: It first queries the database for the _current draft version_ of the form.
    b. **Apply Updates**: It applies the `updates` from the AI to the fetched form data in memory.
    c. **Repair and Validate**: It runs `repairQuestionInputTypes` to fix any inconsistencies and then validates the _entire, new form object_ against the `FullFormSchema`. This is a critical safety check.
    d. **Create New Version**: If validation passes, it **inserts a new row** into the `form_versions` table. It does **not** modify the existing version. This creates an immutable history.
    e. **Update Pointer**: It then **updates the `current_draft_version_id`** in the main `forms` table to point to this new version.
    f. **Stream Events**: Throughout this process, it yields `AgentEvent`s back to the UI, allowing the frontend to show the progress and final state.

This is not a "hack." It is a robust, transactional, and versioned system that uses the AI for intent recognition and data generation, while the application code handles the critical tasks of validation and state persistence.

## 4. `formfiller`: From Schema to Pixels

`formfiller` renders the form based on the schema produced by `formcraft`. It has two primary modes:

### The `typeform` Mode (`TypeFormView.tsx`)

This mode presents one question at a time.

- **State Machine**: The entire view is controlled by a single state variable: `activeQuestionIndex`.
  - ` -1`: Renders the `IntroScreen`.
  - `0` to `questions.length - 1`: Renders the `TypeFormQuestion` for the question at that index.
  - `questions.length`: Renders the `CompletionScreen`.
- **Rendering**: The `TypeFormQuestion` component receives a single `question` object and is responsible for rendering the correct UI. It contains a `switch` statement that maps `question.questionType` to the appropriate input component from `@formlink/ui`.
- **Auto-Advance**: A key UX feature is auto-advancing on certain question types. For `singleChoice`, `rating`, etc., the view automatically navigates to the next question after a 300ms delay, creating a smooth, conversational flow.

### The `chat` Mode (`FormAIComponent.tsx`)

This mode is fundamentally different. The AI drives the interaction.

- **AI-Driven Questions**: The frontend sends user messages to the backend. The AI, using its `askQuestion` tool, sends a question object back to the frontend _as part of a tool invocation in the chat history_.
- **Separate State**: The `FormAIComponent` listens for these tool calls. When it sees an `askQuestion` tool, it extracts the question data and adds it to a separate Zustand store, `useChatStore`.
- **Rendering**: The `Conversation.tsx` component renders the chat history. The `Message` component within it is responsible for checking if a message contains a question and rendering the appropriate UI for it.

## 5. The Path Forward: Implementing Classic Mode

This deep understanding provides a clear and robust path for implementing the "Classic Form" mode.

1.  **Evolve the Schema (`packages/schema/src/index.ts`)**:
    - This is the first and most critical step. Add `label`, `page`, `styling`, and `isCheckpoint` fields to the `BaseQuestionSchema`. This is now clearly justified by the limitations of the current schema for building multi-question, grid-based layouts. The `isCheckpoint` flag is the foundation for our AI-directed branching, which is detailed in the [**AI Branching Implementation Guide**](./implementation-guide-ai-branching.md).

2.  **Update the Editor (`formcraft`)**:
    - **Add a "Mode" Toggle**: In the editor UI, add a control to switch the form's `defaultMode` setting between `"typeform"`, `"chat"`, and our new `"classic"` mode.
    - **Add Layout Properties UI**: In the question properties panel, add new inputs that appear when in "classic" mode. These will control the new `label`, `page`, and `styling` (e.g., column span) properties, writing the changes to the `useFormEditorStore`.

3.  **Implement the Classic View in `formfiller`)**:
    - **Update `FormModeContext.tsx`**: Add `"classic"` as a valid `AppFormMode`.
    - **Create `ClassicFormView.tsx`**: This will be the root component for the new mode.
      - **Use `react-hook-form`**: This is the correct tool for a form with multiple fields on one page. It will handle state, validation, and submission efficiently.
      - **Generate Validation Schema**: Write a utility function that takes the array of `questions` and dynamically generates a Zod schema that `react-hook-form` can use for validation.
      - **Render with CSS Grid**: The view will render a `<form>` element with `display: grid` (e.g., a 12-column grid). It will map over the questions for the current `page`.
      - **Positioning**: It will use the `question.styling.colSpan` property to apply a `grid-column: span <value>` style to each question's container, allowing for responsive, flexible layouts.
    - **Connect to `FormPageClient.tsx`**: Use the `isClassicMode` flag to render the new `<ClassicFormView />`, passing it the required props from the `useAppFormStore`.
