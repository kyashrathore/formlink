# AI Elements Porting Plan - FormCraft Chat

## Current State Analysis

### FormCraft Chat Implementation
The FormCraft AI chat currently uses custom chat components and has not been ported to AI elements yet. Key files:

1. **ChatPanel.tsx** - Main chat interface component
   - Uses `useChat` from AI SDK v5
   - Custom message rendering with `MessageWithParts` component
   - Handles tool invocations and parts properly
   - Already using AI SDK v5 message format

2. **MessageWithParts.tsx** - Custom message renderer
   - Handles text parts, tool parts, step-start parts
   - Complex logic for tool state management
   - Custom styling for different message types

3. **Chat.tsx** - Input component wrapper
   - Uses `ChatInput` component (custom)
   - Model selection functionality
   - Basic text input handling

4. **ChatInput** - Custom input component (referenced but not seen)
   - File upload support
   - Model selection
   - System prompt selection

### FormFiller Success (Reference Implementation)
The FormFiller app was successfully ported and shows:
- Clean AI elements integration
- Proper message content extraction from `message.parts`
- File upload support through AI elements
- Minimal custom code needed

## Porting Strategy

### Phase 1: Replace Message Components
**Goal**: Replace custom `MessageWithParts` with AI elements message components

**Files to modify**:
- `ChatPanel.tsx` - Replace message rendering
- Create new `conversation_v3.tsx` component (following FormFiller pattern)

**Steps**:
1. Create new conversation component using AI elements:
   ```tsx
   import {
     Conversation,
     ConversationContent,
     Message,
     MessageContent,
   } from "@formlink/ui/ai-elements";
   ```

2. Extract text content from `message.parts` (learned from FormFiller fix):
   ```tsx
   const textPart = message.parts?.find((p: any) => p.type === "text") as any;
   const userText = textPart?.text || (message as any).content || "";
   ```

3. Handle tool invocation display in assistant messages
4. Preserve existing tool state management logic

### Phase 2: Replace Input Components
**Goal**: Replace custom `ChatInput` with AI elements prompt input

**Files to modify**:
- `chat.tsx` - Replace input component
- Remove custom `ChatInput` dependencies

**Steps**:
1. Use AI elements prompt input:
   ```tsx
   import {
     PromptInput,
     PromptInputTextarea,
     PromptInputToolbar,
     PromptInputTools,
     PromptInputSubmit,
   } from "@formlink/ui/ai-elements";
   ```

2. Migrate file upload functionality
3. Preserve model selection (may need custom solution)
4. Preserve system prompt selection

### Phase 3: Integration & Testing
**Goal**: Ensure feature parity and fix any issues

**Tasks**:
1. Test message display for all types (text, tools, errors)
2. Test file uploads
3. Test model selection
4. Test form generation flow
5. Test chat history persistence
6. Test error handling and retries

## Key Differences from FormFiller

### Complex Tool Management
FormCraft has more complex tool invocation handling:
- Multiple tool types (create-form, update-form, get-form-context, show-config)
- Tool success/failure states with visual feedback
- Tool progress indicators
- Summary messages from events

### Model Selection
FormCraft allows runtime model selection, which AI elements may not support directly. Options:
1. Keep model selection as custom UI outside AI elements
2. Extend AI elements to support model selection
3. Use system prompt approach for model hints

### File Upload Integration
FormCraft's file upload may be more complex than FormFiller's. Need to analyze:
- File types supported
- Upload endpoints
- Integration with form generation

### Event System Integration
FormCraft uses complex event bridging:
- `FormGenerationEventHandler`
- `useFormGenerationEventBridge`
- Agent events and state management

This needs to be preserved during the port.

## Implementation Plan

### Step 1: Create Conversation Component
```bash
# Create new conversation component
apps/formcraft/app/dashboard/forms/[formId]/components/chat/conversation_v3.tsx
```

### Step 2: Update ChatPanel
```bash
# Update ChatPanel to use new conversation component
apps/formcraft/app/dashboard/forms/[formId]/components/chat/ChatPanel.tsx
```

### Step 3: Update Chat Input
```bash
# Update chat input component
apps/formcraft/app/dashboard/forms/[formId]/components/chat/chat-components/chat.tsx
```

### Step 4: Testing & Refinement
1. Test in development environment
2. Compare with current functionality
3. Fix any missing features
4. Update related components if needed

## Risks & Considerations

### Complexity Risk
FormCraft's chat is more complex than FormFiller's:
- Multiple tool types with different states
- Event system integration
- Model selection
- Complex message history handling

### Feature Loss Risk
Potential features that might be lost:
- Advanced tool state visualization
- Model selection UI
- Custom error handling
- Summary message display

### Performance Risk
AI elements may have different performance characteristics than custom components.

## Success Criteria

1. **Feature Parity**: All existing chat features work identically
2. **UI Consistency**: Messages display correctly with proper styling
3. **Tool Handling**: All tool invocations display proper states
4. **File Upload**: File upload works for form generation
5. **Model Selection**: Users can still select different models
6. **Error Handling**: Errors display properly with retry functionality
7. **Chat History**: Message persistence works across sessions

## Rollback Plan

If porting fails or introduces issues:
1. Keep existing components as `*_legacy.tsx`
2. Feature flag the new implementation
3. Easy rollback to legacy components
4. Incremental rollout to test users first

## Timeline Estimate

- **Phase 1**: 4-6 hours (message components)
- **Phase 2**: 3-4 hours (input components)  
- **Phase 3**: 3-5 hours (integration & testing)
- **Total**: ~10-15 hours

## Next Steps

1. Start with Phase 1 - create conversation component
2. Test message display thoroughly
3. Move to input component replacement
4. Comprehensive integration testing
5. Deploy behind feature flag for gradual rollout