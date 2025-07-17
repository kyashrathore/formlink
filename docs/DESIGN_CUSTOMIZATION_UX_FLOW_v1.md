# Design Customization UX Flow v1

## Executive Summary

This document details the user experience flow for the two-level design customization system in FormCraft. The UX prioritizes **progressive disclosure** to avoid overwhelming users while still providing access to advanced features.

## UX Philosophy

### Core Principles

1. **Progressive Disclosure**: Start simple, reveal complexity as needed
2. **Contextual Relevance**: Show options relevant to current form/brand
3. **Visual Hierarchy**: Clear distinction between brand and form-level changes
4. **Immediate Feedback**: Live preview for all design changes
5. **Escape Hatches**: Easy reset and undo functionality

### User Mental Model

- **Brand Theme**: "My organization's look and feel"
- **Form Customization**: "This specific form's unique styling"
- **Inheritance**: "What my form gets from my brand by default"

## Detailed UX Flow

### 1. Brand-Level Theme Management

#### 1.1 Entry Points

**Location**: Brand settings page (new page)
**Access**: Organization admins, brand managers
**Navigation**: Main app → Settings → Brand → Design

#### 1.2 Brand Theme Dashboard

```
┌─────────────────────────────────────────────────────┐
│ Brand Design                                        │
│                                                     │
│ Current Theme: [Acme Corp Theme]           [Edit]   │
│                                                     │
│ ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │
│ │   Preview   │  │   Colors    │  │  Typography │  │
│ │   ┌─────┐   │  │             │  │             │  │
│ │   │Form │   │  │ Primary: ●  │  │ Font: Inter │  │
│ │   │Demo │   │  │ Secondary:● │  │ Size: 16px  │  │
│ │   └─────┘   │  │ Accent: ●   │  │ Weight: 400 │  │
│ └─────────────┘  └─────────────┘  └─────────────┘  │
│                                                     │
│ Forms using this theme: 12                          │
│                                                     │
│ [Create New Theme]  [Extract from URL]  [Gallery]  │
└─────────────────────────────────────────────────────┘
```

#### 1.3 Theme Creation/Editing Flow

**Step 1: Theme Source Selection**

```
┌─────────────────────────────────────────────────────┐
│ Create Brand Theme                                  │
│                                                     │
│ How would you like to create your theme?           │
│                                                     │
│ ○ Start from scratch                                │
│ ○ Use a preset theme                                │
│ ○ Extract from our website                          │
│ ○ Import from file                                  │
│                                                     │
│ [Continue]                                          │
└─────────────────────────────────────────────────────┘
```

**Step 2: Core Brand Elements**

```
┌─────────────────────────────────────────────────────┐
│ Brand Theme Editor                    [Save] [Cancel]│
│                                                     │
│ ┌─────────────────┐  ┌─────────────────────────────┐│
│ │    Preview      │  │        Basic Settings       ││
│ │                 │  │                             ││
│ │  ┌───────────┐  │  │ Theme Name: [____________]  ││
│ │  │   Form    │  │  │                             ││
│ │  │  Preview  │  │  │ Primary Color: [●] #3b82f6 ││
│ │  │   Here    │  │  │ Secondary Color: [●] #64748b││
│ │  └───────────┘  │  │ Accent Color: [●] #10b981   ││
│ │                 │  │                             ││
│ │  Updates live   │  │ Logo: [Upload] [Remove]     ││
│ │  as you edit    │  │                             ││
│ └─────────────────┘  │ [Show Advanced Options]     ││
│                      └─────────────────────────────┘│
└─────────────────────────────────────────────────────┘
```

**Step 3: Advanced Options (Progressive Disclosure)**

```
┌─────────────────────────────────────────────────────┐
│ Advanced Theme Settings                             │
│                                                     │
│ ┌─ Typography ────────────────────────────────────┐ │
│ │ Font Family: [Inter ▼]                         │ │
│ │ Base Size: [16px] Headings: [Scale ▼]          │ │
│ │ Weights: Light[300] Regular[400] Bold[600]     │ │
│ └───────────────────────────────────────────────────┘ │
│                                                     │
│ ┌─ Spacing & Layout ─────────────────────────────┐ │
│ │ Compact ○ ● Standard ○ Spacious               │ │
│ │ Border Radius: [8px] Border Width: [1px]      │ │
│ └───────────────────────────────────────────────────┘ │
│                                                     │
│ ┌─ Accessibility ────────────────────────────────┐ │
│ │ ☑ High Contrast Mode                           │ │
│ │ ☑ Reduced Motion                               │ │
│ │ Font Size Multiplier: [1.0x]                   │ │
│ └───────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

### 2. Form-Level Customization

#### 2.1 Entry Point

**Location**: FormCraft Form tab → Design panel (new)
**Access**: Form editors
**Context**: Available when editing a form

#### 2.2 Design Panel Integration

```
┌─────────────────────────────────────────────────────┐
│ FormCraft - Form Editor                             │
│                                                     │
│ [Chat] [Form] [Share] [Settings]                    │
│                                                     │
│ ┌─────────────┐  ┌─────────────────────────────────┐│
│ │             │  │                                 ││
│ │    Form     │  │ ┌─ Design ─────────────────────┐ ││
│ │   Content   │  │ │                             │ ││
│ │   Editor    │  │ │ Theme Source:               │ ││
│ │             │  │ │ ● Use brand theme           │ ││
│ │             │  │ │ ○ Custom for this form      │ ││
│ │             │  │ │                             │ ││
│ │             │  │ │ [Preview] [Edit Brand Theme]│ ││
│ │             │  │ └─────────────────────────────┘ ││
│ │             │  │                                 ││
│ │             │  │ [Other Form Settings...]        ││
│ └─────────────┘  └─────────────────────────────────┘│
└─────────────────────────────────────────────────────┘
```

#### 2.3 Custom Theme Override Flow

```
┌─────────────────────────────────────────────────────┐
│ Form-Specific Design                                │
│                                                     │
│ ┌─ Theme Inheritance ────────────────────────────┐  │
│ │ Based on: [Acme Corp Theme]        [Preview]  │  │
│ │ ○ Use brand theme exactly                      │  │
│ │ ● Override specific elements                   │  │
│ └───────────────────────────────────────────────────┘  │
│                                                     │
│ ┌─ Quick Customizations ────────────────────────┐  │
│ │                                               │  │
│ │ Primary Color: [●] ← [Reset to brand]        │  │
│ │ Form Layout: [Single Column ▼]               │  │
│ │ Progress Style: [Progress Bar ▼]             │  │
│ │ Button Style: [Solid ▼]                      │  │
│ │                                               │  │
│ │ [Show More Options]                           │  │
│ └───────────────────────────────────────────────────┘  │
│                                                     │
│ Changes from brand theme: 3                         │
│ [Preview Changes] [Reset All] [Apply]               │
└─────────────────────────────────────────────────────┘
```

### 3. Live Preview Integration

#### 3.1 Preview Mode States

**Preview Toggle**: Enhanced to show theme state

```
┌─────────────────────────────────────────────────────┐
│ Form Builder                      [Edit] [Preview]  │
│                                                     │
│ Preview Mode: [Mobile ▼] [Tablet] [Desktop]        │
│ Theme: [Brand Theme] [Form Override] [Combined]    │
│                                                     │
│ ┌─────────────────────────────────────────────────┐ │
│ │                                                 │ │
│ │            Live Form Preview                    │ │
│ │            (Updates in real-time)               │ │
│ │                                                 │ │
│ └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

#### 3.2 Real-time Update Indicators

```
┌─────────────────────────────────────────────────────┐
│ Design Panel                                        │
│                                                     │
│ Primary Color: [●] ← [Updating... ⟳]               │
│                                                     │
│ ┌─ Live Preview ────────────────────────────────┐   │
│ │ ✓ Connected to preview                        │   │
│ │ ⟳ Applying changes...                         │   │
│ │ ⚠ Connection lost - [Retry]                   │   │
│ └───────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

### 4. Progressive Disclosure Strategy

#### 4.1 Beginner Mode (Default)

**Show**: Basic color picker, simple toggles
**Hide**: Advanced typography, spacing, CSS overrides
**Goal**: Build confidence, avoid overwhelm

#### 4.2 Intermediate Mode

**Show**: Layout options, component styles, presets
**Hide**: CSS variables, accessibility fine-tuning
**Goal**: More control without complexity

#### 4.3 Advanced Mode

**Show**: Full theme editor, CSS overrides, AI features
**Hide**: Nothing (expert mode)
**Goal**: Maximum customization power

### 5. Error States and Edge Cases

#### 5.1 Theme Conflicts

```
┌─────────────────────────────────────────────────────┐
│ ⚠ Theme Conflict Detected                           │
│                                                     │
│ This form's custom colors may not work well with    │
│ the updated brand theme.                            │
│                                                     │
│ ○ Use new brand theme (remove custom colors)       │
│ ○ Keep custom colors (may look inconsistent)       │
│ ○ Manually resolve conflicts                        │
│                                                     │
│ [Preview Options] [Help] [Resolve]                  │
└─────────────────────────────────────────────────────┘
```

#### 5.2 Preview Connection Issues

```
┌─────────────────────────────────────────────────────┐
│ 🔌 Preview Connection Lost                          │
│                                                     │
│ The live preview is temporarily unavailable.        │
│ Your changes are being saved.                       │
│                                                     │
│ [Retry Connection] [Continue Editing] [Help]        │
└─────────────────────────────────────────────────────┘
```

### 6. Mobile Considerations

#### 6.1 Responsive Design Panel

**Mobile**: Collapse design panel into slide-out drawer
**Tablet**: Side-by-side with reduced preview size
**Desktop**: Full side-by-side layout

#### 6.2 Touch Interactions

- **Color Picker**: Touch-friendly color wells
- **Sliders**: Larger touch targets for spacing/sizing
- **Toggles**: Clear on/off states with haptic feedback

### 7. Accessibility Considerations

#### 7.1 Screen Reader Support

- **Live Regions**: Announce theme changes
- **Descriptive Labels**: Clear purpose for each control
- **Keyboard Navigation**: Full keyboard access

#### 7.2 Color Accessibility

- **Contrast Validation**: Real-time WCAG compliance checking
- **Color Blind Support**: Pattern/texture alternatives
- **High Contrast Mode**: Automatic high contrast variants

### 8. Performance Considerations

#### 8.1 Debounced Updates

- **Color Changes**: 250ms debounce for smooth interaction
- **Typography**: 500ms debounce for complex recalculations
- **Live Preview**: Efficient postMessage batching

#### 8.2 Loading States

- **Theme Loading**: Skeleton UI while theme loads
- **Preview Loading**: Spinner with progress indicator
- **Save Status**: Clear feedback on save state

## Success Metrics

### Usability Metrics

- **Task Completion Rate**: >90% for basic color changes
- **Time to First Customization**: <2 minutes
- **Error Rate**: <5% for theme conflicts

### Engagement Metrics

- **Feature Adoption**: >60% of users try basic customization
- **Advanced Feature Usage**: >20% access advanced options
- **Theme Reuse**: >40% of brands create reusable themes

### Performance Metrics

- **Preview Update Time**: <100ms for simple changes
- **Theme Load Time**: <2 seconds for complex themes
- **Error Recovery**: <30 seconds to resolve conflicts

This UX flow balances simplicity for beginners with power for advanced users, ensuring the two-level customization system is both accessible and comprehensive.
