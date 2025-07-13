import React from "react";
import { useFormMode } from "../../context/FormModeContext";

// Import component registry
import {
  getComponent,
  transformComponentProps,
  type FormInputMode,
  type FormInputType,
} from "../../registry";

export interface UnifiedFormInputProps {
  mode: FormInputMode;
  type: FormInputType;
  value: unknown;
  onChange: (value: unknown) => void;
  onSubmit?: () => void;

  // Common props
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;

  // Text input specific
  maxLength?: number;
  minLength?: number;
  pattern?: string;
  multiline?: boolean;

  // Select/MultiSelect specific
  options?: Array<{ value: string; label: string; key?: string }>;

  // Rating specific
  max?: number;

  // File upload specific
  accept?: string;
  multiple?: boolean;
  onFileUpload?: (questionId: string, file: File) => Promise<void>;
  uploadedFile?: File | null;
  onFileSelect?: (file: File | null) => void;
  isUploading?: boolean;
  questionId?: string;

  // Scale specific
  min?: number;
  step?: number;

  // Validation
  onValidate?: (value: unknown) => Array<{ type: string; message: string }>;

  // Accessibility
  ariaLabel?: string;

  // Mode-specific overrides
  showKeyboardHints?: boolean;
  autoFocus?: boolean;
  autoSubmitOnChange?: boolean;
}

/**
 * UnifiedFormInput - Single component that replaces all ChatXXX and TypeFormXXX components
 *
 * This component provides a unified interface for all form input types across both modes.
 * It preserves exact current behavior while eliminating code duplication.
 */
export function UnifiedFormInput(props: UnifiedFormInputProps) {
  const { mode, type, ...restProps } = props;

  // Get component from registry
  const Component = getComponent(type, mode);

  if (!Component) {
    console.error(`No component found for mode: ${mode}, type: ${type}`);
    return (
      <div className="p-4 border border-destructive rounded-lg bg-destructive/10">
        <p className="text-destructive">
          Unsupported component: {mode} mode, {type} type
        </p>
      </div>
    );
  }

  // Transform props using registry
  const transformedProps = transformComponentProps(restProps, type, mode);

  // Render component
  return React.createElement(Component, transformedProps);
}

/**
 * FormInput - Convenience wrapper that provides FormModeContext if needed
 *
 * This component can be used with or without explicit mode prop.
 * If mode is provided, it uses that mode directly.
 * If mode is not provided, it reads from FormModeContext.
 */
export interface FormInputProps extends Omit<UnifiedFormInputProps, "mode"> {
  mode?: FormInputMode;
}

export function FormInput(props: FormInputProps) {
  const { mode: explicitMode, ...restProps } = props;

  // If mode is explicitly provided, use it directly
  if (explicitMode) {
    return <UnifiedFormInput mode={explicitMode} {...restProps} />;
  }

  // Otherwise, try to get mode from context
  return <FormModeAwareInput {...restProps} />;
}

function FormModeAwareInput(props: Omit<UnifiedFormInputProps, "mode">) {
  try {
    const { mode } = useFormMode();
    return <UnifiedFormInput mode={mode as FormInputMode} {...props} />;
  } catch (_error) {
    // If no context is available, default to chat mode
    console.warn(
      "FormInput used without FormModeProvider, defaulting to chat mode",
    );
    return <UnifiedFormInput mode="chat" {...props} />;
  }
}
