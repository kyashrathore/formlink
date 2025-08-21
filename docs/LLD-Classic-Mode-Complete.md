# LLD: Classic Mode - Complete Implementation Guide

**Document Version:** 2.0  
**Created:** January 2025  
**Status:** Implementation Ready  
**Replaces:** LLD-Classic-Mode.md, LLD-Classic-Mode-v2.md

---

## Table of Contents

1. [Overview & Current State](#1-overview--current-state)
2. [Architecture Design](#2-architecture-design)
3. [Implementation Phases](#3-implementation-phases)
4. [Progressive Reveal System](#4-progressive-reveal-system)
5. [AI Branching Integration](#5-ai-branching-integration)
6. [Testing & Validation](#6-testing--validation)

---

## 1. Overview & Current State

### 1.1 What is Classic Mode?

Classic Mode allows users to create traditional, multi-question forms with:

- **Grid-based layouts** using responsive column spans (1-12 columns)
- **Multi-step pages** with navigation between pages
- **Progressive reveal** where questions appear based on previous answers
- **AI-driven branching** using the existing `/api/ai/branching` endpoint
- **AI-enhanced UX** with smart validation, dynamic help text, and layout optimization

**Key Design Principle**: Leverage FormLink's AI capabilities to create intelligent forms that adapt to users, rather than static form libraries.

### 1.2 Current Implementation Status

#### ✅ **What's Already Implemented:**

**Schema Foundation:**

```typescript
// packages/schema/src/index.ts:131-136 - Already exists
label: z.string().optional(),
page: z.number().int().optional(),
styling: z.object({ colSpan: z.number().int().min(1).max(12).optional() }).optional(),
mightBranchOffNext: z.boolean().optional(),
```

**AI Branching API:**

```typescript
// apps/formfiller/app/api/ai/branching/route.ts - Already exists and working
// Used by TypeForm mode successfully
```

**Settings Infrastructure:**

```typescript
// packages/schema/src/index.ts:210-214 - Already exists
branching: z.object({
  enabled: z.boolean().optional().default(false),
}).optional(),
```

#### ❌ **What Needs Implementation:**

1. **Missing `defaultMode` in Settings** - Referenced but not in schema
2. **Classic Mode UI Components** - No ClassicFormView exists
3. **FormModeControls** - Only supports "chat" | "typeform"
4. **Progressive Reveal Logic** - Dynamic question visibility
5. **FormModeContext** - No "classic" mode support

### 1.3 Branching Implementation Clarification

**Important:** The branching system is MORE complete than originally thought:

| Mode         | Branching Implementation                              | Status             |
| ------------ | ----------------------------------------------------- | ------------------ |
| **TypeForm** | Uses `/api/ai/branching` API at checkpoints           | ✅ Working         |
| **AI/Chat**  | AI reads journey script directly, no API needed       | ✅ Working         |
| **Classic**  | Will use `/api/ai/branching` API + progressive reveal | ❌ Not implemented |

**Key Insight:** `conditionalLogic` is DEPRECATED. The new approach uses `mightBranchOffNext` + journey scripts.

---

## 2. Architecture Design

### 2.1 Form Mode Comparison

| Feature        | TypeForm Mode              | AI/Chat Mode               | Classic Mode (Target)           |
| -------------- | -------------------------- | -------------------------- | ------------------------------- |
| **Display**    | One question per screen    | Conversational interface   | Multiple questions per page     |
| **Navigation** | Previous/Next buttons      | Chat flow                  | Page-based with form submission |
| **Branching**  | Jump to different question | AI decides naturally       | Progressive reveal + page jumps |
| **Layout**     | Full screen per question   | Chat messages              | Grid system (12 columns)        |
| **User Input** | Direct form controls       | Chat input with components | Traditional form fields         |

### 2.2 Progressive Reveal vs Traditional Branching

**Traditional Branching (TypeForm):**

```
Question 1 → AI Decision → Jump to Question 5
```

**Progressive Reveal (Classic Mode):**

```
Page 1:
┌─────────────────┐
│ Q1: Name        │ ← Always visible
├─────────────────┤
│ Q2: Job Status  │ ← Always visible
│ [✓] mightBranchOffNext
├─────────────────┤
│ Q3: Salary      │ ← Only appears if Q2 = "Employed"
├─────────────────┤
│ Q4: Experience  │ ← Only appears if Q3 filled
└─────────────────┘
```

### 2.3 Component Architecture

```
ClassicFormView (Main orchestrator)
├── ProgressBar (multi-page indicator)
├── Grid Container (12-column responsive)
│   ├── ClassicFormField (individual question wrapper)
│   │   ├── FormLabel (uses question.label)
│   │   ├── FormControl
│   │   │   └── QuestionInputSwitcher (maps type to UI component)
│   │   └── FormMessage (validation errors)
│   └── [Repeat for each visible question]
└── NavigationButtons (Previous/Next/Submit)
```

---

## 3. Implementation Phases

### Phase 1: Schema & Mode Infrastructure (Week 1)

#### 3.1 Complete Settings Schema

**File:** `packages/schema/src/index.ts`

**Task:** Add missing `defaultMode` field:

```typescript
export const SettingsSchema = z.object({
  // Add as first field - currently missing but referenced in code
  defaultMode: z.enum(["ai", "typeform", "classic"]).optional().default("ai"),

  // ... rest of existing fields
  resultPageGenerationPrompt: z.string().optional(),
  journeyScript: z.string().optional(),
  // ... etc
});
```

#### 3.2 Update FormModeControls

**File:** `apps/formcraft/app/dashboard/forms/[formId]/components/form/FormModeControls.tsx`

**Current State:** Only supports "chat" | "typeform"

**Task:** Add Classic Mode option:

```typescript
// Line 5: Update type
export type FormMode = "chat" | "typeform" | "classic"

// Lines 13-24: Add classic option to formModeOptions
{
  mode: "classic" as const,
  label: "Classic",
  description: "Multi-step form with grid layout",
},
```

**Parent Integration:** Connect to `useFormEditorStore`:

```typescript
const { updateSettingField } = useFormEditorStore();

const handleModeChange = (mode: FormMode) => {
  updateSettingField("defaultMode", mode === "chat" ? "ai" : mode);
};
```

#### 3.3 Update FormModeContext

**Files:**

- `apps/formfiller/contexts/FormModeContext.tsx`
- `packages/ui/src/form/context/FormModeContext.tsx`

**Task:** Add "classic" mode support:

```typescript
// Update type definitions
export type AppFormMode = "ai" | "typeform" | "classic";
export type FormMode = "chat" | "typeform" | "classic";

// Add mode detection
const isClassicMode = mode === "classic";

// Update mapping logic
const mappedDefaultMode = (
  defaultMode === "ai"
    ? "chat"
    : defaultMode === "typeform"
      ? "typeform"
      : defaultMode === "classic"
        ? "classic"
        : "chat"
) as UIFormMode;
```

### Phase 2: Classic Mode Components (Week 2)

#### 3.1 ClassicFormView - Main Orchestrator

**File:** `apps/formfiller/components/classic/ClassicFormView.tsx`

**Key Features:**

- Multi-page state management
- Progressive reveal logic
- Integration with existing form store
- Grid layout with responsive columns
- AI branching at checkpoints

```typescript
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form } from "@formlink/ui";

interface ClassicFormViewProps {
  formSchema: Form;
  formId: string;
  questionResponses: Record<string, any>;
  isCompleted: boolean;
  onInitialize: () => void;
  onAnswerChange: (questionId: string, value: any, questionType: string) => void;
  onMarkCompleted: () => void;
}

export default function ClassicFormView({
  formSchema,
  questionResponses,
  onAnswerChange,
  ...props
}) {
  const [currentPage, setCurrentPage] = useState(1);
  const [visibilityState, setVisibilityState] = useState({
    visibleQuestionIds: new Set<string>(),
    processingCheckpoint: null,
  });

  // Generate react-hook-form schema from FormLink questions
  const formValidationSchema = useMemo(() => {
    const schemaShape: Record<string, z.ZodType> = {};

    formSchema.questions.forEach((question) => {
      let fieldSchema: z.ZodType;

      // Map FormLink question types to Zod validation schemas
      switch (question.type.name) {
        case "text":
          fieldSchema = z.string();
          if (question.type.format === "email") {
            fieldSchema = z.string().email("Please enter a valid email address");
          }
          if (question.type.format === "url") {
            fieldSchema = z.string().url("Please enter a valid URL");
          }
          break;

        case "singleChoice":
          fieldSchema = z.string();
          break;

        case "multipleChoice":
          fieldSchema = z.array(z.string());
          break;

        case "rating":
        case "linearScale":
          fieldSchema = z.number().min(question.type.config.min).max(question.type.config.max);
          break;

        case "likertScale":
          fieldSchema = z.number().min(0).max(question.type.options.length - 1);
          break;

        case "date":
          fieldSchema = question.type.format === "dateRange"
            ? z.object({ from: z.date(), to: z.date().optional() })
            : z.date();
          break;

        case "fileUpload":
          fieldSchema = z.instanceof(File);
          break;

        case "ranking":
          fieldSchema = z.array(z.string());
          break;

        case "address":
          fieldSchema = z.object({
            street1: z.string().optional(),
            street2: z.string().optional(),
            city: z.string().optional(),
            stateProvince: z.string().optional(),
            postalCode: z.string().optional(),
            country: z.string().optional(),
          });
          break;

        default:
          fieldSchema = z.string();
      }

      // Apply FormLink validations
      if (question.validations?.required?.value) {
        fieldSchema = fieldSchema; // Already required by default
      } else {
        fieldSchema = fieldSchema.optional();
      }

      if (question.validations?.minLength?.value && fieldSchema instanceof z.ZodString) {
        fieldSchema = fieldSchema.min(question.validations.minLength.value,
          question.validations.minLength.message || `Minimum ${question.validations.minLength.value} characters required`
        );
      }

      if (question.validations?.maxLength?.value && fieldSchema instanceof z.ZodString) {
        fieldSchema = fieldSchema.max(question.validations.maxLength.value,
          question.validations.maxLength.message || `Maximum ${question.validations.maxLength.value} characters allowed`
        );
      }

      schemaShape[question.id] = fieldSchema;
    });

    return z.object(schemaShape);
  }, [formSchema.questions]);

  // Initialize react-hook-form with dynamic schema and current responses
  const form = useForm({
    resolver: zodResolver(formValidationSchema),
    defaultValues: questionResponses,
    mode: "onChange", // Validate on change for better UX
  });

  // Watch form changes and sync with parent component
  const watchedValues = form.watch();

  useEffect(() => {
    Object.entries(watchedValues).forEach(([questionId, value]) => {
      if (value !== undefined && value !== questionResponses[questionId]) {
        const question = formSchema.questions.find(q => q.id === questionId);
        if (question) {
          onAnswerChange(questionId, value, question.type.name);
        }
      }
    });
  }, [watchedValues, questionResponses, onAnswerChange, formSchema.questions]);

  // Group questions by page
  const questionsByPage = useMemo(() => {
    const grouped = new Map<number, Question[]>();
    formSchema.questions.forEach((question) => {
      const page = question.page || 1;
      if (!grouped.has(page)) {
        grouped.set(page, []);
      }
      grouped.get(page)!.push(question);
    });
    return grouped;
  }, [formSchema.questions]);

  // Get visible questions for current page with progressive reveal
  const visibleQuestions = useMemo(() => {
    return getVisibleQuestionsForPage(
      questionsByPage.get(currentPage) || [],
      watchedValues, // Use form values instead of prop
      visibilityState
    );
  }, [currentPage, watchedValues, visibilityState, questionsByPage]);

  // Handle form submission with branching logic
  const onSubmit = async (formData: Record<string, any>) => {
    // Find checkpoints on current page
    const checkpoints = visibleQuestions.filter(q => q.mightBranchOffNext);

    // Process any checkpoints
    for (const checkpoint of checkpoints) {
      if (formData[checkpoint.id]) {
        const branchingResult = await processCheckpoint(checkpoint, formData);
        if (branchingResult?.targetPage && branchingResult.targetPage !== currentPage) {
          setCurrentPage(branchingResult.targetPage);
          return; // Skip normal page progression
        }
      }
    }

    // Normal page progression
    const nextPage = currentPage + 1;
    const totalPages = Math.max(...Array.from(questionsByPage.keys()));

    if (nextPage > totalPages) {
      onMarkCompleted();
    } else {
      setCurrentPage(nextPage);
    }
  };

  const totalPages = Math.max(...Array.from(questionsByPage.keys()));

  return (
    <div className="min-h-screen bg-background p-4">
      <ProgressIndicator currentPage={currentPage} totalPages={totalPages} />

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <div className="grid grid-cols-12 gap-4">
            {visibleQuestions.map((question) => (
              <ClassicFormField
                key={question.id}
                control={form.control}
                question={question}
              />
            ))}
          </div>

          <NavigationButtons
            canGoBack={currentPage > 1}
            isLastPage={currentPage === totalPages}
            onPrevious={() => setCurrentPage(p => Math.max(1, p - 1))}
            onNext={form.handleSubmit(onSubmit)}
            isValid={form.formState.isValid}
            isSubmitting={form.formState.isSubmitting}
          />
        </form>
      </Form>
    </div>
  );
}
```

#### 3.2 ClassicFormField - Question Wrapper

**File:** `apps/formfiller/components/classic/ClassicFormField.tsx`

**React Hook Form Integration with FormLink UI Components:**

```typescript
import { FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "@formlink/ui";

interface ClassicFormFieldProps {
  control: Control<any>;
  question: Question;
}

export function ClassicFormField({ control, question }: ClassicFormFieldProps) {
  const colSpan = question.styling?.colSpan || 12;

  // Generate responsive Tailwind classes
  const gridClasses = `col-span-12 ${
    colSpan <= 6 ? `md:col-span-${colSpan}` : `col-span-${colSpan}`
  }`;

  return (
    <div className={gridClasses}>
      <FormField
        control={control}
        name={question.id}
        render={({ field, fieldState }) => (
          <FormItem>
            <FormLabel>
              {question.label || question.title}
              {question.validations?.required?.value && (
                <span className="text-destructive ml-1">*</span>
              )}
            </FormLabel>

            {question.description && (
              <FormDescription>
                {question.description}
              </FormDescription>
            )}

            <FormControl>
              <QuestionInputSwitcher
                question={question}
                field={field}
                error={fieldState.error}
              />
            </FormControl>

            <FormMessage />

            {/* AI-powered validation messages */}
            {question.readableValidations?.map((validation, index) => (
              <FormDescription key={index} className="text-muted-foreground text-xs">
                {validation}
              </FormDescription>
            ))}
          </FormItem>
        )}
      />
    </div>
  );
}
```

#### 3.3 QuestionInputSwitcher - Shadcn/UI Component Mapping

**File:** `apps/formfiller/components/classic/QuestionInputSwitcher.tsx`

**Uses only existing `@formlink/ui` components - no custom components needed:**

```typescript
import {
  Input,
  Textarea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  RadioGroup,
  RadioGroupItem,
  Checkbox,
  Calendar,
  FileUpload
} from "@formlink/ui";

export function QuestionInputSwitcher({ question, field }: Props) {
  switch (question.type.name) {
    case "text":
      if (question.type.format === "textarea") {
        return <Textarea {...field} placeholder="Enter your response..." />;
      }
      return (
        <Input
          type={question.type.format} // "email", "url", "tel", "number", etc.
          {...field}
          placeholder={getPlaceholderForFormat(question.type.format)}
        />
      );

    case "singleChoice":
      if (question.type.display === "dropdown") {
        return (
          <Select onValueChange={field.onChange} defaultValue={field.value}>
            <SelectTrigger>
              <SelectValue placeholder="Select an option..." />
            </SelectTrigger>
            <SelectContent>
              {question.type.options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      }

      return (
        <RadioGroup onValueChange={field.onChange} defaultValue={field.value}>
          {question.type.options.map((option) => (
            <div key={option.value} className="flex items-center space-x-2">
              <RadioGroupItem value={option.value} id={option.value} />
              <Label htmlFor={option.value}>{option.label}</Label>
            </div>
          ))}
        </RadioGroup>
      );

    case "multipleChoice":
      return (
        <div className="space-y-2">
          {question.type.options.map((option) => {
            const isChecked = Array.isArray(field.value) && field.value.includes(option.value);
            return (
              <div key={option.value} className="flex items-center space-x-2">
                <Checkbox
                  id={option.value}
                  checked={isChecked}
                  onCheckedChange={(checked) => {
                    const currentValue = Array.isArray(field.value) ? field.value : [];
                    const newValue = checked
                      ? [...currentValue, option.value]
                      : currentValue.filter(v => v !== option.value);
                    field.onChange(newValue);
                  }}
                />
                <Label htmlFor={option.value}>{option.label}</Label>
              </div>
            );
          })}
        </div>
      );

    case "rating":
      return (
        <RatingSlider
          min={question.type.config.min}
          max={question.type.config.max}
          step={question.type.config.step}
          value={[field.value || question.type.config.min]}
          onValueChange={(value) => field.onChange(value[0])}
          minLabel={question.type.config.minLabel}
          maxLabel={question.type.config.maxLabel}
        />
      );

    case "linearScale":
      return (
        <LinearScaleSlider
          start={question.type.config.start}
          end={question.type.config.end}
          step={question.type.config.step}
          value={[field.value || question.type.config.start]}
          onValueChange={(value) => field.onChange(value[0])}
          startLabel={question.type.config.startLabel}
          endLabel={question.type.config.endLabel}
        />
      );

    case "likertScale":
      return (
        <RadioGroup onValueChange={(value) => field.onChange(parseInt(value))}
                    defaultValue={field.value?.toString()}>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
            {question.type.options.map((option, index) => (
              <div key={index} className="flex flex-col items-center space-y-2">
                <RadioGroupItem value={index.toString()} id={`likert-${index}`} />
                <Label htmlFor={`likert-${index}`} className="text-xs text-center">
                  {option}
                </Label>
              </div>
            ))}
          </div>
        </RadioGroup>
      );

    case "date":
      return question.type.format === "dateRange"
        ? <DateRangePicker field={field} />
        : <DatePicker field={field} />;

    case "ranking":
      return <RankingComponent options={question.type.options} field={field} />;

    case "fileUpload":
      return (
        <FileUpload
          onFilesAdded={(files) => field.onChange(files[0])}
          multiple={false}
          accept={getAcceptedTypes(question.validations?.allowedTypes)}
        >
          <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
            <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              Click to upload or drag and drop
            </p>
            {field.value && (
              <p className="text-sm font-medium mt-2">{field.value.name}</p>
            )}
          </div>
        </FileUpload>
      );

    case "address":
      return <AddressInput field={field} />;

    default:
      return <Input {...field} placeholder="Enter your response..." />;
  }
}
```

---

## React Hook Form Integration Summary

### ✅ **Key Benefits of RHF + FormLink Architecture**

1. **Type Safety**: Zod schemas generated from FormLink questions provide full type safety
2. **Performance**: Only re-renders components when their specific fields change
3. **Validation**: Built-in validation with custom messages from FormLink validations
4. **Progressive Enhancement**: Works with existing business logic and AI branching
5. **Accessibility**: FormLink UI components have built-in ARIA attributes

### 🔧 **Integration Points**

**Form Setup:**

```typescript
const form = useForm({
  resolver: zodResolver(dynamicZodSchema), // Generated from FormLink questions
  defaultValues: questionResponses, // From existing state management
  mode: "onChange", // Real-time validation
});
```

**Field Rendering:**

```typescript
<FormField
  control={form.control}              // RHF control
  name={question.id}                  // FormLink question ID
  render={({ field, fieldState }) => (
    <FormItem>                        {/* FormLink UI component */}
      <FormControl>
        <QuestionInputSwitcher        {/* Maps to shadcn/ui components */}
          question={question}         {/* FormLink schema data */}
          field={field}              {/* RHF field props */}
          error={fieldState.error}   {/* RHF validation state */}
        />
      </FormControl>
    </FormItem>
  )}
/>
```

**State Synchronization:**

```typescript
const watchedValues = form.watch();
useEffect(() => {
  // Sync RHF state changes back to parent component
  Object.entries(watchedValues).forEach(([questionId, value]) => {
    if (value !== questionResponses[questionId]) {
      onAnswerChange(questionId, value, questionType);
    }
  });
}, [watchedValues]);
```

### 📋 **Component Dependencies**

**Required Components (All exist in `@formlink/ui`):**

- ✅ `Form, FormField, FormItem, FormLabel, FormControl, FormMessage` (form.tsx)
- ✅ `Input, Textarea` (input.tsx, textarea.tsx)
- ✅ `Select, SelectContent, SelectItem, SelectTrigger, SelectValue` (select.tsx)
- ✅ `RadioGroup, RadioGroupItem` (radio-group.tsx)
- ✅ `Checkbox` (checkbox.tsx)
- ✅ `Calendar` (calendar.tsx)
- ✅ `FileUpload` (file-upload.tsx)

**Missing Components (Need simple wrappers):**

- ❌ `RatingSlider` - Wrap existing slider for rating questions
- ❌ `DatePicker/DateRangePicker` - Wrap Calendar in Popover
- ❌ `RankingComponent` - Sortable list component
- ❌ `AddressInput` - Structured address fields

---

### Phase 3: Progressive Reveal System (Week 3)

#### 3.1 Visibility State Management

**Core Algorithm:**

```typescript
function getVisibleQuestionsForPage(
  pageQuestions: Question[],
  responses: Record<string, any>,
  visibilityState: VisibilityState,
): Question[] {
  const visible: Question[] = [];

  for (const question of pageQuestions) {
    // Always show if explicitly marked visible
    if (visibilityState.visibleQuestionIds.has(question.id)) {
      visible.push(question);
      continue;
    }

    // Progressive reveal logic
    if (visible.length === 0) {
      // Always show first question
      visible.push(question);
    } else {
      const lastVisibleQuestion = visible[visible.length - 1];

      // Show next question if:
      // 1. Previous checkpoint is filled, OR
      // 2. Previous question is not a checkpoint
      if (lastVisibleQuestion.mightBranchOffNext) {
        if (responses[lastVisibleQuestion.id]) {
          visible.push(question);
        } else {
          break; // Stop revealing - checkpoint not filled
        }
      } else {
        visible.push(question);
      }
    }
  }

  return visible;
}
```

#### 3.2 AI Branching Integration

**Integration with Existing API:**

```typescript
const handleCheckpointProcessing = async (
  checkpointQuestion: Question,
  formData: any,
) => {
  if (
    !checkpointQuestion.mightBranchOffNext ||
    !formSchema.settings?.journeyScript
  ) {
    return { type: "sequential" };
  }

  try {
    const response = await fetch("/api/ai/branching", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        journeyScript: formSchema.settings.journeyScript,
        answerHistory: { ...questionResponses, ...formData },
        questions: formSchema.questions,
        currentQuestionId: checkpointQuestion.id,
      }),
    });

    const { nextQuestionId } = await response.json();

    // Determine if this affects current page or requires navigation
    const nextQuestion = formSchema.questions.find(
      (q) => q.id === nextQuestionId,
    );
    const nextPage = nextQuestion?.page || currentPage + 1;

    return {
      type: "branching",
      nextQuestionId,
      targetPage: nextPage,
    };
  } catch (error) {
    console.warn("AI branching failed, using sequential fallback:", error);
    return { type: "sequential" };
  }
};
```

#### 3.3 Animation & UX

**Smooth Progressive Reveal:**

```css
@keyframes questionReveal {
  from {
    opacity: 0;
    transform: translateY(-10px);
    max-height: 0;
  }
  to {
    opacity: 1;
    transform: translateY(0);
    max-height: 300px;
  }
}

.question-reveal {
  animation: questionReveal 0.3s ease-out;
}

.question-hide {
  animation: questionReveal 0.3s ease-out reverse;
}
```

### Phase 4: Integration & Polish (Week 4)

#### 4.1 Wire into FormPageClient

**File:** `apps/formfiller/app/[formId]/FormPageClient.tsx`

**Task:** Add Classic Mode rendering:

```typescript
// Add import
import ClassicFormView from "@/components/classic/ClassicFormView";

// Update mode detection
function FormPageContent({...}) {
  const { isAIMode, isClassicMode } = useFormMode();

  // Add Classic Mode rendering
  if (isClassicMode) {
    return (
      <ClassicFormView
        formSchema={formSchema}
        formId={formSchema.id}
        questionResponses={questionResponses}
        isCompleted={isCompleted}
        onInitialize={initialize}
        onAnswerChange={handleAnswerChange}
        onMarkCompleted={markAsCompleted}
      />
    );
  }

  if (isAIMode) {
    // ... existing AI mode
  }

  // ... existing TypeForm mode
}
```

#### 4.2 Question Properties Panel

**File:** `apps/formcraft/app/dashboard/forms/[formId]/components/form/FormEditor/QuestionDetails.tsx`

**Task:** Add Classic Mode properties UI:

```typescript
// Add Classic Mode section after existing sections
{form?.settings?.defaultMode === "classic" && (
  <div className="space-y-3 border-t pt-3">
    <h4 className="text-sm font-medium">Classic Mode Properties</h4>

    <div className="space-y-2">
      <Label htmlFor="question-label">Field Label</Label>
      <Input
        id="question-label"
        value={question.label || ""}
        onChange={(e) => updateQuestionField(question.id, "label", e.target.value)}
        placeholder="Short label for this field"
      />
    </div>

    <div className="space-y-2">
      <Label htmlFor="question-page">Page Number</Label>
      <Input
        id="question-page"
        type="number"
        min="1"
        value={question.page || 1}
        onChange={(e) => updateQuestionField(question.id, "page", parseInt(e.target.value) || 1)}
      />
    </div>

    <div className="space-y-2">
      <Label htmlFor="question-colspan">Column Span (1-12)</Label>
      <Input
        id="question-colspan"
        type="number"
        min="1"
        max="12"
        value={question.styling?.colSpan || 12}
        onChange={(e) => updateQuestionField(question.id, "styling", {
          colSpan: parseInt(e.target.value) || 12
        })}
      />
    </div>

    <div className="flex items-center space-x-2">
      <Switch
        id="ai-checkpoint"
        checked={question.mightBranchOffNext || false}
        onCheckedChange={(checked) => updateQuestionField(question.id, "mightBranchOffNext", checked)}
      />
      <Label htmlFor="ai-checkpoint">AI Branching Checkpoint</Label>
    </div>
  </div>
)}
```

---

## 4. Progressive Reveal System

### 4.1 State Management Architecture

```typescript
interface VisibilityState {
  visibleQuestionIds: Set<string>;
  revealQueue: string[];
  processingCheckpoint: string | null;
  lastRevealedQuestionId: string | null;
}

const useProgressiveReveal = (
  pageQuestions: Question[],
  responses: Record<string, any>,
) => {
  const [visibilityState, setVisibilityState] = useState<VisibilityState>({
    visibleQuestionIds: new Set(),
    revealQueue: [],
    processingCheckpoint: null,
    lastRevealedQuestionId: null,
  });

  // Effect to update visibility when responses change
  useEffect(() => {
    const newVisibleQuestions = calculateVisibleQuestions(
      pageQuestions,
      responses,
    );

    setVisibilityState((prev) => ({
      ...prev,
      visibleQuestionIds: new Set(newVisibleQuestions.map((q) => q.id)),
    }));
  }, [pageQuestions, responses]);

  return {
    visibleQuestions: pageQuestions.filter((q) =>
      visibilityState.visibleQuestionIds.has(q.id),
    ),
    visibilityState,
    setVisibilityState,
  };
};
```

### 4.2 Dynamic Question Filtering

**Smart Reveal Algorithm:**

1. **Always show** first question on page
2. **For subsequent questions:**
   - If previous question is NOT a checkpoint → show next question
   - If previous question IS a checkpoint → only show if checkpoint is filled
   - Continue until unfilled checkpoint is reached

**Cross-Page Branching:**
When AI determines next question is on different page:

1. Save current page state
2. Navigate to target page
3. Initialize visibility state for new page
4. Highlight the target question

### 4.3 User Experience Patterns

**Progressive Disclosure:**

- Questions appear with smooth slide-down animation
- User can scroll to see newly revealed questions
- Auto-scroll to newly revealed question when appropriate

**Checkpoint Feedback:**

- Show loading spinner when processing checkpoint
- Clear visual indication when question triggers branching
- Success feedback when branching completes

**Navigation Behavior:**

- **Forward:** Only enabled when current page questions are valid
- **Backward:** Preserves visibility state of previous pages
- **Skip Logic:** Questions can be hidden based on AI decisions

---

## 5. AI Branching Integration

### 5.1 Existing API Integration

Classic Mode will reuse the existing, working `/api/ai/branching` endpoint:

**API Contract:**

```typescript
// Request
{
  journeyScript: string;          // Form's branching rules
  answerHistory: Record<string, any>;  // All responses so far
  questions: Question[];          // All form questions
  currentQuestionId: string;      // Question that triggered branching
}

// Response
{
  nextQuestionId: string;         // ID of next question to show
  reasoning?: string;             // Optional explanation
  success: boolean;
}
```

### 5.2 Integration Points

**Checkpoint Processing:**

```typescript
const processCheckpoint = async (question: Question, currentResponses: any) => {
  // Only process if question is marked as checkpoint AND has journey script
  if (!question.mightBranchOffNext || !formSchema.settings?.journeyScript) {
    return null; // Continue sequential flow
  }

  setVisibilityState((prev) => ({
    ...prev,
    processingCheckpoint: question.id,
  }));

  try {
    const result = await callBranchingAPI(question, currentResponses);

    // Determine impact on current page
    const targetQuestion = findQuestionById(result.nextQuestionId);
    const targetPage = targetQuestion?.page || currentPage;

    if (targetPage === currentPage) {
      // Same page - update visibility
      revealQuestionsUntil(result.nextQuestionId);
    } else {
      // Different page - navigate
      navigateToPage(targetPage, result.nextQuestionId);
    }

    return result;
  } finally {
    setVisibilityState((prev) => ({ ...prev, processingCheckpoint: null }));
  }
};
```

**Fallback Strategy:**
If AI branching fails:

1. Log error for debugging
2. Continue with sequential question flow
3. Show user-friendly message if needed
4. Track failures for system monitoring

### 5.3 Journey Script Integration

**Enhanced Journey Script Format:**

```typescript
const exampleJourneyScript = `
## Branching Logic

### Employment Status Decision:
- If "Student" → skip to education questions (page 2)
- If "Employed" → continue to work experience 
- If "Unemployed" → skip to availability questions (page 3)

### Experience Level Branching:
- If years_experience < 2 → show junior-specific questions
- If years_experience >= 5 → show senior-specific questions
- Otherwise → show standard questions

## Page Flow:
- Page 1: Basic info + employment status
- Page 2: Education (students only)  
- Page 3: Work experience (employed only)
- Page 4: Availability (unemployed only)
- Page 5: Final questions (all users)
`;
```

---

## 6. Testing & Validation

### 6.1 Unit Testing Scenarios

**Progressive Reveal Logic:**

```typescript
describe("Progressive Reveal", () => {
  test("shows questions up to first checkpoint", () => {
    const questions = [
      { id: "q1", mightBranchOffNext: false },
      { id: "q2", mightBranchOffNext: true }, // Checkpoint
      { id: "q3", mightBranchOffNext: false },
    ];
    const responses = {};

    const visible = getVisibleQuestionsForPage(questions, responses);
    expect(visible.map((q) => q.id)).toEqual(["q1", "q2"]);
  });

  test("reveals questions after checkpoint is filled", () => {
    const questions = [
      { id: "q1", mightBranchOffNext: false },
      { id: "q2", mightBranchOffNext: true }, // Checkpoint
      { id: "q3", mightBranchOffNext: false },
    ];
    const responses = { q2: "Employed" };

    const visible = getVisibleQuestionsForPage(questions, responses);
    expect(visible.map((q) => q.id)).toEqual(["q1", "q2", "q3"]);
  });
});
```

**AI Branching Integration:**

```typescript
describe("AI Branching", () => {
  test("calls API when checkpoint question is filled", async () => {
    const mockAPI = jest.fn().mockResolvedValue({ nextQuestionId: "q5" });
    global.fetch = mockAPI;

    const result = await processCheckpoint(checkpointQuestion, responses);

    expect(mockAPI).toHaveBeenCalledWith("/api/ai/branching", {
      method: "POST",
      body: expect.stringContaining("journeyScript"),
    });
    expect(result.nextQuestionId).toBe("q5");
  });

  test("falls back to sequential when API fails", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("API Error"));

    const result = await processCheckpoint(checkpointQuestion, responses);

    expect(result.type).toBe("sequential");
  });
});
```

### 6.2 Integration Testing

**End-to-End Flow:**

1. Create form with Classic Mode enabled
2. Add questions with different page numbers and column spans
3. Set checkpoint question with journey script
4. Fill form through progressive reveal
5. Verify AI branching calls API correctly
6. Test backward navigation preserves state
7. Verify form submission includes all responses

**Multi-Page Navigation:**

1. Create 3-page form with cross-page branching
2. Fill page 1, trigger branch to page 3
3. Navigate back to page 1, verify state preserved
4. Test that page 2 is correctly skipped
5. Verify final submission includes all relevant pages

### 6.3 Performance Testing

**Target Benchmarks:**

- Forms with 50+ questions: < 100ms initial render
- Progressive reveal: < 50ms per question revealed
- AI branching response: < 500ms API call
- Page navigation: < 100ms transition
- Memory usage: < 10MB increase for complex forms

**Load Testing:**

- Test with forms containing 100+ questions
- Verify smooth scrolling with many visible questions
- Test rapid user input doesn't break visibility state
- Ensure animations remain smooth at 60fps

---

## Conclusion

This consolidated implementation plan provides a complete roadmap for Classic Mode implementation. The key advantages of this approach:

### ✅ **Builds on Existing Infrastructure**

- Reuses working AI branching API from TypeForm mode
- Leverages existing schema properties (already implemented)
- Integrates with current form store and state management

### ✅ **Progressive Implementation**

- Phase 1: Basic mode infrastructure (low risk)
- Phase 2: Core components (functional but simple)
- Phase 3: Advanced features (progressive reveal)
- Phase 4: Polish and optimization

### ✅ **Maintains Consistency**

- Same branching API across TypeForm and Classic modes
- Consistent form patterns using shadcn/ui
- Unified state management with existing stores

### ✅ **Production Ready Design**

- Comprehensive error handling and fallbacks
- Performance optimizations for large forms
- Accessibility considerations built-in
- Mobile-responsive grid system

The implementation can begin immediately and will result in a powerful, flexible Classic Mode that combines the best of traditional forms with AI-driven intelligence.

---

## Related Documentation

- `docs/implementation-guide-ai-branching.md` - AI branching system details
- `packages/schema/src/index.ts` - Schema definitions
- `apps/formfiller/app/api/ai/branching/route.ts` - Existing branching API

**Status:** Ready for Implementation  
**Estimated Timeline:** 4 weeks  
**Dependencies:** None (all required infrastructure exists)
