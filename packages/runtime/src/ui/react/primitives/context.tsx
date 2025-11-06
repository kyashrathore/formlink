"use client";
import * as React from "react";

type UnknownProps = Record<string, unknown>;

// Minimal primitives map the runtime UI can consume from the host app.
// All keys are optional; components should gracefully fallback.
export type ShadCnPrimitives = {
  // Base
  Button?: React.ComponentType<UnknownProps>;
  Input?: React.ComponentType<UnknownProps>;
  Textarea?: React.ComponentType<UnknownProps>;
  Label?: React.ComponentType<UnknownProps>;
  Badge?: React.ComponentType<UnknownProps>;
  ScrollArea?: React.ComponentType<UnknownProps>;
  Separator?: React.ComponentType<UnknownProps>;
  // Avatar (optional)
  Avatar?: React.ComponentType<UnknownProps>;
  AvatarImage?: React.ComponentType<UnknownProps>;
  AvatarFallback?: React.ComponentType<UnknownProps>;
  // Date
  Calendar?: React.ComponentType<UnknownProps>; // shadcn Calendar wrapper (react-day-picker)

  // Popover
  PopoverRoot?: React.ComponentType<UnknownProps>;
  PopoverTrigger?: React.ComponentType<UnknownProps>;
  PopoverContent?: React.ComponentType<UnknownProps>;
  PopoverAnchor?: React.ComponentType<UnknownProps>;

  // Command
  CommandRoot?: React.ComponentType<UnknownProps>;
  CommandList?: React.ComponentType<UnknownProps>;
  CommandItem?: React.ComponentType<UnknownProps>;
  CommandGroup?: React.ComponentType<UnknownProps>;
  CommandEmpty?: React.ComponentType<UnknownProps>;
  CommandInput?: React.ComponentType<UnknownProps>;
  CommandSeparator?: React.ComponentType<UnknownProps>;

  // Optional PromptInput HoverCard primitives (from @formlink/ui/ai-elements)
  PromptInputHoverCard?: React.ComponentType<UnknownProps>;
  PromptInputHoverCardTrigger?: React.ComponentType<UnknownProps>;
  PromptInputHoverCardContent?: React.ComponentType<UnknownProps>;
  PromptInputButton?: React.ComponentType<UnknownProps>;

  // Field (shadcn registry variants)
  Field?: React.ComponentType<UnknownProps>; // Root
  FieldControl?: React.ComponentType<UnknownProps>;
  FieldDescription?: React.ComponentType<UnknownProps>;
  FieldMessage?: React.ComponentType<UnknownProps>;
  FieldLabel?: React.ComponentType<UnknownProps>;
  FieldGroup?: React.ComponentType<UnknownProps>;
  FieldLegend?: React.ComponentType<UnknownProps>;
  FieldSeparator?: React.ComponentType<UnknownProps>;
  FieldSet?: React.ComponentType<UnknownProps>;

  // Input Group
  InputGroup?: React.ComponentType<UnknownProps>; // Root
  InputGroupAddon?: React.ComponentType<UnknownProps>;
  InputGroupButton?: React.ComponentType<UnknownProps>;
  InputGroupText?: React.ComponentType<UnknownProps>;
  InputGroupInput?: React.ComponentType<UnknownProps>;
  InputGroupTextarea?: React.ComponentType<UnknownProps>;
};

const PrimitivesContext = React.createContext<ShadCnPrimitives | null>(null);

export function ShadCnProvider({
  components,
  children,
}: {
  components: ShadCnPrimitives;
  children: React.ReactNode;
}) {
  // Only run validation in development (avoid Node type requirement)
  const isDev =
    typeof globalThis !== "undefined" &&
    (globalThis as { process?: { env?: Record<string, unknown> } })?.process
      ?.env?.NODE_ENV !== "production";
  if (isDev) {
    // Validate a minimal set so common runtime components render correctly.
    const requiredKeys: Array<keyof ShadCnPrimitives> = [
      // Base
      "Button",
      // Useful for inputs used by some primitives
      "Input",
      "Textarea",
      "Label",
      "Badge",
      "ScrollArea",
      "Separator",
      // Popover/Command driven selects
      "PopoverRoot",
      "PopoverTrigger",
      "PopoverContent",
      "PopoverAnchor",
      "CommandRoot",
      "CommandList",
      "CommandItem",
      "CommandGroup",
      "CommandEmpty",
      "CommandInput",
      "CommandSeparator",
    ];
    const missing = requiredKeys.filter((k) => !components?.[k]);
    if (missing.length > 0) {
      throw new Error(
        `[ShadCnProvider] Missing required primitives: ${missing.join(", ")}.\n` +
          `Provide these via <ShadCnProvider components={...}>. See the runtime docs (normative spec) for the primitives mapping guide.`,
      );
    }
  }
  return (
    <PrimitivesContext.Provider value={components}>
      {children}
    </PrimitivesContext.Provider>
  );
}

export function useUiComponents(): ShadCnPrimitives {
  return React.useContext(PrimitivesContext) || {};
}
