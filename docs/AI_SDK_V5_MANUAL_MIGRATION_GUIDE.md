# AI SDK v4 to v5 Manual Migration Guide

This document outlines all the manual changes required after running the AI SDK v4 to v5 migration codemod. These changes were necessary to complete the migration in a real-world Next.js application with custom streaming events.

## Overview

While the AI SDK codemod handles basic API changes, several manual interventions are required for:

- Custom data streaming
- Provider compatibility
- Message format handling
- Type validation
- Stream processing

---

## 1. Package Updates

### Core Packages

```bash
pnpm add ai@latest                    # v4.3.16 → v5.0.22
pnpm add @ai-sdk/react@latest         # v1.2.12 → v2.0.22
pnpm add @openrouter/ai-sdk-provider@latest  # Update to v2 model spec support
```

### Why Manual?

- Codemod doesn't update package.json
- Provider packages need separate updates for v2 model specification compatibility
- React hooks package has breaking changes

---

## 2. Stream Response API Changes

### Before (v4)

```typescript
return createDataStreamResponse({
  execute: async (dataStream) => {
    // stream logic
    result.mergeIntoUIMessageStream(dataStream);
  },
});
```

### After (v5)

```typescript
const stream = createUIMessageStream({
  execute: async ({ writer }) => {
    // stream logic
    writer.merge(result.toUIMessageStream());
  },
});

return createUIMessageStreamResponse({ stream });
```

### Manual Changes Required

1. Replace `createDataStreamResponse` → `createUIMessageStream`
2. Change parameter from `dataStream` → `{ writer }`
3. Replace `mergeIntoUIMessageStream()` → `writer.merge(result.toUIMessageStream())`
4. Wrap with `createUIMessageStreamResponse({ stream })`
5. Add both imports: `createUIMessageStream, createUIMessageStreamResponse`

---

## 3. Custom Data Streaming Format

### Before (v4)

```typescript
dataStream.write({
  type: "data",
  value: [{ type: eventType, payload }],
});
```

### After (v5)

```typescript
writer.write({
  type: `data-${eventType}`,
  ...payload, // spread properties directly
});
```

### Manual Changes Required

1. Replace nested `{type: 'data', value: [...]}` structure
2. Use `data-` prefix for custom event types
3. Spread payload properties directly instead of nesting
4. Update DataStream interface to allow flexible types

### Interface Updates

```typescript
// Before
interface DataStream {
  write: (data: { type: "data"; data: unknown }) => void;
}

// After
interface DataStream {
  write: (data: { type: string; [key: string]: unknown }) => void;
}
```

---

## 4. Chat Hook API Changes

### Before (v4)

```typescript
const { messages, append, status } = useChat({
  // config
});

await append({ role: "user", content: message });
```

### After (v5)

```typescript
const { messages, sendMessage, status } = useChat({
  // config
});

await sendMessage({
  parts: [{ type: "text", text: message }],
});
```

### Manual Changes Required

1. Replace `append` → `sendMessage` in destructuring
2. Change call signature to use `parts` array format
3. Update dependency arrays in useEffect/useCallback
4. Handle request-specific options as second parameter

### With Options

```typescript
// v5 format with custom body data
await sendMessage(
  { parts: [{ type: "text", text: message }] },
  { body: { formId, userId, selectedModel } },
);
```

---

## 5. Message Format Conversion

### Issue

Frontend sends v5 format with `parts` array, but backend expects `content` string.

### Solution

Add conversion layer in API routes:

```typescript
// Handle both formats when saving messages
const messageToSave = {
  ...lastMessage,
  content:
    lastMessage.content ||
    lastMessage.parts?.find((p) => p.type === "text")?.text ||
    "",
};
```

### Manual Changes Required

1. Add `convertToModelMessages` import
2. Convert UIMessages before passing to `streamText`:
   ```typescript
   messages: convertToModelMessages(messages);
   ```
3. Handle both old and new message formats in save logic

---

## 6. Provider Model Specification

### Error Encountered

```
AI_UnsupportedModelVersionError: Unsupported model version v1 for provider "openrouter.chat"
and model "openai/gpt-4o". AI SDK 5 only supports models that implement specification version "v2".
```

### Solution

Update provider packages to support v2 model specification:

```bash
pnpm add @openrouter/ai-sdk-provider@latest
```

### Manual Changes Required

- Check all provider packages for v2 compatibility
- Update provider packages separately from core AI SDK
- Test model initialization after provider updates

---

## 7. Type Validation Errors

### Custom Stream Events

AI SDK v5 has strict type validation that rejects non-standard stream formats.

### Before (Invalid)

```typescript
writer.write({
  type: "data",
  data: { type: "custom_event", payload },
});
```

### After (Valid)

```typescript
writer.write({
  type: "data-custom_event",
  payload,
});
```

### Manual Changes Required

1. All custom events must use `data-` prefix
2. Remove nested `data` wrapper objects
3. Spread event properties at root level
4. Update frontend parsing to handle new format

---

## 8. Configuration Parameter Changes

### maxOutputTokens Error

```
'maxOutputTokens' does not exist in type 'CallSettings'
```

### Solution

Check AI SDK v5 documentation for updated parameter names. Some common changes:

- `maxOutputTokens` → `maxTokens` (verify in docs)
- Parameter restructuring in streamText options

---

## 9. Development Environment

### Cache Clearing Required

After package updates, clear build caches:

```bash
rm -rf .next
pnpm dev  # restart dev server
```

### Why Manual?

- Next.js caches compiled modules
- AI SDK version changes require cache invalidation
- Type checking updates need server restart

---

## 10. Testing Validation

### Verify Stream Events

1. Check browser Network tab for proper streaming responses
2. Verify custom `data-` prefixed events are received
3. Test message sending with new `sendMessage` API
4. Confirm model responses are generated

### Common Issues

- Empty API responses → Check message format conversion
- Stream parsing errors → Verify `data-` prefix usage
- Type validation failures → Check parameter names
- Model version errors → Update provider packages

---

## 11. OpenAI Structured Output Schema Validation

### Issue Discovered

After completing the basic AI SDK v5 migration, form generation failed with OpenAI schema validation errors:

```
Invalid schema for response_format 'response': In context=('properties', 'styling'), 'required' is required to be supplied and to be an array including every key in properties. Missing 'colSpan'.
```

### Root Cause

OpenAI's structured output API (`generateObject`) requires ALL object properties to be explicitly marked as **required** in the JSON Schema. Zod's optional fields with defaults are not automatically marked as required during JSON Schema serialization.

### Schema Issues Found

1. **colSpan field** - Optional with default, but needed to be required
2. **score field** - Optional in OptionSchema, but needed to be required
3. **min/step fields** - Default values preventing required marking

### Manual Schema Fixes Required

#### 1. Fix colSpan Field

```typescript
// Before (caused validation error)
styling: z
  .object({ colSpan: z.number().int().min(1).max(12).default(12) })
  .default({ colSpan: 12 }),

// After (required field with object-level default)
styling: z
  .object({ colSpan: z.number().int().min(1).max(12) })
  .default({ colSpan: 12 }),
```

#### 2. Fix score Field in OptionSchema

Schema had duplicate definitions that both needed fixing:

**packages/schema/src/index.ts:**

```typescript
// Before
export const OptionSchema = z.object({
  value: z.string(),
  label: z.string(),
  score: z.number().optional(), // ❌ Caused validation error
});

// After
export const OptionSchema = z.object({
  value: z.string(),
  label: z.string(),
  score: z.number(), // ✅ Required field
});
```

**packages/schema/src/question-types.ts:**

```typescript
// Before
const OptionSchema = z.object({
  value: z.string(),
  label: z.string(),
  score: z.number().optional(), // ❌ Also needed fixing
});

// After
const OptionSchema = z.object({
  value: z.string(),
  label: z.string(),
  score: z.number(), // ✅ Required field
});
```

#### 3. Fix Config Schema Defaults

Rating and LinearScale configs had similar issues:

```typescript
// Before (caused "Missing 'min'" errors)
export const RatingConfigSchema = z.object({
  min: z.number().int().default(1), // ❌ Default prevented required
  max: z.number().int().positive(),
  step: z.number().int().positive().default(1), // ❌ Default prevented required
  minLabel: z.string().optional(),
  maxLabel: z.string().optional(),
});

// After (all non-optional fields marked as required)
export const RatingConfigSchema = z.object({
  min: z.number().int(), // ✅ Required, no default
  max: z.number().int().positive(),
  step: z.number().int().positive(), // ✅ Required, no default
  minLabel: z.string().optional(),
  maxLabel: z.string().optional(),
});
```

### Why This Happens

1. **Zod defaults ≠ JSON Schema required**: Zod fields with `.default()` are treated as optional in JSON Schema
2. **OpenAI strict validation**: `generateObject` requires explicit required arrays for all object properties
3. **Multiple schema definitions**: Same schemas defined in multiple files needed consistent fixes

### Manual Steps Required

1. **Identify all schema files** with structured output usage
2. **Remove `.default()` from required fields** in Zod schemas
3. **Apply defaults at object level** instead of field level when needed
4. **Fix duplicate schema definitions** (check both index.ts and question-types.ts)
5. **Rebuild schema packages** after changes
6. **Restart development server** to load updated schemas

### Build and Test Process

```bash
# After schema changes, always:
pnpm --filter @formlink/schema build  # Rebuild schema package
# Kill and restart dev server (schema changes require restart)
pnpm run dev
```

### Validation Process

- **Before**: Form generation failed with `Invalid schema` errors
- **After**: OpenAI successfully generates structured JSON matching schema
- **Test**: Verify `question_schema_generated` events appear in logs

### Files Modified for Schema Fixes

- `packages/schema/src/index.ts` - OptionSchema, RatingConfigSchema, LinearScaleConfigSchema, QuestionSchema styling field
- `packages/schema/src/question-types.ts` - Local OptionSchema, RatingQuestionSchema config, LinearScaleQuestionSchema config

---

## Summary

The AI SDK v4 to v5 migration requires extensive manual intervention beyond what the codemod provides:

### Codemod Handles

- Basic API renames
- Import statement updates
- Simple parameter changes

### Manual Required

1. **Package Updates** - Update all AI SDK and provider packages
2. **Stream Architecture** - Complete rewrite of streaming response handling
3. **Custom Events** - Restructure all custom data streaming with `data-` prefix
4. **Message Formats** - Handle UIMessage to ModelMessage conversion
5. **Chat Hooks** - Replace `append` with `sendMessage` and new format
6. **Type System** - Fix interface definitions and parameter types
7. **Provider Compatibility** - Ensure v2 model specification support
8. **Environment** - Clear caches and restart development server
9. **Schema Validation** - Fix Zod schemas for OpenAI structured output compatibility

### Recommendation for Vercel/AI SDK Team

Consider expanding the codemod to handle:

- Custom streaming events with automatic `data-` prefix conversion
- Provider package compatibility checks
- Message format conversion utilities
- Development environment cache clearing instructions
- Zod schema validation for OpenAI structured output (warn about `.default()` usage)

This would significantly reduce the manual migration burden for applications using advanced AI SDK features.

---

## Files Modified in This Migration

### Backend API Routes

- `app/api/chat/handlers/form-creation.ts` - Stream response architecture, message conversion
- `app/lib/chat/services/chat-service.ts` - Custom event streaming format
- `app/dashboard/forms/[formId]/lib/chat/services/chat-service.ts` - Stream interface updates

### Frontend Components

- `app/dashboard/forms/[formId]/components/chat/ChatPanel.tsx` - useChat API, sendMessage format

### Chat Tools (9 files)

All chat tools required custom data streaming format updates:

- `app/lib/chat/tools/*.ts`
- `app/dashboard/forms/[formId]/lib/chat/tools/*.ts`

### Package Configuration

- `package.json` - All AI SDK related packages updated

Total: **15+ files** required manual changes beyond codemod output.
