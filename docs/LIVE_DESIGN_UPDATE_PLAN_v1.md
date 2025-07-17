# Live Design Update Implementation Plan v1

## Executive Summary

This document outlines the implementation plan for live design updates in FormCraft, building on the iframe preview system detailed in `FORMCRAFT_PREVIEW_MODE_IFRAME_IMPLEMENTATION_v1.md`. The plan includes a **two-level customization system** (brand-level + form-level) with a strategic UX approach.

## Current State Analysis

### Database Structure

- **Global Brand Theming**: `brands` table has `theme: Json` field (line 19 in database.types.ts)
- **Form-Brand Relationship**: `forms` table has `brand_id` foreign key (line 225)
- **Form-Level Customization**: Currently no dedicated theme field in forms table

### Existing Theme System

- **Sophisticated Engine**: 300+ design tokens, AI theme extraction, accessibility features
- **Hidden Capabilities**: Only basic dark/light toggle exposed to users
- **Advanced Features**: Website crawling, automatic theme generation, WCAG compliance

## Two-Level Customization System Design

### Level 1: Brand-Level Themes (Global)

**Purpose**: Organization-wide consistency across all forms
**Storage**: `brands.theme` JSON field
**Scope**: Default theme applied to all forms within a brand

**Theme Structure**:

```typescript
interface BrandTheme {
  id: string;
  name: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
    text: string;
    textSecondary: string;
    border: string;
    error: string;
    success: string;
    warning: string;
  };
  typography: {
    fontFamily: string;
    fontSize: {
      base: string;
      h1: string;
      h2: string;
      h3: string;
      small: string;
    };
    fontWeight: {
      normal: string;
      medium: string;
      semibold: string;
      bold: string;
    };
  };
  spacing: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };
  borders: {
    radius: string;
    width: string;
  };
  effects: {
    shadow: string;
    blur: string;
  };
  animations: {
    duration: string;
    easing: string;
  };
  accessibility: {
    highContrast: boolean;
    reducedMotion: boolean;
    fontSizeMultiplier: number;
  };
}
```

### Level 2: Form-Level Overrides (Per-Form)

**Purpose**: Specific customization for individual forms
**Storage**: New `form_themes` table or `form_versions.theme_overrides` JSON field
**Scope**: Overrides specific brand theme properties for one form

**Override Structure**:

```typescript
interface FormThemeOverrides {
  formId: string;
  overrides: Partial<BrandTheme>;
  inheritFromBrand: boolean;
  customizations: {
    headerStyle?: "minimal" | "prominent" | "hidden";
    progressStyle?: "bar" | "steps" | "percentage" | "hidden";
    inputStyle?: "outlined" | "filled" | "underlined";
    buttonStyle?: "solid" | "outline" | "ghost";
    layout?: "single-column" | "two-column" | "card";
  };
}
```

### Database Schema Updates Required

```sql
-- Option 1: Add theme_overrides to form_versions
ALTER TABLE form_versions ADD COLUMN theme_overrides JSON;

-- Option 2: Create dedicated form_themes table
CREATE TABLE form_themes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id UUID REFERENCES forms(id) ON DELETE CASCADE,
  theme_overrides JSON NOT NULL,
  inherit_from_brand BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## UX Flow Design

### 1. Brand-Level Theme Management

**Location**: Brand settings page (new)
**Access**: Organization admins only
**Features**:

- Theme gallery with presets
- Custom theme builder
- "Extract from URL" AI-powered theme generation
- Preview across sample forms
- Theme versioning and rollback

### 2. Form-Level Customization

**Location**: FormCraft Form tab → Design panel (new)
**Access**: Form editors
**Features**:

- Toggle "Use brand theme" vs "Custom theme"
- Override-specific controls (only show what's different)
- Live preview with immediate updates
- Reset to brand defaults option

### 3. Progressive Disclosure UX Strategy

#### Phase 1: Basic Color Customization

- **Brand Level**: Primary color, secondary color, logo upload
- **Form Level**: Simple toggle to use custom colors
- **UI**: Color picker with brand color inheritance indicator

#### Phase 2: Advanced Styling

- **Brand Level**: Typography, spacing, component styles
- **Form Level**: Layout options, component overrides
- **UI**: Expanded design panel with tabs

#### Phase 3: AI-Powered Features

- **Brand Level**: "Extract from URL" theme generation
- **Form Level**: Smart theme suggestions based on form content
- **UI**: Advanced theme builder with AI assistance

## Live Design Update Implementation

### Enhanced Preview System

Building on the iframe preview implementation, extend postMessage communication to include theme updates:

```typescript
// New message types for theme updates
interface ThemeUpdateMessage {
  type: "FORMCRAFT_THEME_UPDATE";
  payload: {
    brandTheme: BrandTheme;
    formOverrides: FormThemeOverrides;
    previewMode: "brand" | "form" | "combined";
  };
}

interface ThemeAppliedMessage {
  type: "FORMFILLER_THEME_APPLIED";
  payload: {
    success: boolean;
    appliedTheme: string;
    errors?: string[];
  };
}
```

### FormCraft Design Panel Integration

New `DesignPanel` component for FormCraft:

```typescript
// apps/formcraft/app/test-ui/components/form/DesignPanel.tsx
interface DesignPanelProps {
  formId: string;
  brandTheme: BrandTheme;
  formOverrides: FormThemeOverrides;
  onThemeChange: (overrides: FormThemeOverrides) => void;
  onPreviewModeChange: (mode: "brand" | "form" | "combined") => void;
}
```

### FormFiller Theme Application

Enhanced preview route to handle theme updates:

```typescript
// apps/formfiller/app/preview/[formId]/page.tsx
useEffect(() => {
  const handleThemeUpdate = (event: MessageEvent) => {
    if (event.data?.type === "FORMCRAFT_THEME_UPDATE") {
      const { brandTheme, formOverrides, previewMode } = event.data.payload;

      // Apply theme using existing ThemeEngine
      const combinedTheme = mergeThemes(brandTheme, formOverrides);
      ThemeEngine.applyTheme(combinedTheme);

      // Notify parent of successful application
      window.parent.postMessage(
        {
          type: "FORMFILLER_THEME_APPLIED",
          payload: { success: true, appliedTheme: combinedTheme.id },
        },
        event.origin,
      );
    }
  };

  window.addEventListener("message", handleThemeUpdate);
  return () => window.removeEventListener("message", handleThemeUpdate);
}, []);
```

## Technical Implementation Strategy

### Phase 1: Foundation (Week 1-2)

1. **Database Schema**: Add `theme_overrides` to `form_versions` table
2. **Theme Merging**: Create utility to merge brand + form themes
3. **Basic UI**: Simple color picker in FormCraft design panel
4. **Preview Integration**: Extend iframe postMessage for theme updates

### Phase 2: Core Features (Week 3-4)

1. **Brand Theme UI**: Brand-level theme management interface
2. **Form Override UI**: Form-level customization controls
3. **Live Preview**: Real-time theme updates in preview iframe
4. **Persistence**: Save/load theme configurations

### Phase 3: Advanced Features (Week 5-6)

1. **AI Theme Extraction**: "Extract from URL" feature
2. **Theme Presets**: Gallery of pre-built themes
3. **Advanced Controls**: Typography, spacing, layout options
4. **Import/Export**: Theme sharing between brands/forms

## UX Considerations

### 1. Hierarchy Clarity

- **Clear Visual Hierarchy**: Brand themes as foundation, form overrides as layers
- **Inheritance Indicators**: Visual cues showing what's inherited vs overridden
- **Reset Options**: Easy way to revert to brand defaults

### 2. Progressive Disclosure

- **Beginner Mode**: Basic color customization only
- **Advanced Mode**: Full theme control with expert options
- **Smart Defaults**: Intelligent suggestions based on brand/content

### 3. Performance Optimization

- **Debounced Updates**: Prevent excessive re-renders during editing
- **Lazy Loading**: Load theme UI only when needed
- **Caching**: Cache computed themes for faster switching

## Success Metrics

### Phase 1 Success

- [ ] Brand theme selection working in FormCraft
- [ ] Basic form-level color overrides functional
- [ ] Live preview updates theme in real-time
- [ ] Theme persistence working across sessions

### Phase 2 Success

- [ ] Complete brand theme management interface
- [ ] Form-level customization panel integrated
- [ ] Theme inheritance system working correctly
- [ ] Performance optimization implemented

### Phase 3 Success

- [ ] AI theme extraction functional
- [ ] Theme preset gallery available
- [ ] Advanced styling options working
- [ ] Import/export functionality complete

## Risk Mitigation

1. **Performance Impact**: Debounced updates, lazy loading, caching
2. **Theme Conflicts**: Clear hierarchy rules, validation system
3. **User Confusion**: Progressive disclosure, clear documentation
4. **Backwards Compatibility**: Graceful degradation for existing forms

This implementation leverages the existing sophisticated theme system while providing a user-friendly two-level customization approach that scales from simple color changes to advanced brand customization.
