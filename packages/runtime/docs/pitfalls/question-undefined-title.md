Pitfall — Cannot read properties of undefined (reading 'title')

Error

- Cannot read properties of undefined (reading 'title')

Root cause

- `question` was derived from FORM_SCHEMA instead of the runtime context, or `qId` is null/invalid.

Fix
// derive qId from the snapshot, and fetch question via runtime
const snap = React.useSyncExternalStore(rt.context.subscribe, rt.context.getSnapshot, rt.context.getSnapshot)
const qId = snap.currentId ?? snap.firstUnansweredId ?? snap.eligibleIds[0] ?? null
const question = qId ? rt.context.get.q(qId) : undefined
// guard before reading properties
return question ? <h2>{question.title}</h2> : null
