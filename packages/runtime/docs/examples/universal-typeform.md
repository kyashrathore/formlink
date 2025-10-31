---
title: "Example — Universal Typeform"
description: "Mount the one-by-one Typeform-style UI via UniversalTypeform with a headless runtime."
---

# Example — Universal Typeform

Purpose: Mount the one-by-one Typeform-style UI via UniversalTypeform with a headless runtime.

## Code

"use client"
import React from "react"
import { createRuntime } from "@formlink/runtime"
import { RuntimeProvider, ShadCnProvider, UniversalTypeform } from "@formlink/runtime/ui/react"
import type { Form } from "@formlink/runtime/schema"
import "@formlink/runtime/ui/react/style.css"

const form: Form = {
id: "example",
title: "Example Form",
questions: [
{ id: "email", title: "Email", type: { name: "text", format: "email" }, validations: { required: { value: true } } },
],
}

export default function Example() {
const rt = React.useMemo(() => createRuntime({ form, uiMode: "typeform" }), [])
const primitives = { /_ map your shadcn/ui primitives here _/ } as any
return (
<RuntimeProvider runtime={rt} showDevtools>
<ShadCnProvider components={primitives}>
<UniversalTypeform />
</ShadCnProvider>
</RuntimeProvider>
)
}

## Notes

- Provide shadcn primitives via ShadCnProvider. See formlink-runtime-spec_v1_normative_only.md.
