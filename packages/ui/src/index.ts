"use client";

// Pure UI components (shadcn-style)
export * from "./ui/accordion";
export * from "./ui/alert";
export * from "./ui/alert-dialog";
export * from "./ui/avatar";
export * from "./ui/badge";
export * from "./ui/breadcrumb";
export * from "./ui/button";
export * from "./ui/calendar";
export * from "./ui/card";
export * from "./ui/checkbox";
export * from "./ui/code-editor";
export * from "./ui/collapsible";
export * from "./ui/command";
export * from "./ui/dialog";
export * from "./ui/drawer";
export * from "./ui/dropdown-menu";
export * from "./ui/form";
export * from "./ui/hover-card";
export * from "./ui/input";
export * from "./ui/kibo-ui/combobox";
export * from "./ui/kibo-ui/dropzone";
export * from "./ui/label";
export * from "./ui/menubar";
export * from "./ui/popover";
export * from "./ui/progress";
export * from "./ui/radio-group";
export * from "./ui/scroll-area";
export * from "./ui/select";
export * from "./ui/select-with-search";
export * from "./ui/separator";
export * from "./ui/sheet";
export * from "./ui/sidebar";
export * from "./ui/skeleton";
export * from "./ui/sonner";
export * from "./ui/switch";
export * from "./ui/table";
export * from "./ui/tabs";
export * from "./ui/textarea";
export * from "./ui/toast";
export * from "./ui/toggle";
export * from "./ui/toggle-group";
export * from "./ui/tooltip";

// Motion components
export * from "./motion/morphing-dialog";
export * from "./motion/progressive-blur";
export * from "./motion/scroll-button";
export * from "./motion/text-morph";
export * from "./motion/useClickOutside";

// Chat UI components (prompt-kit)
export * from "./chat-ui/chat-container";
export * from "./chat-ui/code-block";
export * from "./chat-ui/file-upload";
export * from "./chat-ui/loader";
export * from "./chat-ui/markdown";
export * from "./chat-ui/message";
export * from "./chat-ui/prompt-input";
export * from "./chat-ui/prompt-suggestion";

// Icons
export { default as ClaudeIcon } from "./icons/claude";
export { default as DeepSeekIcon } from "./icons/deepseek";
export { default as GeminiIcon } from "./icons/gemini";
export { default as GrokIcon } from "./icons/grok";
export { default as MistralIcon } from "./icons/mistral";
export { default as OpenAIIcon } from "./icons/openai";

// Store - REMOVED: UI package should be stateless
// All state management should be handled by the consuming application

// Form context
export * from "./form/context/FormModeContext";
export * from "./form/context/TypeFormDropdownContext";

// Generic types for decoupled usage - IMPORT THESE FOR TYPE SAFETY
export * from "./types/generic";

// Hooks exports - organized by category
export * from "./hooks/form/useAddressInput";
export * from "./hooks/form/useFormValue";
export * from "./hooks/form/useSelectInput";
export * from "./hooks/form/useTextInput";
export * from "./hooks/primitives/useFocusManagement";
export * from "./hooks/primitives/useKeyboardNavigation";
export * from "./hooks/primitives/useRowLayout";
export * from "./hooks/primitives/useSubmissionControl";
export * from "./hooks/ui/use-mobile";
export * from "./hooks/ui/useTheme";

// Unified Component Architecture Exports - PRIMARY INTERFACE

// Main unified form input components (USE THESE BY DEFAULT)
export {
  FormInput,
  UnifiedFormInput,
} from "./form/modes/unified/UnifiedFormInput";

// Individual unified components (for advanced usage)
export { UnifiedAddressInput } from "./form/modes/unified/UnifiedAddressInput";
export { UnifiedDatePicker } from "./form/modes/unified/UnifiedDatePicker";
export { UnifiedFileUpload } from "./form/modes/unified/UnifiedFileUpload";
export { UnifiedLinearScale } from "./form/modes/unified/UnifiedLinearScale";
export { UnifiedMultiSelect } from "./form/modes/unified/UnifiedMultiSelect";
export { UnifiedRanking } from "./form/modes/unified/UnifiedRanking";
export { UnifiedRating } from "./form/modes/unified/UnifiedRating";

// Context provider for mode management
export { FormModeProvider, useFormMode } from "./form/context/FormModeContext";

// Main input container that routes to appropriate mode
export { InputContainer } from "./form/InputContainer";

// Base primitives - these provide the core logic
export * from "./form/primitives";

// Shared components for both modes
export * from "./form/modes/shared";

// Legacy mode-specific components (USE UNIFIED COMPONENTS ABOVE INSTEAD)
// Chat/AI mode components
export * from "./form/modes/chat";

// TypeForm mode components
export * from "./form/modes/typeform";
