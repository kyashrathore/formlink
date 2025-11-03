"use client";

// Pure UI components (shadcn-style)
export * from "./components/kibo-ui/combobox";
export * from "./components/kibo-ui/dropzone";
export * from "./components/ui/accordion";
export * from "./components/ui/alert";
export * from "./components/ui/alert-dialog";
export * from "./components/ui/avatar";
export * from "./components/ui/badge";
export * from "./components/ui/breadcrumb";
export * from "./components/ui/button";
export * from "./components/ui/calendar";
export * from "./components/ui/card";
export * from "./components/ui/chart";
export * from "./components/ui/checkbox";
export * from "./components/ui/collapsible";
export * from "./components/ui/command";
export * from "./components/ui/dialog";
export * from "./components/ui/drawer";
export * from "./components/ui/dropdown-menu";
export * from "./components/ui/field";
export * from "./components/ui/form";
export * from "./components/ui/hover-card";
export * from "./components/ui/input";
export * from "./components/ui/input-group";
export * from "./components/ui/label";
export * from "./components/ui/menubar";
export * from "./components/ui/popover";
export * from "./components/ui/progress";
export * from "./components/ui/radio-group";
export * from "./components/ui/scroll-area";
export * from "./components/ui/select";
export * from "./components/ui/separator";
export * from "./components/ui/sheet";
export * from "./components/ui/sidebar";
export * from "./components/ui/skeleton";
export * from "./components/ui/sonner";
export * from "./components/ui/switch";
export * from "./components/ui/table";
export * from "./components/ui/tabs";
export * from "./components/ui/textarea";
export * from "./components/ui/toggle";
export * from "./components/ui/toggle-group";
export * from "./components/ui/tooltip";
export * from "./ui/scoped-drawer";

// Motion components
export * from "./motion/morphing-dialog";
export * from "./motion/progressive-blur";
export * from "./motion/scroll-button";
export * from "./motion/text-morph";
export * from "./motion/useClickOutside";

// Chat UI components (prompt-kit) - remaining components still in use

// AI Elements - new architecture components
// Includes: Message, MessageContent, MessageAvatar, Conversation, PromptInput, Tool, PromptSuggestion
export * from "./components/ai-elements/";

// Icons
export { default as ClaudeIcon } from "./icons/claude";
export { default as DeepSeekIcon } from "./icons/deepseek";
export { default as GeminiIcon } from "./icons/gemini";
export { default as GrokIcon } from "./icons/grok";
export { default as MistralIcon } from "./icons/mistral";
export { default as OpenAIIcon } from "./icons/openai";

// Store - REMOVED: UI package should be stateless
// All state management should be handled by the consuming application

// Form context removed from UI to keep package stateless

// Generic types for decoupled usage - IMPORT THESE FOR TYPE SAFETY
export * from "./types/generic";

// Hooks exports - organized by category
export * from "./hooks/typeform/useTypeFormScroll";
export * from "./hooks/typeform/useTypeFormSwipe";
export * from "./hooks/ui/use-mobile";
export * from "./hooks/ui/useTheme";

// Unified Component Architecture Exports - PRIMARY INTERFACE

// Main unified form input components (USE THESE BY DEFAULT)
// Note: UnifiedFormInput was removed as it used the registry system

// Individual unified components (for advanced usage)
export { UnifiedAddressInput } from "./form/modes/unified/UnifiedAddressInput";
export { UnifiedCountryList } from "./form/modes/unified/UnifiedCountryList";
export { UnifiedCountrySelect } from "./form/modes/unified/UnifiedCountrySelect";
export { UnifiedDatePicker } from "./form/modes/unified/UnifiedDatePicker";
export { UnifiedDropdownMultiSelect } from "./form/modes/unified/UnifiedDropdownMultiSelect";
export { UnifiedDropdownSelect } from "./form/modes/unified/UnifiedDropdownSelect";
export { UnifiedFileUpload } from "./form/modes/unified/UnifiedFileUpload";
export { UnifiedLikert } from "./form/modes/unified/UnifiedLikert";
export { UnifiedLinearScale } from "./form/modes/unified/UnifiedLinearScale";
export { UnifiedMultiSelect } from "./form/modes/unified/UnifiedMultiSelect";
export { UnifiedPhoneInput } from "./form/modes/unified/UnifiedPhoneInput";
export { UnifiedRanking } from "./form/modes/unified/UnifiedRanking";
export { UnifiedRating } from "./form/modes/unified/UnifiedRating";
export { UnifiedSignature } from "./form/modes/unified/UnifiedSignature";

// Context provider removed (should live in app)

// Base primitives - these provide the core logic
export * from "./form/primitives";

// Shared components for both modes
export * from "./form/modes/shared";

// Legacy mode-specific components (USE UNIFIED COMPONENTS ABOVE INSTEAD)
// Chat/AI mode components
export * from "./form/modes/chat";

// TypeForm mode components
export * from "./form/modes/typeform";
