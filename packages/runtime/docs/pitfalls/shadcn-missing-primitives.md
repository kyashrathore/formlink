---
title: "Pitfall — ShadCnProvider missing primitives"
description: "Fix: provide required shadcn/ui primitives to ShadCnProvider components mapping."
---

# Pitfall — ShadCnProvider missing primitives

Error

```
Error: [ShadCnProvider] Missing required primitives: Input, Textarea, Label, Badge, ScrollArea, PopoverRoot, PopoverTrigger, PopoverContent, PopoverAnchor, CommandRoot, CommandList, CommandItem, CommandGroup, CommandEmpty, CommandInput, CommandSeparator.
Provide these via <ShadCnProvider components={...}>.
```

Root cause

- The runtime UI relies on host-provided shadcn/ui primitives. If you do not pass a mapping of these components, the provider throws.

Required primitives

- Input, Textarea, Label, Badge, ScrollArea
- PopoverRoot, PopoverTrigger, PopoverContent, PopoverAnchor
- CommandRoot, CommandList, CommandItem, CommandGroup, CommandEmpty, CommandInput, CommandSeparator

Fix

```tsx
import { ShadCnProvider, UniversalTypeform } from "@formlink/runtime/ui/react";
// Import your shadcn/ui components from your project (paths vary by app)
import {
  Input,
  Textarea,
  Label,
  Badge,
  ScrollArea,
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverAnchor,
  Command,
  CommandList,
  CommandItem,
  CommandGroup,
  CommandEmpty,
  CommandInput,
  CommandSeparator,
} from "@/components/ui"; // example alias

const components = {
  Input,
  Textarea,
  Label,
  Badge,
  ScrollArea,
  PopoverRoot: Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverAnchor,
  CommandRoot: Command,
  CommandList,
  CommandItem,
  CommandGroup,
  CommandEmpty,
  CommandInput,
  CommandSeparator,
};

export default function Page() {
  return (
    <ShadCnProvider components={components}>
      <UniversalTypeform />
    </ShadCnProvider>
  );
}
```

Checklist

- Install runtime: `pnpm add @formlink/runtime`
- Ensure shadcn/ui is installed in your app and exported from a central `@/components/ui` barrel.
- Pass the full mapping above to `ShadCnProvider components={...}`.
- Import runtime CSS once (root layout): `import "@formlink/runtime/ui/react/style.css"`.
