---
title: "Example — Composed Wiring (no Universal)"
description: "Minimal reactive wiring using runtime actions/context with Typeform helpers."
---

# Example — Composed Wiring (no Universal)

Purpose: Minimal reactive wiring using runtime actions/context with Typeform helpers.

## Code

```jsx
"use client"
import React from "react"
import { createRuntime } from "@formlink/runtime"
import { RuntimeProvider, ShadCnProvider, TypeFormTextInput, TypeFormContinueFooter } from "@formlink/runtime/ui/react"
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
  // reactive snapshot
  const snap = React.useSyncExternalStore(rt.context.subscribe, rt.context.getSnapshot, rt.context.getSnapshot)
  const qId = snap.currentId ?? snap.firstUnansweredId ?? snap.eligibleIds[0] ?? null
  const q = qId ? rt.context.get.q(qId) : undefined
  async function onContinue() {
    if (!qId) return
    const res = await rt.actions.validate(qId)
    if (res.isValid) await rt.actions.next()
  }
  const primitives = { /* map your shadcn/ui primitives here */ } as any
  return (
    <RuntimeProvider runtime={rt} showDevtools>
      <ShadCnProvider components={primitives}>
        {q && (
          <div>
            <h1>{rt.context.form.title}</h1>
            <h2>{q.title}</h2>
            <TypeFormTextInput
              type={(q.type as any).format}
              value={String(rt.context.get.value(qId) ?? "")}
              onChange={(v) => rt.actions.set(qId, v)}
            />
            <div style={{ color: "red" }}>{rt.context.get.visibleError(qId)}</div>
            <TypeFormContinueFooter onClick={onContinue} isLoadingNext={snap.isSubmitting} />
          </div>
        )}
      </ShadCnProvider>
    </RuntimeProvider>
  )
}
```

## Notes

- Always subscribe via useSyncExternalStore for reactivity.