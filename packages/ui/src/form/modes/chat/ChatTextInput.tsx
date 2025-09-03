"use client";

export interface ChatTextInputProps {
  value: string | null;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  maxLength?: number;
  minLength?: number;
  pattern?: string;
  type?: string;
  multiline?: boolean;
  onValidate?: (value: string) => Array<{ type: string; message: string }>;
}

/**
 * ChatTextInput - Visual indicator for text input questions
 *
 * In chat mode, we don't render inline inputs. Instead, we show
 * a message directing users to type in the main chat input at the bottom.
 * This aligns with how ChatGPT and similar interfaces work.
 */
export function ChatTextInput({
  value,
  multiline = false,
  type = "text",
  minLength,
  maxLength,
}: ChatTextInputProps) {
  // Determine the input type label
  const getInputTypeLabel = () => {
    if (type === "email") return "email address";
    if (type === "url") return "URL";
    if (type === "tel") return "phone number";
    if (type === "password") return "password";
    if (multiline) return "response";
    return "answer";
  };

  // Build constraint message
  const getConstraintMessage = () => {
    const constraints = [];
    if (minLength) constraints.push(`at least ${minLength} characters`);
    if (maxLength) constraints.push(`up to ${maxLength} characters`);
    return constraints.length > 0 ? ` (${constraints.join(", ")})` : "";
  };

  return null;
}
