---
title: "Example — Universal Classic"
description: "Mount the page/list UI via ClassicTemplate with a headless runtime."
---

# Example — Universal Classic

Purpose: Mount the page/list UI via ClassicTemplate with a headless runtime.

## Code

```jsx
"use client"
import React from "react"
import { createRuntime } from "@formlink/runtime"
import { RuntimeProvider, ShadCnProvider, ClassicTemplate } from "@formlink/runtime/ui/react"
import type { Form } from "@formlink/runtime/schema"
import "@formlink/runtime/ui/react/style.css"

const form: Form = {
  id: "example",
  title: "Example Form",
  questions: [
    { id: "name", title: "Name", type: { name: "text", format: "text" }, validations: { required: { value: true } } },
  ],
}

export default function Example() {
  const rt = React.useMemo(() => createRuntime({ form, uiMode: "classic" }), [])
  const primitives = { /* map your shadcn/ui primitives here */ } as any
  return (
    <RuntimeProvider runtime={rt} showDevtools>
      <ShadCnProvider components={primitives}>
        <ClassicTemplate />
      </ShadCnProvider>
    </RuntimeProvider>
  )
}
```
