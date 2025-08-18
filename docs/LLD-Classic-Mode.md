# LLD: Building "Classic Mode" & AI Branching

Welcome to the team! We're excited to have you on board. Your first project is a fantastic one: building the new "Classic Mode" for our forms. This feature will allow users to create traditional, multi-question forms with powerful, grid-based layouts and AI-driven branching.

This document is your primary guide. It contains a detailed, step-by-step plan for building this feature end-to-end. For a higher-level overview of the entire system, please first read the [**Definitive Architecture Guide**](./architecture-deep-dive.md).

## Phase 1: The Foundation - Evolving the Schema

Everything in our system starts with the schema. Our first step is to teach our `FormSchema` how to describe a classic form's layout and branching logic.

**Your Task:**
Modify the `BaseQuestionSchema` in `packages/schema/src/index.ts`.

**Code to Add:**

```typescript
// In packages/schema/src/index.ts, find the BaseQuestionSchema

// Add these new optional properties
const BaseQuestionSchema = z.object({
  // ... all existing properties
  label: z.string().optional(),
  page: z.number().int().optional(),
  styling: z
    .object({
      colSpan: z.number().int().min(1).max(12).optional(),
    })
    .optional(),
  isCheckpoint: z.boolean().optional(),
  // ... rest of the schema
});
```

**Property Breakdown:**

- `label`: For concise field labels (e.g., "First Name") instead of the conversational `title`.
- `page`: A simple number to group questions into multi-step pages.
- `styling.colSpan`: The number of columns (out of 12) a question should occupy. This is the key to our responsive grid layout.
- `isCheckpoint`: A simple boolean that marks a question as the trigger for an AI branching decision. For full details on how this works, see the [**AI Branching Implementation Guide**](./implementation-guide-ai-branching.md).

---

## Phase 2: The Authoring Experience in `formcraft`

Now, let's give our users the tools to build classic forms.

### 2.1 The Mode Switcher

**Goal:** Allow a user to designate a form as "Classic".

**File to Edit:** `apps/formcraft/app/dashboard/forms/[formId]/components/form/FormModeControls.tsx`

**Your Task:**

1.  Find the existing UI control that switches between "Typeform" and "Chat".
2.  Add a new option for "Classic".
3.  When clicked, this should call the `updateSettingField` function (from the `useFormEditorStore`) to set `settings.defaultMode` to `"classic"`.

### 2.2 The Properties Panel

**Goal:** Allow users to configure the new layout and branching properties for each question.

**File to Edit:** `apps/formcraft/app/dashboard/forms/[formId]/components/form/FormEditor/QuestionDetails/QuestionDetails.tsx`

**Your Task:**

1.  In this component, find where it renders the properties for a selected question.
2.  Add a new section that **only renders if `form.settings.defaultMode === 'classic'`**.
3.  Inside this new section, add the following input controls:
    - A text input for the `label`.
    - A number input for the `page` number.
    - A number input (or a slider from 1 to 12) for the `styling.colSpan`.
    - A `<Switch />` control for the `isCheckpoint` boolean.
4.  Connect each of these inputs to the `useFormEditorStore`. When an input changes, it should call the appropriate store action to update the property on the currently selected question.

### 2.3 Teaching the AI

**Goal:** Make the AI aware of the new layout and branching capabilities.

**File to Edit:** `apps/formcraft/app/lib/prompts.ts` (or a similar central prompt file).

**Your Task:**

1.  Find the main system prompt for the form-building AI.
2.  Add instructions teaching it how to use the new properties. For example:
    > "When a user asks for layout changes like 'put two fields in one row', you must use the `styling.colSpan` property. A standard row has 12 columns. To put two fields side-by-side, give each one a `colSpan` of 6. To create branching logic, set `isCheckpoint: true` on the question that should trigger the decision, and then define the rules in the `settings.journeyScript`."

---

## Phase 3: The Rendering Engine in `formfiller` (Detailed Guide)

This is where we'll build the new Classic Mode experience from the ground up. This phase is the most complex, so we'll follow the `shadcn/ui` form patterns closely to ensure a robust and maintainable implementation.

### 3.1 The Mode Context

**Goal:** Make the `formfiller` app aware of the new "classic" mode.

**File to Edit:** `apps/formfiller/contexts/FormModeContext.tsx`

**Your Task:**

1.  Add `"classic"` to the `AppFormMode` type definition.
2.  Add a new `isClassicMode` boolean to the `useFormMode` hook.

### 3.2 The `ClassicFormView` Component (The Core)

**Goal:** Create the main component that will render our classic forms.

**File to Create:** `apps/formfiller/components/classic/ClassicFormView.tsx`

**Your Task:** This component is the orchestrator.

1.  **State and Hooks:**
    - Use `const [currentPage, setCurrentPage] = useState(1)` for multi-step logic.
    - Filter the `formSchema.questions` to get only the questions for the `currentPage`.
2.  **Form Initialization (The `shadcn` Pattern):**
    - **Dynamic Schema:** Create a utility function, `generateZodSchema(questionsOnPage)`, that builds a Zod schema from the current page's questions.
    - **`useForm` Hook:** Initialize `react-hook-form`:

      ```typescript
      import { useForm } from "react-hook-form";
      import { zodResolver } from "@hookform/resolvers/zod";

      const form = useForm({
        resolver: zodResolver(generateZodSchema(questionsOnPage)),
        defaultValues: generateDefaultValues(questionsOnPage), // Another utility
      });
      ```

3.  **Component Structure:**
    - The component will return a `<Form {...form}>` provider component from `shadcn/ui`.
    - Inside, it will have a `<form onSubmit={form.handleSubmit(onSubmit)}>`.
    - The main content area will be a `div` with our 12-column grid styles.
    - You will map over the `questionsOnPage` and render a `<ClassicFormField />` for each one, passing the `form.control` and the `question` object as props.
    - Finally, render the navigation buttons ("Next", "Previous", "Submit").

### 3.3 The `ClassicFormField` Component (The Workhorse)

**Goal:** Create a single, intelligent component that can render _any_ type of question from our schema.

**File to Create:** `apps/formfiller/components/classic/ClassicFormField.tsx`

**Your Task:** This component adapts our schema to the `shadcn/ui` form components.

1.  **Props:** It will accept `control: Control` and `question: Question`.
2.  **Structure:** It will be a `FormField` component from `shadcn/ui`.

    ```typescript
    import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@formlink/ui"; // Assuming these are in our UI lib

    return (
      <div style={{ gridColumn: `span ${question.styling?.colSpan || 12}` }}>
        <FormField
          control={control}
          name={question.id}
          render={({ field }) => (
            <FormItem>
              <FormLabel>{question.label || question.title}</FormLabel>
              <FormControl>
                {/* The magic happens here */}
                <QuestionInputSwitcher question={question} field={field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    );
    ```

3.  **The `QuestionInputSwitcher`:**
    - This will be a new component that contains the core rendering logic.
    - It will use a `switch` statement on `question.type.name`.
    - For each question type, it will render the corresponding component from our `@formlink/ui` library, passing the `field` props (`onChange`, `value`, `onBlur`, etc.) to it.

### 3.3.1 The Component Mapping (Comprehensive Guide)

This is the most critical part of the implementation. The `QuestionInputSwitcher` component must correctly map the question type from our schema to the right component in our `@formlink/ui` library.

Here is the comprehensive mapping you should build.

| `question.type.name`                        | `question.type` property for subtype | `@formlink/ui` Component            | `react-hook-form` Integration Notes                                                                                                                                                                                          |
| :------------------------------------------ | :----------------------------------- | :---------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `text`                                      | `format`                             | `<Input />`                         | The `field` object can be spread directly: `<Input type={question.type.format} {...field} />`. Handle `textarea` as a separate case.                                                                                              |
| `singleChoice`                              | `display`                            | `<RadioGroup />` or `<Select />`    | Use a switch on `question.type.display`. For `radio`, use `onValueChange={field.onChange}`. For `dropdown`, map `question.type.options` to render `<SelectItem />`.                                                              |
| `multipleChoice`                            | `display`                            | `<Checkbox />` or `<Select />`      | For `checkbox`, you will need to manage the array state. For `multiSelectDropdown`, use the `Select` components from `shadcn/ui` but manage the array state. The `field.value` will be an array of strings.                     |
| `date`                                      | `format`                             | `<DatePicker />` or `<DateRangePicker />` | Use a switch on `question.type.format`. Our UI library should have custom components that wrap `shadcn/ui`. Use `selected={field.value}` and `onSelect={field.onChange}`.                                                      |
| `rating`                                    | `config`                             | `<StarRating />`                    | A custom component. Use `onValueChange={field.onChange}` and `value={field.value}`. The `config` object will provide min/max values.                                                                                             |
| `linearScale`                               | `config`                             | `<Slider />`                        | The `field` object can likely be passed directly. The `config` object will provide start/end/step values.                                                                                                                    |
| `fileUpload`                                | -                                    | `<FileInput />`                     | This will be a custom component. The `onChange` handler will need to be wrapped to handle the `File` object from the event and call a function to upload it, ultimately calling `field.onChange` with the returned file URL. |

---

### 3.4 Navigation and AI Checkpoints

**Goal:** Handle page transitions and AI-driven branching.

**File to Edit:** `apps/formfiller/components/classic/ClassicFormView.tsx`

**Your Task:**

1.  Create an `onSubmit` function that `handleSubmit` will call. This function will be responsible for the navigation logic.
2.  Inside `onSubmit`, check if the last question on the `currentPage` has `isCheckpoint: true`.
3.  If it does, implement the AI call as detailed in the [**AI Branching Implementation Guide**](./implementation-guide-ai-branching.md). The AI's response will determine the next page number.
4.  If it does not, simply increment the `currentPage` state.
5.  The "Submit" button for the entire form will only be shown on the final page.

### 3.5 Backend API

This remains unchanged from the previous plan. You will create the `/api/ai/next-question` route as detailed in the branching guide.

### 3.6 Wiring It All Together

This remains unchanged. You will edit `apps/formfiller/app/[formId]/FormPageClient.tsx` to render the `<ClassicFormView />` when `isClassicMode` is true.

---

## Final Checklist & How to Test

1.  [ ] Have you updated the `QuestionSchema`?
2.  [ ] Can you set a form's mode to "Classic" in the `formcraft` editor?
3.  [ ] Can you set the `label`, `page`, and `colSpan` for a question?
4.  [ ] Does a simple, single-page classic form render correctly in `formfiller`?
5.  [ ] Does the `colSpan` property correctly create a grid layout?
6.  [ ] Does a multi-page classic form navigate correctly between pages?
7.  [ ] Can you set an AI Checkpoint on a question and have it correctly call the new API route to determine the next step?

Start with a simple form and build up the complexity step-by-step. Good luck, and don't hesitate to ask questions!
