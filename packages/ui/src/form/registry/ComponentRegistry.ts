import React, { ComponentType } from "react";

// Import all components exactly as they are in UnifiedFormInput.tsx
// Import unified components
import { UnifiedRanking } from "../modes/unified/UnifiedRanking";
import { UnifiedRating } from "../modes/unified/UnifiedRating";
import { UnifiedLinearScale } from "../modes/unified/UnifiedLinearScale";
import { UnifiedMultiSelect } from "../modes/unified/UnifiedMultiSelect";
import { UnifiedAddressInput } from "../modes/unified/UnifiedAddressInput";
import { UnifiedDatePicker } from "../modes/unified/UnifiedDatePicker";
import { UnifiedFileUpload } from "../modes/unified/UnifiedFileUpload";

// Import mode-specific components
import { ChatTextInput } from "../modes/chat/ChatTextInput";
import { ChatSelect } from "../modes/chat/ChatSelect";
import { TypeFormTextInput } from "../modes/typeform/TypeFormTextInput";
import { TypeFormSelect } from "../modes/typeform/TypeFormSelect";

// Type definitions
export type FormInputMode = "chat" | "typeform";
export type FormInputType =
  | "text"
  | "email"
  | "url"
  | "tel"
  | "password"
  | "textarea"
  | "select"
  | "multiselect"
  | "multipleChoice"
  | "rating"
  | "date"
  | "file"
  | "fileUpload"
  | "linear-scale"
  | "address"
  | "phone"
  | "country"
  | "likert-scale"
  | "ranking";

/**
 * Registry entry that defines a component and its prop transformation
 */
export interface ComponentRegistryEntry {
  /** Component to use in chat mode */
  chatComponent?: ComponentType<any>;
  /** Component to use in typeform mode */
  typeformComponent?: ComponentType<any>;
  /** Unified component that handles both modes internally */
  unifiedComponent?: ComponentType<any>;
  /** Function to transform props before passing to component */
  transformProps: (props: any, type: FormInputType, mode: FormInputMode) => any;
}

// ===========================================
// Prop Transformers (Standalone functions)
// ===========================================

/**
 * Default transformer - passes props through unchanged
 */
const identityTransformer = (
  props: any,
  type: FormInputType,
  mode: FormInputMode,
) => props;

/**
 * Text input transformer - handles type overrides and multiline for textarea
 */
const textInputTransformer = (
  props: any,
  type: FormInputType,
  mode: FormInputMode,
) => {
  const transformedProps = { ...props };

  // Override type for text variants (preserves current behavior)
  if (["email", "url", "tel", "password"].includes(type)) {
    transformedProps.type = type;
  } else if (type === "textarea") {
    transformedProps.type = "text";
    transformedProps.multiline = true;
  }

  return transformedProps;
};

/**
 * Unified component transformer - adds mode prop
 */
const unifiedTransformer = (
  props: any,
  type: FormInputType,
  mode: FormInputMode,
) => ({
  ...props,
  mode,
});

/**
 * Linear scale transformer - creates config object from individual props
 */
const linearScaleTransformer = (
  props: any,
  type: FormInputType,
  mode: FormInputMode,
) => {
  const { min = 1, max = 5, step = 1, ...otherProps } = props;

  return {
    ...otherProps,
    mode,
    config: {
      start: min,
      end: max,
      step: step,
    },
  };
};

// ===========================================
// Component Registry (Simple object)
// ===========================================

/**
 * Component Registry - Maps form input types to their implementations
 * This is a simple object that replaces the hardcoded componentMap from UnifiedFormInput.tsx
 */
export const componentRegistry: Record<FormInputType, ComponentRegistryEntry> =
  {
    // Text input variants - mode-specific components
    text: {
      chatComponent: ChatTextInput,
      typeformComponent: TypeFormTextInput,
      transformProps: textInputTransformer,
    },
    email: {
      chatComponent: ChatTextInput,
      typeformComponent: TypeFormTextInput,
      transformProps: textInputTransformer,
    },
    url: {
      chatComponent: ChatTextInput,
      typeformComponent: TypeFormTextInput,
      transformProps: textInputTransformer,
    },
    tel: {
      chatComponent: ChatTextInput,
      typeformComponent: TypeFormTextInput,
      transformProps: textInputTransformer,
    },
    password: {
      chatComponent: ChatTextInput,
      typeformComponent: TypeFormTextInput,
      transformProps: textInputTransformer,
    },
    textarea: {
      chatComponent: ChatTextInput,
      typeformComponent: TypeFormTextInput,
      transformProps: textInputTransformer,
    },

    // Select components - mode-specific
    select: {
      chatComponent: ChatSelect,
      typeformComponent: TypeFormSelect,
      transformProps: identityTransformer,
    },

    // Unified components - handle mode internally
    multiselect: {
      unifiedComponent: UnifiedMultiSelect,
      transformProps: unifiedTransformer,
    },
    multipleChoice: {
      unifiedComponent: UnifiedMultiSelect,
      transformProps: unifiedTransformer,
    },
    rating: {
      unifiedComponent: UnifiedRating,
      transformProps: unifiedTransformer,
    },
    date: {
      unifiedComponent: UnifiedDatePicker,
      transformProps: unifiedTransformer,
    },
    file: {
      unifiedComponent: UnifiedFileUpload,
      transformProps: unifiedTransformer,
    },
    fileUpload: {
      unifiedComponent: UnifiedFileUpload,
      transformProps: unifiedTransformer,
    },
    "linear-scale": {
      unifiedComponent: UnifiedLinearScale,
      transformProps: linearScaleTransformer,
    },
    address: {
      unifiedComponent: UnifiedAddressInput,
      transformProps: unifiedTransformer,
    },
    ranking: {
      unifiedComponent: UnifiedRanking,
      transformProps: unifiedTransformer,
    },

    // Fallback mappings (as per current implementation)
    phone: {
      chatComponent: ChatTextInput,
      typeformComponent: TypeFormTextInput,
      transformProps: textInputTransformer,
    },
    country: {
      chatComponent: ChatSelect,
      typeformComponent: TypeFormSelect,
      transformProps: identityTransformer,
    },
    "likert-scale": {
      unifiedComponent: UnifiedLinearScale,
      transformProps: linearScaleTransformer,
    },
  };

// ===========================================
// Helper Functions
// ===========================================

/**
 * Get component for a specific type and mode
 */
export function getComponent(
  type: FormInputType,
  mode: FormInputMode,
): ComponentType<any> | null {
  const entry = componentRegistry[type];
  if (!entry) {
    return null;
  }

  // Return unified component if available
  if (entry.unifiedComponent) {
    return entry.unifiedComponent;
  }

  // Return mode-specific component
  if (mode === "chat" && entry.chatComponent) {
    return entry.chatComponent;
  }

  if (mode === "typeform" && entry.typeformComponent) {
    return entry.typeformComponent;
  }

  return null;
}

/**
 * Transform props for a specific component type
 */
export function transformComponentProps(
  props: any,
  type: FormInputType,
  mode: FormInputMode,
): any {
  const entry = componentRegistry[type];
  if (!entry) {
    return props;
  }

  return entry.transformProps(props, type, mode);
}

/**
 * Check if a component type is registered
 */
export function hasRegisteredComponent(type: FormInputType): boolean {
  return type in componentRegistry;
}

/**
 * Get all registered component types
 */
export function getRegisteredComponentTypes(): FormInputType[] {
  return Object.keys(componentRegistry) as FormInputType[];
}

/**
 * Add a new component to the registry
 * Simple function for adding new components without modifying core files
 */
export function addComponent(
  type: FormInputType,
  entry: ComponentRegistryEntry,
): void {
  (componentRegistry as any)[type] = entry;
}

/**
 * Helper function to render a component with proper prop transformation
 * This replicates the exact logic from UnifiedFormInput.tsx
 */
export function renderRegisteredComponent(
  type: FormInputType,
  mode: FormInputMode,
  props: any,
): React.ReactElement | null {
  const Component = getComponent(type, mode);

  if (!Component) {
    console.error(`No component found for mode: ${mode}, type: ${type}`);
    return React.createElement("div", {
      className: "p-4 border border-destructive rounded-lg bg-destructive/10",
      children: React.createElement("p", {
        className: "text-destructive",
        children: `Unsupported component: ${mode} mode, ${type} type`,
      }),
    });
  }

  // Transform props using the registry
  const transformedProps = transformComponentProps(props, type, mode);

  // Render the component
  return React.createElement(Component, transformedProps);
}
