# FormCraft Comprehensive Specification v1

## Implementation Status

### ✅ UI Layout Prototype Complete

**Test Route**: `/test-ui` - Fully functional UI layout implementation ready for reuse

The complete UI layout system has been implemented and validated at `/apps/formcraft/app/test-ui/` with:

- **Two-column resizable layout** with CSS Grid
- **Panel state management** (expanded/collapsed/hidden)
- **Floating panel mode** with drag functionality
- **Tab switching** for both chat panel and main content
- **State machine validation** preventing dual panel bugs
- **Smooth transitions** and responsive design
- **Barebone test components** for programmatic testing

**Next Steps**: This layout can now be integrated into the main FormCraft application by replacing placeholder components with real functionality.

## Current Implementation Limitations

### Feature Flags Required

Due to current system limitations, several features are **hardcoded behind feature flags**:

#### 🚧 `ENABLE_DESIGN_UPDATES`

- **Design tab functionality** - Theme/color customization
- **Live preview updates** - Real-time design changes
- **Theme persistence** - Backend storage for design settings

#### 🚧 `ENABLE_LIVE_PREVIEW`

- **Interactive preview modes** - Chat Mode & Conversation Mode
- **Form simulation** - AI-guided or TypeForm-style interactions
- **Dynamic form rendering** - Real-time form state changes

### Current Working Implementation

✅ **What works now:**

- **Two-column resizable layout** with panel state management
- **Chat/Design tab switching** (Design tab shows static controls)
- **Floating panel mode** with drag functionality
- **Existing form tab implementation** - Uses current system's form editing interface
- **Navigation between Form/Responses/Share tabs**
- **Panel collapse/expand** based on active tab

✅ **Form editing approach:**

- **Reuse existing form tab** from current FormCraft system
- **Proven editing interface** - Already functional and tested
- **Future enhancement** - Conversation mode will provide exact preview that's editable

---

# FormCraft UI/UX Specification

## Layout Architecture

### Primary Layout

- **Type**: Two-column layout
- **Left Panel**: Chat/Design panel (default 400px, resizable 300px-600px)
- **Right Panel**: Main content area (flexible width)
- **Height**: Full viewport (100vh)

### Panel States

| Tab Active | Chat Panel State |
| ---------- | ---------------- |
| Form       | Expanded (400px) |
| Responses  | Collapsed (40px) |
| Share      | Hidden (0px)     |

## Components

### 1. Chat Panel

#### Structure

```
┌─────────────────────┐
│ [Chat] [Design]  [⇗]│ <- Header with tabs and detach button
├─────────────────────┤
│                     │
│ Tab Content Area    │
│                     │
├─────────────────────┤
│ Input Area          │ <- Only in Chat tab
└─────────────────────┘
```

#### Chat Tab

- Message list with alternating user/AI messages
- Auto-scroll to latest message
- Text input with send button
- Enter to send, Shift+Enter for new line

#### Design Tab

**🚧 FEATURE FLAG REQUIRED: `ENABLE_DESIGN_UPDATES`**

- Theme preset selector (radio buttons)
- Color pickers for background, text, accent
- Font family dropdown
- Spacing slider
- ⚠️ **Live preview updates disabled** - No system support for design updates yet

#### Floating Mode

- Detach button (⇗) in header
- Draggable by header area
- Semi-transparent background
- Maintains resize capability
- Dock button to return to sidebar

### 2. Main Content Area

#### Navigation Bar

```
[Form] [Responses] [Share]                    [Save Form] [Publish ↗]
```

- Left: Main navigation tabs
- Right: Action buttons
- Save shows last saved time on hover
- Publish button with external icon

#### Action Buttons Behavior

- **Save Form**:
  - Click to save draft
  - Shows "Saving..." then "Saved" with timestamp
  - Auto-save indicator when active
- **Publish**:
  - Click opens publish modal/dropdown
  - Shows current publish status
  - Green when published, gray when draft

### 3. Form Tab Content

#### Sub-navigation

```
Preview Mode: [Chat Mode] [Conversation]    Edit Mode [Toggle]
```

#### Preview Area States

**Edit Mode ON**

- Click text to edit inline
- Hover shows edit cursor
- Visual edit indicators

**Edit Mode OFF (Preview)**

- Read-only interaction
- Test form as end-user
- No edit capabilities

**When Design Tab Active** (Feature Flagged)

- ⚠️ **Behind `ENABLE_DESIGN_UPDATES` flag**
- Forced preview mode
- "Design Mode Active" indicator
- Edit toggle disabled

### 4. Form Preview Modes

**🚧 FEATURE FLAG REQUIRED: `ENABLE_LIVE_PREVIEW`**

#### Current Implementation (Default)

- **Existing form tab interface** - Reuses current FormCraft form editing system
- **Proven editing experience** - Established UX for form building
- **Complete form management** - All existing form editing capabilities
- **No simulation modes** - Pure editing interface focused on building

#### Future Chat Mode (Feature Flagged)

- Simulates AI-guided form filling
- Chat interface for responses
- Progress indicator
- No visible form fields

#### Future Conversation Mode (Feature Flagged)

- **Exact preview simulation** - Shows form as end-users will see it
- **One question per screen** - TypeForm-style interaction
- **Editable in preview** - Click to edit questions while previewing
- **Large centered question** with proper styling
- **Navigation controls** - Previous/Continue buttons
- **Progress indicators** - Visual progress bar

### 5. Responses Tab

#### Layout

```
┌──┬────────────────────────────────────────┐
│AI│   Analytics Dashboard    [Export ↓]     │
└──┴────────────────────────────────────────┘
```

- Collapsed chat panel (40px)
- Export button in top right
- Response metrics
- Data table
- Charts/graphs

### 6. Share Tab

#### Layout (Full Width)

```
┌─────────────┬──────────────┐
│ Embed Types │ Live Preview │
│ ○ Popup     │              │
│ ● Inline    │  [Preview]   │
│ ○ Slider    │              │
│             │              │
│ [Copy Code] │              │
│ [Test Link] │              │
└─────────────┴──────────────┘
```

- No chat panel visible
- Embed option selector
- Preview updates per selection
- Copy functionality
- Test link generator

## Interaction Flows

### Panel Management Flow

1. User on Form tab → Chat visible
2. Switch to Responses → Panel auto-collapses
3. Switch to Share → Panel hidden
4. Return to Form → Panel restored

### Design Mode Flow (Feature Flagged)

**🚧 REQUIRES: `ENABLE_DESIGN_UPDATES` flag**

1. Click Design tab → Preview locks
2. Select theme → ⚠️ No live updates (not implemented)
3. Adjust settings → ⚠️ No live preview (not implemented)
4. Click Chat tab → Preview unlocks

### Form Building Flow

1. Chat with AI about form
2. **Use existing form editing interface** - Reuses current FormCraft system
3. **Edit with proven UX** - Established form building experience
4. ⚠️ **Preview modes behind `ENABLE_LIVE_PREVIEW` flag** - Future: exact editable preview
5. Save draft periodically
6. Publish when ready
7. View responses in analytics
8. Generate embed code

### Save/Publish Flow

1. Make changes → Save button enables
2. Click Save → "Saving..." → "Saved at 2:34 PM"
3. Auto-save every 30 seconds if changes exist
4. Click Publish → Confirmation/options modal
5. After publish → Button shows "Published" state

## Responsive Behaviors

### Resize Handle

- Vertical line between panels
- Hover shows resize cursor
- Drag to adjust width
- Constraints: 300px min, 600px max

### Panel Transitions

- Collapse: 300ms ease-out
- Expand: 300ms ease-in
- Smooth width animations
- Content reflow without jumps

### Floating Panel

- Absolute positioning
- Z-index above content
- Drop shadow for depth
- Constrained to viewport

## States & Feedback

### Loading States

- AI typing indicator in chat
- Skeleton screens for data
- Progress bars for actions
- Save/Publish button loading states

### Interactive States

- Hover: Subtle highlight
- Active: Clear selection
- Disabled: Reduced opacity
- Focus: Visible outline

### Save States

- **Unsaved**: "Save Form" (normal)
- **Saving**: "Saving..." (loading)
- **Saved**: "Saved" with timestamp
- **Error**: "Save Failed - Retry"

### Publish States

- **Draft**: "Publish" (gray)
- **Publishing**: "Publishing..." (loading)
- **Published**: "Published" (green)
- **Update Available**: "Update" (when saved changes exist)

### User Feedback

- Toast notifications for actions
- Inline validation messages
- Success/error states
- Transition animations

## Content Behavior

### Form Preview

- **Existing FormCraft form editing** - Reuses current proven interface
- **Established editing patterns** - Familiar UX for form building
- **Complete form management** - All current editing capabilities
- Maintains state during tab switches
- ⚠️ **Future: Exact preview modes behind `ENABLE_LIVE_PREVIEW` flag**
- ⚠️ **Design changes sync behind `ENABLE_DESIGN_UPDATES` flag**

### Data Persistence

- Panel size saved
- Active tabs remembered
- Preview mode retained
- Design choices stored
- Auto-save drafts
- Publish history

## Edge Cases

### Empty States

- "Start chatting to create a form"
- "No responses yet"
- "Select an embed type"

### Unsaved Changes

- Warning before tab close
- Auto-save indicator
- Dirty state visual cue
- Recover from auto-save

### Constraints

- Minimum panel cannot block content
- Maximum panel leaves preview space
- Floating panel fits in viewport
- Text remains readable at all sizes
- Action buttons always visible

---

# Implementation Plan

## Executive Summary

This document outlines the implementation plan for transforming the FormCraft application to match the UI/UX specification. The plan leverages the existing sophisticated architecture while implementing the required two-column resizable layout with integrated chat/design panels.

**Current State**: Single-view form editor with floating AgentInteractionPanel
**Target State**: Two-column layout with resizable panels, integrated chat/design interface, and enhanced form preview modes

## Architecture Analysis

### Existing Strengths to Leverage

1. **Sophisticated AgentInteractionPanel**: Real-time chat with AI streaming, event-driven architecture
2. **Comprehensive UI Library**: @formlink/ui with 40+ components, unified form system
3. **Modern State Management**: Zustand with Immer, event-driven updates
4. **Responsive Design**: Mobile-first patterns with conditional rendering
5. **Type Safety**: Full TypeScript coverage with strict configuration

### Components to Refactor

1. **Current Layout**: `FormPageClient.tsx` - Single-view with floating panel
2. **Sidebar Navigation**: `Sidebar.tsx` - Custom tabbed interface
3. **AgentInteractionPanel**: Floating chat interface needs integration
4. **FormEditor**: Existing form editing needs preview mode enhancements

## Implementation Phases

### Phase 1: Core Layout Architecture (Priority: High)

#### 1.1 Create Two-Column Layout System

**File**: `apps/formcraft/app/dashboard/forms/[formId]/components/TwoColumnLayout.tsx`

**Description**:
This component will replace the current single-view layout with a resizable two-column system. It will manage the overall layout structure and panel state transitions.

**Key Features**:

- Left panel: Default 400px, resizable 300px-600px
- Right panel: Flexible width (100% - left panel width)
- Full viewport height (100vh)
- Resize handle with drag constraints
- Smooth transitions (300ms ease-in/out)

**Implementation Strategy**:

- Use CSS Grid for column layout
- Implement resize handle with pointer events
- Add panel state management for expand/collapse/hide
- Store panel width preferences in localStorage

#### 1.2 Implement Resize Handle Component

**File**: `apps/formcraft/app/dashboard/forms/[formId]/components/ResizeHandle.tsx`

**Description**:
Interactive resize handle positioned between panels that allows users to adjust the width of the left panel within defined constraints.

**Key Features**:

- Vertical divider with hover/drag cursor states
- Drag to resize with 300px-600px constraints
- Visual feedback during resize operation
- Smooth transitions when constraints are reached

### Phase 2: Chat/Design Panel Integration (Priority: High)

#### 2.1 Create Chat/Design Panel Container

**File**: `apps/formcraft/app/dashboard/forms/[formId]/components/ChatDesignPanel.tsx`

**Description**:
This component will house the tabbed interface for Chat and Design functionality. It will integrate the existing AgentInteractionPanel logic into a sidebar format.

**Key Features**:

- Header with Chat/Design tabs and detach button (⇗)
- Tab content area with conditional rendering
- Input area (Chat tab only)
- Integration with existing chat state management
- Floating mode capability

**Implementation Strategy**:

- Extract core chat logic from AgentInteractionPanel
- Reuse existing chat state management
- Add tab switching logic
- Implement detach/dock functionality

#### 2.2 Adapt Existing Chat Functionality

**File**: `apps/formcraft/app/dashboard/forms/[formId]/components/ChatPanelContent.tsx`

**Description**:
Extract and adapt the existing AgentInteractionPanel functionality for use within the new sidebar structure while maintaining all current capabilities.

**Key Features**:

- Message list with auto-scroll
- Real-time AI streaming
- Event-driven updates
- Error handling and loading states
- Mobile-responsive behavior

**Implementation Strategy**:

- Preserve existing chat logic from AgentInteractionPanel
- Remove floating positioning styles
- Adapt for sidebar container
- Maintain all event processing functionality

#### 2.3 Implement Design Tab (Feature Flagged)

**🚧 FEATURE FLAG: `ENABLE_DESIGN_UPDATES`**

**File**: `apps/formcraft/app/dashboard/forms/[formId]/components/DesignPanel.tsx`

**Description**:
New component for theme customization and form styling. **Currently behind feature flag** due to lack of live preview system support.

**Key Features**:

- Theme preset selector (radio buttons)
- Color pickers for background, text, accent colors
- Font family dropdown
- Spacing slider controls
- ⚠️ **Live preview updates disabled** - No system support yet
- Reset to default functionality

**Implementation Strategy**:

- Use existing @formlink/ui color picker components
- ⚠️ **Theme state management pending** - Backend support needed
- ⚠️ **Live preview event system not implemented**
- ⚠️ **Form theme persistence not available**

### Phase 3: Main Content Area Enhancement (Priority: High)

#### 3.1 Create Navigation Bar Component

**File**: `apps/formcraft/app/dashboard/forms/[formId]/components/NavigationBar.tsx`

**Description**:
Top navigation bar for the main content area with tab navigation and action buttons.

**Key Features**:

- Left side: Form/Responses/Share tabs
- Right side: Save Form/Publish buttons
- Save button states (Unsaved, Saving, Saved with timestamp, Error)
- Publish button states (Draft, Publishing, Published, Update Available)
- Auto-save indicators

**Implementation Strategy**:

- Replace current Sidebar.tsx navigation
- Implement save/publish state management
- Add auto-save functionality (30-second intervals)
- Create button state visual feedback system

#### 3.2 Create Tab Content Manager

**File**: `apps/formcraft/app/dashboard/forms/[formId]/components/TabContentManager.tsx`

**Description**:
Manages the rendering of content based on active tab (Form/Responses/Share) and handles panel state changes.

**Key Features**:

- Form tab: Preview modes and edit toggle
- Responses tab: Analytics dashboard
- Share tab: Embed options and preview
- Panel state management per tab
- Content preservation during tab switches

### Phase 4: Form Preview Mode Enhancement (Priority: Medium)

#### 4.1 Implement Preview Mode Toggle

**File**: `apps/formcraft/app/dashboard/forms/[formId]/components/PreviewModeToggle.tsx`

**Description**:
Toggle system for switching between Edit and Preview modes within the Form tab.

**Key Features**:

- Edit Mode: Inline editing capabilities
- Preview Mode: Read-only form testing
- Design Mode: Forced preview when Design tab is active
- Visual indicators for current mode
- Keyboard shortcuts for quick switching

#### 4.2 Create Form Preview Modes (Feature Flagged)

**🚧 FEATURE FLAG: `ENABLE_LIVE_PREVIEW`**

**File**: `apps/formcraft/app/dashboard/forms/[formId]/components/FormPreviewModes.tsx`

**Description**:
Future implementation for Chat Mode and Conversation Mode. **Currently shows static scrollable question list**.

**Current Implementation**:

- **Existing FormCraft form interface** - Reuses current system's proven form editing
- **Complete form management** - All existing editing capabilities available
- **Established UX patterns** - Familiar interface for form building
- **No preview simulation** - Pure editing mode focused on building

**Future Features (Feature Flagged)**:

- Chat Mode: AI-guided form filling simulation
- **Conversation Mode**: Exact preview simulation with editable-in-preview capability
- **Editable preview** - Click to edit questions while seeing exact end-user view
- Progress indicators and navigation controls
- State preservation between modes

### Phase 5: Panel State Management (Priority: High)

#### 5.1 Create Panel State Store

**File**: `apps/formcraft/app/dashboard/forms/[formId]/hooks/usePanelState.ts`

**Description**:
Zustand store for managing panel states, sizes, and transitions across the entire interface.

**Key Features**:

- Panel width storage and persistence
- Active tab state management
- Panel visibility states (expanded/collapsed/hidden)
- Transition state management
- localStorage persistence

#### 5.2 Implement Panel Behavior Logic

**File**: `apps/formcraft/app/dashboard/forms/[formId]/hooks/usePanelBehavior.ts`

**Description**:
Custom hook that manages panel behavior based on active tab and user interactions.

**Key Features**:

- Form tab: Panel expanded (400px)
- Responses tab: Panel collapsed (40px)
- Share tab: Panel hidden (0px)
- Smooth transitions between states
- Constraint handling and validation

### Phase 6: Advanced Features (Priority: Medium)

#### 6.1 Implement Floating Panel Mode

**File**: `apps/formcraft/app/dashboard/forms/[formId]/components/FloatingPanel.tsx`

**Description**:
Detachable floating panel that can be dragged around the viewport while maintaining full functionality.

**Key Features**:

- Detach from sidebar with header button
- Draggable by header area
- Semi-transparent background
- Maintains resize capability
- Dock button to return to sidebar
- Viewport boundary constraints

#### 6.2 Create Responses Tab Content

**File**: `apps/formcraft/app/dashboard/forms/[formId]/components/ResponsesTab.tsx`

**Description**:
Analytics dashboard for form responses with collapsed chat panel integration.

**Key Features**:

- Collapsed AI panel (40px width)
- Export functionality
- Response metrics display
- Data visualization
- Filtering and sorting capabilities

#### 6.3 Implement Share Tab Content

**File**: `apps/formcraft/app/dashboard/forms/[formId]/components/ShareTab.tsx`

**Description**:
Embed code generation and preview system with full-width layout.

**Key Features**:

- Embed type selector (Popup, Inline, Slider)
- Live preview updates
- Code generation and copy functionality
- Test link generation
- Hidden chat panel
- Responsive preview modes

## Technical Implementation Details

### State Management Architecture

#### Panel State Store Structure

```typescript
interface PanelState {
  // Panel dimensions
  leftPanelWidth: number;
  isResizing: boolean;

  // Panel visibility
  panelState: "expanded" | "collapsed" | "hidden";

  // Active tabs
  activeMainTab: "form" | "responses" | "share";
  activeChatTab: "chat" | "design";

  // Floating mode
  isFloating: boolean;
  floatingPosition: { x: number; y: number };

  // Persistence
  persistToStorage: () => void;
  loadFromStorage: () => void;
}
```

#### Integration with Existing Stores

- **formAgentStore**: Maintain existing event-driven chat functionality
- **useFormStore**: Extend with theme/design state management
- **New usePanelState**: Handle UI layout and transitions

### Component Architecture

#### Layout Hierarchy

```
TwoColumnLayout
├── ChatDesignPanel
│   ├── ChatPanelContent (adapted from AgentInteractionPanel)
│   └── DesignPanel (new)
├── MainContentArea
│   ├── NavigationBar
│   └── TabContentManager
│       ├── FormTab (enhanced)
│       ├── ResponsesTab (new)
│       └── ShareTab (new)
└── ResizeHandle
```

#### Responsive Design Strategy

- **Desktop**: Full two-column layout with resizable panels
- **Tablet**: Collapsible left panel with overlay mode
- **Mobile**: Single-column with modal chat interface

### Animation and Transitions

#### Panel Transitions

- **Expand/Collapse**: 300ms ease-in/out
- **Hide/Show**: 300ms ease-in/out with opacity
- **Resize**: Real-time during drag, smooth when released
- **Floating**: Spring animation for detach/dock

#### Performance Considerations

- **Virtualization**: For long chat histories
- **Debouncing**: For resize operations
- **Memoization**: For expensive form renders
- **Code Splitting**: For tab-specific components

## Migration Strategy

### Phase 1: Foundation (Week 1-2)

1. Create core layout components
2. Implement basic panel state management
3. Add resize functionality
4. Migrate existing chat to new panel structure

### Phase 2: Feature Integration (Week 3-4)

1. Add design tab functionality
2. Implement new navigation bar
3. Create tab content management
4. Add preview mode enhancements

### Phase 3: Advanced Features (Week 5-6)

1. Implement floating panel mode
2. Create responses tab content
3. Build share tab functionality
4. Add comprehensive error handling

### Phase 4: Polish and Optimization (Week 7-8)

1. Optimize performance and animations
2. Add comprehensive testing
3. Implement accessibility features
4. Create documentation and examples

## Risk Mitigation

### Technical Risks

1. **State Synchronization**: Careful coordination between existing and new stores
2. **Performance**: Potential layout thrashing during resize operations
3. **Mobile Compatibility**: Complex layouts may need simplified mobile versions
4. **Browser Compatibility**: Ensure CSS Grid and modern features work across targets

### Mitigation Strategies

1. **Gradual Migration**: Implement features incrementally to avoid breaking changes
2. **Feature Flags**: Allow rollback of new features if issues arise
3. **Performance Monitoring**: Track metrics during development
4. **Comprehensive Testing**: Unit, integration, and E2E testing for all new features

## Success Metrics

### User Experience

- **Reduced Clicks**: Easier access to chat and design features
- **Improved Workflow**: Seamless transition between editing and preview modes
- **Better Organization**: Clear separation of concerns in the interface

### Technical Metrics

- **Performance**: No regression in page load or interaction times
- **Accessibility**: WCAG compliance maintained or improved
- **Mobile Experience**: Responsive design works across all device sizes
- **Browser Support**: Consistent experience across modern browsers

## Implementation Timeline

### Week 1-2: Foundation

- ✅ Architecture analysis and planning
- 🔄 Core layout implementation
- 🔄 Panel state management
- 🔄 Resize functionality

### Week 3-4: Feature Integration

- ⏳ Chat panel integration
- ⏳ Design tab creation
- ⏳ Navigation bar implementation
- ⏳ Preview mode enhancements

### Week 5-6: Advanced Features

- ⏳ Floating panel mode
- ⏳ Responses tab content
- ⏳ Share tab functionality
- ⏳ Auto-save implementation

### Week 7-8: Polish and Launch

- ⏳ Performance optimization
- ⏳ Accessibility improvements
- ⏳ Testing and bug fixes
- ⏳ Documentation and deployment

## Conclusion

This implementation plan provides a comprehensive roadmap for transforming the FormCraft application to match the UI/UX specification. By leveraging the existing sophisticated architecture and implementing features incrementally, we can deliver a significantly enhanced user experience while maintaining the robustness and reliability of the current system.

The plan prioritizes high-impact features first, ensures backward compatibility, and provides clear migration strategies for a smooth transition to the new interface design.

---

# Development Workstreams

## Overview

This document provides updated workstreams based on architectural analysis and feedback. Key changes:

- LangChain removal moved to groundwork
- Focused on cross-mode feature parity
- Reordered based on dependencies and impact
- Removed classical form builder (for now)

## Current Architecture Summary

- **UI Framework**: React 19, Next.js 15, Tailwind CSS v4, Shadcn/ui
- **Form Modes**: AI mode (conversational), TypeForm mode (one-at-a-time), Classic mode (all-at-once)
- **Database**: PostgreSQL via Supabase with RLS
- **Current Features**: Basic form creation, AI conversations, webhook integration
- **Critical Gap**: Branching only works in AI mode

## Workstream Ordering & Dependencies

### Phase 0: Authentication Foundation (Weeks 1-4)

#### 0. Better Auth Migration

**Status**: 🔴 Not Implemented | **Timeline**: 3-4 weeks | **Dependencies**: Groundwork

**Critical Migration** - Required for API keys and team features:

**Why Better Auth?**

- **API Key Management**: Native support for Zapier integration requirements
- **Team Features**: Built-in organization and role management
- **Superior Architecture**: Better than current Supabase Auth limitations

**Migration Scope**:

```typescript
// New capabilities needed
interface BetterAuthFeatures {
  apiKeys: {
    generation: "per-organization" | "per-user";
    scoping: string[]; // ["forms:read", "submissions:create"]
    rateLimit: number;
  };
  organizations: {
    members: TeamMember[];
    roles: "owner" | "admin" | "member";
    billing: PolarSubscription;
  };
  sessions: {
    anonymous: boolean;
    multiDevice: boolean;
    apiAccess: boolean;
  };
}
```

**Migration Challenges**:

1. **20+ RLS policies** need conversion to app-level auth
2. **Anonymous user system** requires redesign
3. **Usage tracking** tightly coupled to Supabase
4. **Session invalidation** during migration

**Implementation Plan**:

- Week 1: Setup Better Auth, migrate schema
- Week 2: Convert authentication flows
- Week 3: Replace RLS with middleware
- Week 4: API key system implementation

---

### Phase 1: Core Platform Enhancement (Weeks 5-8)

#### 1. Runtime AI Enhancement & Cross-Mode Branching

**Status**: 🟡 Partially Implemented | **Timeline**: 3-4 weeks | **Dependencies**: Groundwork items

**Key Features for Traditional Modes**:

1. **Quiz Scoring & Results**:

```typescript
// Traditional mode scoring without AI
interface QuizScoring {
  calculateScore(responses: Record<string, any>): number {
    // Sum correct answers based on question metadata
    return questions
      .filter(q => q.metadata?.correctAnswer === responses[q.id])
      .reduce((sum, q) => sum + (q.metadata?.points || 1), 0)
  }

  generateResult(score: number): ResultPage {
    // Use score ranges to determine result
    const ranges = form.settings.scoreRanges
    const result = ranges.find(r => score >= r.min && score <= r.max)
    return result.resultPage
  }
}
```

2. **Calculated/Computed Values**:

```typescript
// JSONata expressions for calculations
interface ComputedField {
  id: string;
  expression: string; // "$sum(responses.expenses)"
  displayFormat: string; // "Total: ${value}"
}

// Works in all modes - evaluated client-side
const total = jsonata(computedField.expression).evaluate(responses);
```

3. **Dynamic Result Pages**:

```typescript
// Template-based results for traditional modes
interface ResultTemplate {
  conditions: Array<{
    expression: string // JSONata
    template: string // Handlebars template
  }>

  generate(responses: Record<string, any>): string {
    const condition = conditions.find(c =>
      jsonata(c.expression).evaluate(responses)
    )
    return handlebars.compile(condition.template)(responses)
  }
}
```

**Cross-Mode Branching** (Critical):

- Currently `<branching_logic>` only works in AI mode
- Implement unified branching compiler (see plan)
- TypeForm: Skip logic to jump questions
- Classic: Dynamic sections that show/hide

---

#### 2. Email Notifications (Premium Feature)

**Status**: 🔴 Not Implemented | **Timeline**: 1.5 weeks | **Dependencies**: Premium gating

**Premium Feature** - UI already exists:

- Integrate email service (Resend recommended)
- Template system for branded emails
- Queue for reliability
- Creator + submitter notifications
- **Pro Plan Required**: Feature gated behind subscription

**Implementation**:

```typescript
// Email service integration
class EmailService {
  async sendSubmissionNotification(submission: Submission) {
    // To creator
    await resend.send({
      to: form.settings.notifyEmail,
      template: "submission-notification",
      data: { form, submission, summary },
    });

    // To submitter (if opted in)
    if (submission.email && form.settings.sendCopy) {
      await resend.send({
        to: submission.email,
        template: "submission-confirmation",
        data: { form, answers: submission.responses },
      });
    }
  }
}
```

---

### Phase 2: User Experience Enhancement (Weeks 5-10)

#### 3. TypeForm Mode Polish

**Status**: 🟡 Basic Exists | **Timeline**: 3 weeks | **Dependencies**: Runtime AI Enhancement

Current "Classic mode" needs TypeForm polish:

- **Smooth animations** between questions (spring physics)
- **Full keyboard navigation** (arrows, tab, shortcuts)
- **Progress indicators** (vertical bar, percentage)
- **Question transitions** based on type
- **Background media** support

**Key Enhancements**:

```typescript
// Enhanced TypeForm renderer
interface TypeFormEnhancements {
  transitions: {
    questionChange: "slide" | "fade" | "zoom";
    duration: number; // Spring-based
  };
  keyboard: {
    shortcuts: Map<string, Action>;
    navigation: "arrows" | "tab" | "both";
  };
  progress: {
    style: "bar" | "dots" | "percentage";
    position: "top" | "bottom" | "side";
  };
}
```

---

#### 4. UI/UX Revamp

**Status**: 🟢 Good Foundation | **Timeline**: 3-4 weeks | **Dependencies**: None

Focus on polish and consistency:

- **Dashboard redesign** with better information architecture
- **Mobile-first** responsive improvements
- **Micro-interactions** and loading states
- **Empty states** and error boundaries
- **Dark mode** completion

**New Two-Column Layout Architecture**:

Key layout features:

- **Left Panel**: Chat/Design panel (resizable 300px-600px)
- **Right Panel**: Main content area (flexible width)
- **Panel States**: Auto-collapse/expand based on active tab
- **Chat Mode**: AI conversation for form building
- **Design Mode**: Live theme/color customization
- **Floating Mode**: Detachable chat panel with drag functionality

**Form Preview Modes**:

- **Chat Mode**: AI-guided form filling simulation
- **Conversation Mode**: TypeForm-style one-question-per-screen
- **Edit Mode**: Inline editing with visual indicators

**Tab-Based Navigation**:

- **Form Tab**: Main form building (chat panel expanded)
- **Responses Tab**: Analytics dashboard (chat panel collapsed)
- **Share Tab**: Embed code generation (chat panel hidden)

**Responsive Behaviors**:

- Resize handle between panels with constraints
- Smooth 300ms transitions for panel states
- Floating panel with viewport constraints
- Auto-save with visual feedback

Leverage existing:

- Motion primitives for animations
- CVA for component variants
- Existing design system

---

#### 5. Workspaces and Teams (Moved Up)

**Status**: 🔴 Not Implemented | **Timeline**: 4-5 weeks | **Dependencies**: Better Auth Migration

**Why moved up**: Affects many downstream features

**Implementation**:

```typescript
// New data model
interface Organization {
  id: string;
  name: string;
  slug: string;
  subscription: SubscriptionTier;
}

interface TeamMember {
  userId: string;
  orgId: string;
  role: "owner" | "admin" | "editor" | "viewer";
  permissions: Permission[];
}

// Form ownership model
interface FormOwnership {
  ownerId: string; // user_id
  organizationId?: string; // optional org ownership
  visibility: "private" | "org" | "public";
  permissions: FormPermission[];
}
```

**Features**:

- Organization creation and management
- Team invitations via email
- Role-based permissions
- Form sharing within org
- Unified billing per org

---

### Phase 3: Platform Features (Weeks 11-18)

#### 6. Component Extension Pack

**Status**: 🟡 Basic Set | **Timeline**: 3-4 weeks | **Dependencies**: Component standards

Priority components based on user demand:

1. **Calendar Booking** (Cal.com style):
   - Available slots from calendar
   - Timezone handling
   - Confirmation emails

2. **Signature Pad**:
   - Touch/mouse drawing
   - Legal compliance features
   - Image export

3. **Payment Collection** (Stripe):
   - One-time payments
   - Subscription setup
   - Price calculations

4. **Advanced Inputs**:
   - Location picker (maps)
   - Terms acceptance
   - Matrix/grid questions
   - NPS score

---

#### 7. Advanced Integrations Hub (Premium Feature)

**Status**: 🟡 Webhook Only | **Timeline**: 4-5 weeks | **Dependencies**: Premium gating + Plugin architecture

**Tiered Integration Access**:

**Free Plan**: Basic webhooks only

**Pro Plan**: Advanced integrations

1. **Zapier Official App** (Requires API Keys):
   - **Authentication**: API key-based (Better Auth migration required)
   - **Triggers**: form_submitted, form_updated, form_published
   - **Actions**: create_submission, update_form, retrieve_responses
   - **Field Mapping**: Full schema mapping with dynamic form fields
   - **Scoping**: Organization-level API keys with granular permissions

2. **Direct Integrations**:
   - Google Sheets (live sync)
   - Slack (notifications)
   - HubSpot/Salesforce (CRM)
   - Mailchimp (email lists)

3. **API Enhancement**:
   - RESTful endpoints
   - GraphQL support
   - Webhook management API

**Premium Gating**: Integration marketplace with subscription checks

---

#### 8. Analytics & Insights Dashboard

**Status**: 🟡 Basic | **Timeline**: 3 weeks | **Dependencies**: Event system

Comprehensive analytics:

- **Conversion funnels** with drop-off analysis
- **Response time** distributions
- **A/B test results** visualization
- **AI conversation** quality metrics
- **Export capabilities** (CSV, PDF reports)

```typescript
interface AnalyticsDashboard {
  metrics: {
    completionRate: TimeSeriesData;
    avgCompletionTime: TimeSeriesData;
    dropOffByQuestion: QuestionMetrics[];
    aiMetrics?: AIConversationMetrics;
  };

  exports: {
    format: "csv" | "pdf" | "json";
    filters: DateRange & QuestionFilter;
    scheduling: "daily" | "weekly" | "monthly";
  };
}
```

---

### Phase 4: Growth & Monetization (Weeks 19-24)

#### 9. Pricing & Billing (Pro Plan Strategy)

**Status**: 🔴 Not Implemented | **Timeline**: 3 weeks | **Dependencies**: Workspaces

Polar.sh-based billing with premium feature gating:

**Premium Features (Pro Plan Only)**:

- ✅ **AI Mode + TypeForm Mode** (currently available to all)
- ✅ **No Formlink Branding** (white-label experience)
- ✅ **Custom Brand Assets** (logos, colors, fonts)
- ✅ **Email Notifications** (to creator and respondents)
- ✅ **Advanced Integrations** (beyond basic webhooks)

**Subscription Tiers**:

- **Free**: Basic forms, Formlink branding, 100 responses/month, webhooks only
- **Pro ($29/month)**: All premium features, unlimited responses, custom branding
- **Team ($99/month)**: Pro + workspaces, team collaboration, priority support

**Implementation Using Polar.sh**:

```typescript
// Polar integration
import { Polar } from "@polar-sh/sdk";

interface PremiumFeatureGate {
  aiMode: boolean;
  typeformMode: boolean;
  customBranding: boolean;
  emailNotifications: boolean;
  advancedIntegrations: boolean;
  unlimitedResponses: boolean;
}

class SubscriptionService {
  async checkFeatureAccess(
    userId: string,
    feature: keyof PremiumFeatureGate,
  ): Promise<boolean> {
    const subscription = await polar.subscriptions.get(userId);
    return subscription.plan.features.includes(feature);
  }
}
```

**Billing Portal**: Polar's customer portal for self-service subscription management

---

#### 10. A/B Testing Platform

**Status**: 🔴 Not Implemented | **Timeline**: 3 weeks | **Dependencies**: Analytics

Built-in experimentation:

- **Form variants** with traffic splitting
- **Question variants** for copy testing
- **Statistical significance** calculations
- **Winner selection** automation

---

#### 11. Multi-Language Support

**Status**: 🔴 Not Implemented | **Timeline**: 3 weeks | **Dependencies**: None

Internationalization:

- **Form translations** with fallbacks
- **RTL support** for Arabic/Hebrew
- **Locale detection** and switching
- **Response language** tracking

---

#### 12. Custom Branding & White Label (Premium Feature)

**Status**: 🟡 DB Ready | **Timeline**: 2 weeks | **Dependencies**: Premium gating

**Premium Feature** - Custom branding for Pro+ plans:

- **Remove Formlink Branding**: Clean, unbranded experience
- **Logo Upload**: Custom brand assets and positioning
- **Color Scheme**: Full theme customization
- **Font Selection**: Typography control
- **CSS Overrides**: Advanced styling for power users
- **White Label Domains**: Custom domain support

**Free Plan Limitation**: Shows "Powered by Formlink" branding

---

#### 13. Custom Domains (Moved Down)

**Status**: 🔴 Not Implemented | **Timeline**: 2 weeks | **Dependencies**: Infrastructure

Domain management:

- CNAME setup instructions
- SSL auto-provisioning
- Subdomain support
- Domain verification

---

## Premium Feature Strategy

### Polar.sh Integration Plan

**Phase 1: Billing Infrastructure** (2 weeks)

1. Set up Polar.sh organization and products
2. Integrate Polar SDK into codebase
3. Create subscription webhook handlers
4. Implement feature gating middleware

**Phase 2: Feature Gating** (1 week)

1. Add premium checks to AI/TypeForm modes
2. Implement branding removal logic
3. Gate email notifications
4. Restrict advanced integrations

**Phase 3: UI Integration** (1 week)

1. Add upgrade prompts throughout app
2. Integrate Polar customer portal
3. Show plan status in dashboard
4. Payment flow integration

### Free vs Pro Feature Matrix

| Feature             | Free Plan             | Pro Plan ($29/mo)           |
| ------------------- | --------------------- | --------------------------- |
| Forms               | 5 forms               | Unlimited                   |
| Responses           | 100/month             | Unlimited                   |
| AI Mode             | ❌                    | ✅                          |
| TypeForm Mode       | ❌                    | ✅                          |
| Branding            | "Powered by Formlink" | White-label                 |
| Email Notifications | ❌                    | ✅                          |
| Integrations        | Webhooks only         | Zapier, Google Sheets, etc. |
| Custom Domains      | ❌                    | ✅                          |
| Analytics           | Basic                 | Advanced                    |

## Implementation Strategy

### Quick Wins (1-2 weeks each)

1. ✅ Polar.sh billing setup (infrastructure exists)
2. ✅ Premium feature gating (database ready)
3. ✅ Email notifications (UI exists)

### High Impact (3-4 weeks each)

1. 🎯 Runtime AI Enhancement with cross-mode branching
2. 🎯 TypeForm mode polish
3. 🎯 Workspaces and teams

### Platform Building (4-6 weeks each)

1. 📦 Component extension pack
2. 📦 Integrations hub
3. 📦 Full analytics dashboard

## Critical Path Items

These must be done in order:

1. **Groundwork** (2 weeks) - See GROUNDWORK_V2.md
2. **Better Auth Migration** (3-4 weeks) - Required for API keys and teams
3. **Runtime AI Enhancement** (4 weeks) - Enables all smart features
4. **Workspaces** (5 weeks) - Changes data model fundamentally
5. **Pricing** (3 weeks) - Monetization gateway

## Success Metrics

- **Technical**: <100ms branching decisions, 99.9% uptime
- **User**: 40% better completion rates, true branching in all modes
- **Business**: 10k MAU, $50k MRR within 6 months
- **Developer**: <1 day to add new component via plugin

## Conclusion

The updated workstreams focus on:

1. **Feature parity** across all modes (especially branching)
2. **Quick wins** that users will notice immediately
3. **Platform capabilities** that enable exponential growth
4. **Monetization path** through workspaces and billing

Each workstream builds on the groundwork foundation, ensuring sustainable development without technical debt accumulation.
