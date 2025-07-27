# Simple Langchain to Vercel AI SDK Migration

## Current vs New Flow

### Current Langchain Flow

```
StateGraph → normalize_input → generate_metadata_and_tasks → batch_processing → process_question (parallel) → finalize
```

### New Simple Tool Call Flow

```
1. create_form_metadata (title, description, journey)
2. create_questions (one by one, can be parallel)
3. finalize_form
```

## Analysis: Current Parallel Processing

**Current parallelization in graph.ts:267-312:**

- Processes up to 3 questions simultaneously
- Uses `Promise.all()` to run `processSingleTaskNode()` in parallel
- Each question generation is independent after metadata is created

**Keep parallel processing:** Use `Promise.all()` with individual tool calls for questions.

## Simple Migration Plan

### Replace 3 Files

#### 1. `simple-agent.ts` - Main execution flow

**Replace Langchain graph with simple tool calls:**

```typescript
// Remove: import { app } from "../agent/graph"
// Add tool imports

async function* createFormAgent(params, userId) {
  // 1. Create form metadata + journey
  const metadataResult = await generateObject({
    model: openai("gpt-4o"),
    schema: FormMetadataSchema,
    prompt: `Create form metadata for: ${params.prompt}`,
  });

  yield metadataEvent;

  // 2. Generate questions (parallel if needed)
  const questionPromises = metadataResult.questions.map((q, i) =>
    generateObject({
      model: openai("gpt-4o"),
      schema: QuestionSchema,
      prompt: `Generate question ${i + 1}: ${q.title}`,
    }),
  );

  const questions = await Promise.all(questionPromises);
  yield questionEvents;

  // 3. Finalize
  const finalResult = await finalizeForm(metadataResult, questions);
  yield finalEvent;
}
```

#### 2. `graph.ts` → `form-tools.ts` - Convert to tools

**Replace StateGraph with 3 tool functions:**

```typescript
// Remove all StateGraph imports and complexity
// Replace with simple tools:

export async function createFormMetadata(prompt: string) {
  return await generateObject({
    model: openai("gpt-4o"),
    schema: z.object({
      title: z.string(),
      description: z.string(),
      journey: z.string(),
      questions: z.array(
        z.object({
          title: z.string(),
          type: z.string(),
        }),
      ),
    }),
    prompt: `Analyze this input and create form structure: ${prompt}`,
  });
}

export async function createQuestion(questionSpec: any) {
  return await generateObject({
    model: openai("gpt-4o"),
    schema: QuestionSchema, // existing schema
    prompt: `Generate complete question: ${questionSpec.title}`,
  });
}

export async function finalizeForm(metadata: any, questions: any[]) {
  // Same logic as current finalizer.ts
}
```

#### 3. `finalizer.ts` - Remove Langchain types only

**Minimal changes - just remove Langchain imports:**

```typescript
// Remove:
- import { BaseMessage } from "@langchain/core/messages"
- import { RunnableConfig } from "@langchain/core/runnables"

// Replace with:
interface Message {
  content: string;
  role: string;
}

// Update function signature:
- messages: BaseMessage[]
+ messages: Message[]

- config?: RunnableConfig
+ config?: Record<string, any>

// Replace method call:
- type: msg._getType(),
+ type: msg.role,
```

## Keep Parallel Processing

**Current parallel logic (graph.ts:287-291):**

```typescript
const results = await Promise.all(
  mappedInputs.map((singleInput) =>
    processSingleTaskNode(singleInput as AgentState),
  ),
);
```

**New parallel logic:**

```typescript
const questionResults = await Promise.all(
  questionSpecs.map((spec, index) => createQuestion(spec, index)),
);
```

## File Changes Summary

| File              | Current             | New               | Changes                 |
| ----------------- | ------------------- | ----------------- | ----------------------- |
| `simple-agent.ts` | Uses `app.stream()` | Direct tool calls | Replace graph execution |
| `graph.ts`        | Complex StateGraph  | `form-tools.ts`   | 3 simple tool functions |
| `finalizer.ts`    | Langchain types     | Native types      | Remove imports only     |

## Benefits

- **Simpler**: 3 tool calls vs complex StateGraph
- **Same performance**: Keep parallel question generation
- **Less code**: Remove ~200 lines of graph complexity
- **No dependencies**: Remove @langchain packages

## Implementation Steps

1. **Create `form-tools.ts`** with 3 functions
2. **Update `simple-agent.ts`** to use tools directly
3. **Remove Langchain types** from `finalizer.ts`
4. **Remove graph.ts** and Langchain packages
5. **Test parallel question generation** works same way

This keeps your current parallel optimization while removing all Langchain complexity.
