# LLD & Migration Plan: Refactoring the Core Question Schema (Cutoff Strategy)

## 1. Executive Summary & Goal

**The Problem:** Our current `QuestionSchema` separates semantic intent (`questionType`) from presentation (`display.inputType`). This forces us to maintain a complex and brittle `superRefine` validation block to enforce the constraints between them.

**The Goal:** To refactor the `QuestionSchema` into a more robust, type-safe, and self-documenting structure. We will unify the type and display properties into a single, discriminated `type` object.

**The Strategy: Cutoff Migration.** We have determined that an incremental migration is not necessary. We will perform a direct, "big bang" refactoring. All required code changes will be made in a single feature branch and deployed at once. This is a faster and cleaner approach.

---

## 2. The "Target" Schema

This is the ideal state we will implement directly.

```typescript
// The new, unified type object (a discriminated union itself)
const QuestionTypeSchema = z.discriminatedUnion("name", [
  z.object({
    name: z.literal("text"),
    format: z
      .enum(["text", "textarea", "email", "url", "tel", "number", "password"])
      .optional(),
  }),
  z.object({
    name: z.enum(["singleChoice", "multipleChoice"]),
    display: z.enum(["radio", "checkbox", "dropdown", "multiSelectDropdown"]),
    options: z.array(OptionSchema),
  }),
  // ... other types for Rating, Date, etc.
]);

// The new, simplified QuestionSchema
export const QuestionSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  // ... other base properties like label, page, styling, isCheckpoint

  type: QuestionTypeSchema, // The new, unified property

  validations: QuestionationsSchema.optional(),
});
```

---

## 3. The Cutoff Implementation Plan

This is the master checklist for the refactoring effort. All steps must be completed within a single feature branch.

### **Step 1: The Schema "Break" (`packages/schema/src/index.ts`)**

This is the first action. It will intentionally cause TypeScript errors across the entire codebase, giving us a perfect to-do list.

1.  **Delete `questionType` and `display`** from the `BaseQuestionSchema`.
2.  **Add the new `type: QuestionTypeSchema`** property to the `BaseQuestionSchema`.
3.  **Delete the entire `.superRefine(...)` block** from the `QuestionSchema` definition. The validation it performed is now handled by the structure of the `QuestionTypeSchema` itself.

### **Step 2: The `formfiller` Refactor (The Renderer)**

This is a well-isolated and critical part of the work, perfect for our new engineer.

- **Primary Goal:** Fix all TypeScript errors in the `apps/formfiller` directory.
- **Key Files:** `TypeFormView.tsx`, `FormAIComponent.tsx`, and all their sub-components.
- **Core Change:** The logic will shift from reading `question.questionType` and `question.display` to reading from the new, unified `question.type` object.
  - `switch (question.questionType)` becomes `switch (question.type.name)`.
  - Accessing options for a choice question changes from `question.options` to `question.type.options`.
  - Determining the input type changes from `question.display.inputType` to `question.type.display` (for choice questions) or `question.type.format` (for text questions).

### **Step 3: The `formcraft` Refactor (The Editor)**

This is the most complex part of the refactor.

- **Primary Goal:** Fix all TypeScript errors in the `apps/formcraft` directory.
- **Key Files:** `useFormEditorStore.tsx`, `QuestionDetails.tsx`, and the AI agent/tool files.
- **Core Changes:**
  1.  **State Management (`useFormEditorStore`):** The actions for adding and updating questions must now construct the new, nested `type` object.
  2.  **UI (`QuestionDetails.tsx`):** The properties panel must be refactored to read from and write to the `question.type` object. The UI controls will change dynamically based on `question.type.name`.
  3.  **AI Agents & Prompts:** The system prompts must be updated to instruct the AI to generate the new schema. The Zod schemas that validate the AI's tool outputs must be updated to expect the new structure.

### **Step 4: The Database Migration Script**

This is a mandatory step that must be run during deployment.

- **Goal:** Convert all existing `form_versions` in the database to the new schema.
- **Task:**
  1.  Write a script that fetches all `form_versions`.
  2.  For each version, it will iterate through the `questions` array.
  3.  For each question, it will read the old `questionType` and `display` properties and use them to construct the new `type` object.
  4.  It will then remove the old properties and save the updated `questions` array back to the database.

---

## LLD for the New Engineer: Your Mission

Welcome! Your first mission is to lead the refactoring of our entire form rendering application, `formfiller`. By taking ownership of this critical piece of the project, you'll gain a deep understanding of our frontend architecture.

**Your Goal:** Resolve all TypeScript errors in the `apps/formfiller` directory after the schema changes from Step 1 are complete.

**Your Step-by-Step Guide:**

1.  **Get Started:** Once the new schema is pushed to the feature branch, pull the latest changes. You will immediately see a large number of TypeScript errors in `apps/formfiller`. This is expected.
2.  **The Core Task:** Your job is to fix them. The fundamental change you will be making is updating how our components access question properties.
    - **Old Way:** `question.questionType`, `question.display.inputType`, `question.options`
    - **New Way:** `question.type.name`, `question.type.display`, `question.type.options`
3.  **Where to Focus:**
    - Start with the components that render single questions, like `TypeFormQuestion.tsx` and the components used by `FormAIComponent.tsx`.
    - The main logic change will be in the `switch` statements that decide which UI component to render.
4.  **Testing:** We have a robust suite of tests for `formfiller`. As you fix the errors, run the tests continuously to ensure you haven't introduced any regressions. Your work is complete when all TypeScript errors are gone and all tests pass.

This is a challenging but highly rewarding first project. It's a real, impactful change that will significantly improve the quality of our codebase. Good luck!
