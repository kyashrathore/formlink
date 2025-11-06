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

// Motion components removed (unused in apps)

// Chat UI components (prompt-kit) - remaining components still in use

// AI Elements - new architecture components
// Includes: Message, MessageContent, MessageAvatar, Conversation, PromptInput, Tool, PromptSuggestion
export * from "./components/ai-elements/";

// Icons removed (related config removed and unused)

// Store - REMOVED: UI package should be stateless
// All state management should be handled by the consuming application

// Form context removed from UI to keep package stateless

// Generic types removed (unused)

// Hooks exports - organized by category
export * from "./hooks/ui/use-mobile";
export * from "./hooks/ui/useTheme";

// Unified form components and form primitives removed (moved to @formlink/runtime)
