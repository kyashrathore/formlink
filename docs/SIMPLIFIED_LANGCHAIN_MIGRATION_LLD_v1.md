# Simplified Langchain Migration - Low Level Design

## Migration Overview

**Goal**: Remove Langchain entirely and replace with simple sequential function calls using AI SDK streaming.

**Complexity Reduction**: 1000+ lines → ~100 lines (90% reduction)

**Approach**: Extract business logic from existing nodes, implement sequential workflow with AI SDK streaming.

## Task-by-Task Implementation Plan

### **Task 1: Extract Core Business Functions**

**Objective**: Create simple functions from existing Langchain nodes

#### **1.1 Create generateMetadata function**

**File**: `/apps/formcraft/app/lib/chat/tools/generate-metadata.ts`

Extract from `metadata_generator.ts:102-107` (core AI SDK logic):

```typescript
import { generateObject } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { ENHANCED_METADATA_PROMPT } from "../../prompts";

export async function generateMetadata(
  normalizedContent: string,
  dataStream: any,
) {
  dataStream.writeData({ type: "progress", message: "Generating metadata..." });

  const openRouterProvider = createOpenRouter({
    apiKey: getenv("OPENROUTER_API_KEY") || "",
  });

  const result = await generateObject({
    model: openRouterProvider("openai/gpt-4o-mini"),
    schema: MetadataResponseSchema, // From metadata_generator.ts:23-33
    system: ENHANCED_METADATA_PROMPT.replace(
      "{{userInput}}",
      normalizedContent,
    ),
    prompt: normalizedContent,
  });

  dataStream.writeData({ type: "progress", message: "Metadata generated" });
  return result.object;
}
```

**Extract from**: Lines 102-107 in metadata_generator.ts
**Dependencies**: ENHANCED_METADATA_PROMPT, MetadataResponseSchema
**Progress**: Direct dataStream.writeData() calls

#### **1.2 Create generateQuestion function**

**File**: `/apps/formcraft/app/lib/chat/tools/generate-question.ts`

Extract from `task_processor.ts:157-162` (core AI SDK logic):

```typescript
export async function generateQuestion(spec: QuestionSpec, dataStream: any) {
  dataStream.writeData({
    type: "progress",
    message: `Generating question: ${spec.question_specs}`,
  });

  const result = await generateObject({
    model: openai("gpt-4o"),
    schema: getSpecificQuestionSchema(spec.type), // From task_processor.ts:49-62
    system: buildQuestionPrompt(spec), // From task_processor.ts:91-112
    prompt: `Generate question: ${spec.question_specs}`,
  });

  return {
    ...result.object,
    id: uuidv4(),
    order: spec.order,
    type: "question" as const,
  };
}
```

**Extract from**: Lines 157-162 in task_processor.ts
**Dependencies**: QuestionSchema types, prompt building logic
**Simplification**: Remove complex task lifecycle, database operations

#### **1.3 Create finalizeForm function**

**File**: `/apps/formcraft/app/lib/chat/tools/finalize-form.ts`

Extract from `finalizer.ts` (remove Langchain types):

```typescript
export async function finalizeForm(
  metadata: FormMetadata,
  questions: Question[],
  formId: string,
  dataStream: any,
) {
  dataStream.writeData({ type: "progress", message: "Finalizing form..." });

  const supabase = await createServerClient(null, "service");

  const formData = {
    id: formId,
    title: metadata.title,
    description: metadata.description,
    questions: questions,
    settings: { journeyScript: metadata.journeyScript },
    version_id: uuidv4(),
  };

  const { error } = await supabase.from("forms").upsert(formData);

  if (error) throw new Error(`Failed to save form: ${error.message}`);

  dataStream.writeData({
    type: "success",
    message: "Form created successfully",
  });
}
```

**Extract from**: finalizer.ts core save logic
**Remove**: Langchain BaseMessage/RunnableConfig types
**Simplification**: Direct database operations, simple error handling

### **Task 2: Create Simplified Main Workflow**

**Objective**: Replace StateGraph with sequential function execution

#### **2.1 Create main workflow function**

**File**: `/apps/formcraft/app/lib/chat/tools/create-form-workflow.ts`

```typescript
export async function createFormWorkflow(
  input: { normalizedContent: string; formId: string; userId: string },
  dataStream: any,
) {
  try {
    // Step 1: Generate metadata
    const metadata = await generateMetadata(
      input.normalizedContent,
      dataStream,
    );

    // Step 2: Generate questions in parallel (like current system)
    const questionPromises = metadata.questionDetails.map((spec, index) =>
      generateQuestion({ ...spec, order: index }, dataStream),
    );

    const questions = await Promise.all(questionPromises);

    // Step 3: Finalize form
    await finalizeForm(metadata, questions, input.formId, dataStream);

    return { metadata, questions };
  } catch (error) {
    dataStream.writeData({
      type: "error",
      message: `Form creation failed: ${error.message}`,
    });
    throw error;
  }
}
```

**Replaces**: 378 lines of StateGraph orchestration
**Key features**: Sequential execution, Promise.all() parallel processing, AI SDK streaming
**Error handling**: Simple try/catch with streaming errors

### **Task 3: Update Agent Interface**

**Objective**: Replace generator-based agent with simple function call

#### **3.1 Update simple-agent.ts**

**File**: `/apps/formcraft/app/lib/agents/simple-agent.ts`

**Replace complex generator (lines 26-147)**:

```typescript
// Remove: async function* createFormAgent()
// Replace with:
export async function createFormAgent(
  params: {
    prompt: string;
    shortId: string;
    formId: string;
    selectedModel?: string;
  },
  userId: string,
  dataStream: any,
) {
  dataStream.writeData({
    type: "agent_initialized",
    message: "Starting form creation...",
  });

  await createFormWorkflow(
    {
      normalizedContent: params.prompt, // Skip normalization for simple prompts
      formId: params.formId,
      userId: userId,
    },
    dataStream,
  );

  dataStream.writeData({
    type: "agent_finalized",
    message: "Form creation completed",
  });
}
```

**Removes**: 147 lines of generator complexity
**Simplifies**: Direct function call vs async iteration
**Maintains**: Same interface for existing callers

### **Task 4: Update Chat Service Integration**

**Objective**: Replace generator iteration with simple function call

#### **4.1 Update create-form.ts**

**File**: `/apps/formcraft/app/lib/chat/tools/create-form.ts`

**Replace generator iteration**:

```typescript
// Remove complex generator iteration:
// for await (const agentEvent of createFormAgent(params, userId)) {
//   dataStream.writeData({ type: "custom_agent_event", payload: agentEvent })
// }

// Replace with direct call:
await createFormAgent(params, userId, dataStream);
```

**Simplification**: Direct streaming vs event wrapping
**Same UI experience**: dataStream.writeData() provides real-time updates

### **Task 5: Update Type Imports**

**Objective**: Remove Langchain type dependencies

#### **5.1 Update finalizer.ts**

**File**: `/apps/formcraft/app/lib/agent/nodes/finalizer.ts`

**Remove Langchain imports (lines 6-7)**:

```typescript
// Remove:
// import { BaseMessage } from "@langchain/core/messages"
// import { RunnableConfig } from "@langchain/core/runnables"

// Replace with native types:
interface Message {
  content: string;
  role: "user" | "assistant" | "system";
  type?: string;
}

interface ExecutionConfig {
  recursionLimit?: number;
  streamMode?: string;
}
```

**Update function signatures**:

- Line 225: `messages: BaseMessage[]` → `messages: Message[]`
- Line 229: `type: msg._getType()` → `type: msg.type || msg.role`
- Line 467: `config?: RunnableConfig` → `config?: ExecutionConfig`

### **Task 6: Clean Up Dependencies**

**Objective**: Remove Langchain packages and unused files

#### **6.1 Update package.json**

**File**: `/apps/formcraft/package.json`

**Remove dependencies (lines 30-31)**:

```json
// Remove these lines:
// "@langchain/core": "^0.3.62",
// "@langchain/langgraph": "^0.3.8",
```

**Run cleanup**:

```bash
pnpm install
```

#### **6.2 Remove orchestration files**

**After migration verification**:

- Delete: `/apps/formcraft/app/lib/agent/graph.ts` (378 lines)
- Delete: `/apps/formcraft/app/lib/agent/nodes/task_processor.ts` (621 lines)
- Keep: `metadata_generator.ts`, `finalizer.ts` (for reference/gradual migration)

## Implementation Order

### **Phase 1: Create New Functions** (No breaking changes)

1. Task 1.1: Create generateMetadata function
2. Task 1.2: Create generateQuestion function
3. Task 1.3: Create finalizeForm function
4. Task 2.1: Create main workflow function

### **Phase 2: Update Integration** (Switch implementation)

1. Task 3.1: Update simple-agent.ts
2. Task 4.1: Update chat service integration
3. Test end-to-end form creation

### **Phase 3: Clean Up** (Remove old code)

1. Task 5.1: Update type imports
2. Task 6.1: Remove dependencies
3. Task 6.2: Delete orchestration files

## Testing Strategy

### **Phase 1 Testing**

- Unit test each extracted function independently
- Compare outputs with current implementation
- Verify AI SDK integration works correctly

### **Phase 2 Testing**

- End-to-end form creation testing
- UI streaming verification (same progress updates)
- Parallel question generation performance test

### **Phase 3 Testing**

- Final build verification after dependency removal
- Bundle size measurement (should be significantly smaller)
- Performance comparison with original implementation

## Rollback Plan

### **Feature Flag Approach**

```typescript
const USE_SIMPLIFIED_WORKFLOW = process.env.USE_SIMPLIFIED_WORKFLOW === "true";

export const createFormAgent = USE_SIMPLIFIED_WORKFLOW
  ? createFormAgentSimplified
  : createFormAgentLangchain;
```

### **Gradual Migration**

- Keep existing files until migration verified
- Use feature flag for A/B testing
- Roll back by changing environment variable

## Success Criteria

### **Complexity Reduction**

- ✅ Remove 378 lines from graph.ts
- ✅ Remove 621 lines from task_processor.ts
- ✅ Simplify 147 lines in simple-agent.ts
- ✅ Remove 2 Langchain dependencies

### **Functional Parity**

- ✅ Same form creation output
- ✅ Same UI streaming experience
- ✅ Same parallel question generation
- ✅ Same error handling behavior

### **Performance Improvement**

- ✅ Smaller bundle size
- ✅ Faster compilation time
- ✅ Reduced memory usage
- ✅ Simpler debugging experience
