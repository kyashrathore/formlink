# Formlink.ai UI/UX Specification

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

- Theme preset selector (radio buttons)
- Color pickers for background, text, accent
- Font family dropdown
- Spacing slider
- Apply changes live to preview

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

**When Design Tab Active**

- Forced preview mode
- "Design Mode Active" indicator
- Edit toggle disabled

### 4. Form Preview Modes

#### Chat Mode

- Simulates AI-guided form filling
- Chat interface for responses
- Progress indicator
- No visible form fields

#### Conversation Mode

- One question per screen
- Large centered question
- Single input field
- Previous/Continue buttons
- Progress bar

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

### Design Mode Flow

1. Click Design tab → Preview locks
2. Select theme → Colors update
3. Adjust settings → Live preview
4. Click Chat tab → Preview unlocks

### Form Building Flow

1. Chat with AI about form
2. Preview updates in real-time
3. Toggle edit mode to modify
4. Switch preview modes to test
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

- Real-time updates from chat
- Maintains state during tab switches
- Preserves mode selection
- Syncs with design changes

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
