# Pitfall — useRuntime export missing

Error

- The "@formlink/runtime/ui/react" module does not provide an export named "useRuntime".

Explanation

- `useRuntime` is an internal hook used by packaged UI components. It is not part of the public `@formlink/runtime/ui/react` API.

Fix

- Do not import `useRuntime`. Instead, construct a runtime and subscribe with `useSyncExternalStore`.

Code "use client" import React from "react" import  createRuntime  from "@formlink/runtime"

const rt = createRuntime( form ) // or useMemo in a component const snap = React.useSyncExternalStore(rt.context.subscribe, rt.context.getSnapshot, rt.context.getSnapshot)

Also see

- examples/composed-react-wiring.md