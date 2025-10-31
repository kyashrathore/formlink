Pitfall — Start button does nothing

Symptom

- Clicking “Start” leaves the UI unchanged; status stays "idle".

Root cause

- Component never subscribes to the runtime store, so state changes don’t trigger rerenders.

Fix
"use client"
import React from "react"
import { createRuntime } from "@formlink/runtime"

export default function View() {
const rt = React.useMemo(() => createRuntime({ form, uiMode: "typeform" }), [])
const snap = React.useSyncExternalStore(rt.context.subscribe, rt.context.getSnapshot, rt.context.getSnapshot)
if (snap.status === "idle") return <button onClick={() => rt.actions.start()}>Start</button>
return <div>Filling…</div>
}

Notes

- Wrapping with RuntimeProvider is optional for Devtools/contexts, but subscription is required for reactivity.
