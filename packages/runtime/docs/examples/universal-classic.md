---
title: "Example — Universal Classic"
description: "Mount the page/list UI via UniversalClassic with a headless runtime."
---

# Example — Universal Classic

Purpose: Mount the page/list UI via UniversalClassic with a headless runtime.

## Code

"use client"
import React from "react"
import { createRuntime } from "@formlink/runtime"
import { RuntimeProvider, ShadCnProvider, UniversalClassic } from "@formlink/runtime/ui/react"
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
const primitives = { /_ map your shadcn/ui primitives here _/ } as any
return (
<RuntimeProvider runtime={rt} showDevtools>
<ShadCnProvider components={primitives}>
<UniversalClassic />
</ShadCnProvider>
</RuntimeProvider>
)
}
