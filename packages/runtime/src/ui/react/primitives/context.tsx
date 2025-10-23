"use client";
import * as React from "react";

// Minimal primitives map the runtime UI can consume from the host app.
// All keys are optional; components should gracefully fallback.
export type ShadCnPrimitives = {
  // Base
  Button?: React.ComponentType<any>;
  Input?: React.ComponentType<any>;
  Textarea?: React.ComponentType<any>;
  Label?: React.ComponentType<any>;
  Badge?: React.ComponentType<any>;
  ScrollArea?: React.ComponentType<any>;
  Separator?: React.ComponentType<any>;
  // Date
  Calendar?: React.ComponentType<any>; // shadcn Calendar wrapper (react-day-picker)

  // Popover
  PopoverRoot?: React.ComponentType<any>;
  PopoverTrigger?: React.ComponentType<any>;
  PopoverContent?: React.ComponentType<any>;
  PopoverAnchor?: React.ComponentType<any>;

  // Command
  CommandRoot?: React.ComponentType<any>;
  CommandList?: React.ComponentType<any>;
  CommandItem?: React.ComponentType<any>;
  CommandGroup?: React.ComponentType<any>;
  CommandEmpty?: React.ComponentType<any>;
  CommandInput?: React.ComponentType<any>;
  CommandSeparator?: React.ComponentType<any>;

  // Field (shadcn registry variants)
  Field?: React.ComponentType<any>; // Root
  FieldControl?: React.ComponentType<any>;
  FieldDescription?: React.ComponentType<any>;
  FieldMessage?: React.ComponentType<any>;
  FieldLabel?: React.ComponentType<any>;
  FieldGroup?: React.ComponentType<any>;
  FieldLegend?: React.ComponentType<any>;
  FieldSeparator?: React.ComponentType<any>;
  FieldSet?: React.ComponentType<any>;

  // Input Group
  InputGroup?: React.ComponentType<any>; // Root
  InputGroupAddon?: React.ComponentType<any>;
  InputGroupButton?: React.ComponentType<any>;
  InputGroupText?: React.ComponentType<any>;
  InputGroupInput?: React.ComponentType<any>;
  InputGroupTextarea?: React.ComponentType<any>;
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any)?.process?.env?.NODE_ENV !== "production";
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
          `Provide these via <ShadCnProvider components={...}>. See docs/runtime/formlink-runtime-spec_v1.md for the mapping guide.`,
      );
    }
  }
  return (
    <PrimitivesContext.Provider value={components}>
      {children}
    </PrimitivesContext.Provider>
  );
}

export function usePrimitives(): ShadCnPrimitives {
  return React.useContext(PrimitivesContext) || {};
}
