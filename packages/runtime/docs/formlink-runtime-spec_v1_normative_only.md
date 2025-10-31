# Formlink Runtime Codegen Specification (v1)

**Audience**: LLM Codegen Agents & Human Developers
**Purpose**: This is the single source of truth for the Formlink runtime. It serves as both a technical specification and an instruction manual for generating code. Adhere strictly to these rules.

---

## 0.0 Scope

- This document defines the public runtime contracts and the recommended wiring patterns. It is tooling‑agnostic.

## 0. Quickstart

Install

- pnpm add @formlink/runtime react react-dom

CSS

- Import once: `import '@formlink/runtime/ui/react/style.css'` (e.g., app root layout or global stylesheet entry).

Client components

- If you are using a framework that can render on the server (e.g., Next.js, Remix, TanStack Router with SSR/hybrid), files that call `createRuntime`, read `runtime.context`, or render runtime/UI primitives should begin with `'use client'`.
- If you are building a pure SPA with Vite/Bun (no SSR), `'use client'` is not required.

Create a runtime (draft transport)

- Import correctly. `createRuntime` is from `@formlink/runtime`.
- There is no `mockTransportInDraft` export. Alias `createMockTransport`:
  `import { createMockTransport as mockTransportInDraft } from '@formlink/runtime'`.
- Assume draft mode by default and pass `transport: mockTransportInDraft()`.
- The concept of “published vs draft” is internal to Formlink orchestration. Treat all examples here as draft.

## 0.2 File Layout & Routes

- Single file: generate all form code into one file under `components/` using a descriptive name based on the form’s context, not the short id. Examples: `components/JobApplicationForm.tsx`, `components/CustomerFeedbackForm.tsx`.
  - Naming rules: PascalCase, suffix with `Form`, derive from `form.title` when available; strip non‑alphanumerics and keep under 30 characters. If a file collision occurs, append a numeric suffix (e.g., `JobApplicationForm2`).
- Route path: serve the generated form at the home route `/` inside this app.
  - Rationale: `formlink.ai/f/[shortId]` will redirect to the root of this app. Do not declare an internal `/f/[shortId]` route here.
- Next.js Pages Router: create `pages/index.tsx` that re-exports the default export from your generated component (e.g., `@/components/JobApplicationForm`).
- Next.js App Router: create `app/page.tsx` that re-exports the default export from your generated component (e.g., `@/components/JobApplicationForm`).
- Vite/SPA (default template: Bun + Vite)
  - Keep each page as a component; define routes in `App.tsx`.
  - Bind the generated component to the home route:

Notes

- Keep `showDevtools` enabled for this component until the form is published; publishing swaps the transport in the backend—no code change needed.

### 0.2.1 Placement Rules (Existing Pages)

- If the instructions specify a target location (e.g., “add a form on the current homepage” or “add a form on the About page”), do not replace the route or page. Import the generated component and render it inside the specified page where it fits (e.g., after the hero, within a section block).
- Do not remove unrelated routes or existing content. Only augment the specified page.
- Default binding to `/` only applies to the empty template or when no placement is specified.

Examples

Next.js App Router (embed in About page)

Next.js Pages Router (embed in Home page)

Vite/SPA (React Router, embed in Home page component)

## 0.3 Dev Workflow

- Validate types and lint per your project standards. Preferred commands: `pnpm typecheck`, `pnpm lint`.

---

## Classic Nodes API (v1.1)

The Classic renderer accepts a schema (Form.questions) and an optional `nodes` prop that controls layout. This enables “schema in → UI out” with precise placement for non‑persisted elements, and custom rendering when needed.

- Component
  - `import { UniversalClassic } from '@formlink/runtime/ui/react'`
  - `<UniversalClassic nodes={nodes} />`
  - If `nodes` is omitted, Classic falls back to rendering `form.questions` using any `styling.colSpan` and `styling.as` hints.

- Node union (passed via `nodes` prop)
  - FieldNode: `{ kind: 'field'; id?: string; qId: string; colSpan?: 1|..|12; node?: (ctx)=>ReactNode }`
  - ElementNode: `{ kind: 'element'; id?: string; colSpan?: 1|..|12; node: (schema:any)=>ReactNode }`

- FieldNode custom renderer
  - Optional `node(ctx)` replaces the default field UI while keeping the field bound to the runtime.
  - `ctx` shape: `{ q, question, value, set(next), error?, runtime }`.
  - Use `ctx.set(next)` to update the persisted value (e.g., checkbox + legal text).

- ElementNode custom renderer
  - `node(schema)` renders any React node. Elements are non‑persisted UI; use schema copy (title/description) when you want text to live in the schema.
  - If `node` is omitted and the legacy `styling.as` exists on a question, Classic still supports the built‑in roles: `heading | subheading | separator | oauth | info | legal | spacer` (back‑compat only).

- Grid
  - Desktop spans use a fixed map to `md:col-span-N` (1..12). Mobile stacks vertically.

- Example (Classic)

  ```tsx
  <UniversalClassic
    nodes={[
      {
        kind: "element",
        id: "hdr",
        colSpan: 12,
        node: () => (
          <div className="rounded-md border p-3 bg-muted/40">
            <div className="text-sm text-muted-foreground">Welcome</div>
            <div className="text-xl font-semibold">Join Rocket Club</div>
          </div>
        ),
      },
      {
        kind: "element",
        id: "oauth",
        colSpan: 12,
        node: () => (
          <div className="flex gap-3">
            <Button variant="outline">Continue with Google</Button>
            <Button variant="outline">Continue with GitHub</Button>
          </div>
        ),
      },
      {
        kind: "element",
        id: "or",
        colSpan: 12,
        node: () => (
          <div className="flex items-center gap-3 my-2">
            <Separator className="flex-1" />
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              OR
            </span>
            <Separator className="flex-1" />
          </div>
        ),
      },
      { kind: "field", id: "n1", qId: "first_name", colSpan: 6 },
      { kind: "field", id: "n2", qId: "last_name", colSpan: 6 },
      { kind: "field", id: "n3", qId: "email", colSpan: 12 },
      {
        kind: "field",
        id: "consent",
        qId: "consent_terms",
        colSpan: 12,
        node: (ctx) => (
          <label className="flex items-start gap-2">
            <Checkbox
              id="consent_terms"
              checked={Boolean(ctx.value)}
              onCheckedChange={(ck) => ctx.set(ck === true)}
            />
            <span className="text-sm">I agree to Terms & Privacy</span>
          </label>
        ),
      },
      {
        kind: "element",
        id: "note",
        colSpan: 12,
        node: () => (
          <div className="text-xs text-muted-foreground">
            By continuing you agree to our Terms & Privacy.
          </div>
        ),
      },
    ]}
    // For multi-step flows, hide the built-in submit button and render your own actions in nodes
    showDefaultSubmit={false}
  />
  ```

- Devtools
  - Devtools shows only persisted fields. UI‑only elements (including nodes passed to Classic) are intentionally hidden in the Questions list.

Compatibility

- Typeform mode is unchanged; keep using `UniversalTypeform`.
- Legacy question hints (`styling.as`, `styling.colSpan`) are still honored when `nodes` isn’t provided but are considered deprecated in favor of the `nodes` prop.

### Classic Multi‑Step (client‑controlled)

Classic does not impose a step system. Instead, you can implement steps by controlling the `nodes` prop in your page component and using an element node to render Back/Continue/Submit actions. This keeps rendering instant and fully under your app’s control.

```tsx
"use client";
import React from "react";
import {
  createRuntime,
  createMockTransport as mockTransportInDraft,
} from "@formlink/runtime";
import {
  RuntimeProvider,
  ShadCnProvider,
  UniversalClassic,
} from "@formlink/runtime/ui/react";
import { Button, Separator } from "@formlink/ui";
import type { Form } from "@formlink/runtime/schema";

const form: Form = {
  id: "classic_steps_demo",
  version_id: "v1",
  current_published_version_id: null,
  current_draft_version_id: "v1",
  title: "Apply — Multi‑Step",
  description: "Step through profile, details, and consent.",
  questions: [
    {
      id: "first_name",
      questionNo: 1,
      title: "First name",
      styling: { colSpan: 12 },
      type: { name: "text", format: "text" },
      validations: { required: { value: true } },
      submissionBehavior: "manualAnswer",
    },
    {
      id: "last_name",
      questionNo: 2,
      title: "Last name",
      styling: { colSpan: 12 },
      type: { name: "text", format: "text" },
      validations: { required: { value: true } },
      submissionBehavior: "manualAnswer",
    },
    {
      id: "email",
      questionNo: 3,
      title: "Email",
      styling: { colSpan: 12 },
      type: { name: "text", format: "email" },
      validations: { required: { value: true } },
      submissionBehavior: "manualAnswer",
    },
    {
      id: "consent_terms",
      questionNo: 4,
      title: "I agree to Terms & Privacy",
      styling: { colSpan: 12 },
      type: {
        name: "singleChoice",
        display: "checkbox",
        options: [{ value: "yes", label: "I agree", score: 0 }],
      },
      validations: { required: { value: true } },
      submissionBehavior: "manualAnswer",
    },
  ],
  settings: { defaultMode: "classic", branching: { enabled: false } },
};

export function ClassicStepsPage() {
  const rt = React.useMemo(
    () =>
      createRuntime({
        form,
        transport: mockTransportInDraft(),
        uiMode: "classic",
      }),
    [],
  );
  const [step, setStep] = React.useState(0);

  // Define steps as arrays of nodes; close over `rt` and `step` in element.node
  const steps: any[][] = [
    [
      {
        kind: "element",
        id: "hdr1",
        colSpan: 12,
        node: () => <h3 className="text-xl font-semibold">Profile</h3>,
      },
      { kind: "field", id: "fn", qId: "first_name", colSpan: 6 },
      { kind: "field", id: "ln", qId: "last_name", colSpan: 6 },
    ],
    [
      {
        kind: "element",
        id: "hdr2",
        colSpan: 12,
        node: () => <h3 className="text-xl font-semibold">Contact</h3>,
      },
      { kind: "field", id: "em", qId: "email", colSpan: 12 },
    ],
    [
      {
        kind: "element",
        id: "hdr3",
        colSpan: 12,
        node: () => <h3 className="text-xl font-semibold">Consent</h3>,
      },
      { kind: "field", id: "ct", qId: "consent_terms", colSpan: 12 },
    ],
  ];

  const ActionsBar = {
    kind: "element",
    id: "actions",
    colSpan: 12,
    node: () => (
      <div className="flex items-center justify-between mt-4">
        <Button
          type="button"
          variant="outline"
          disabled={step === 0}
          onClick={() => setStep((s) => Math.max(0, s - 1))}
        >
          Back
        </Button>
        <Button
          type="button"
          onClick={async () => {
            // Validate only the fields in the current step
            const qIds = steps[step]
              .filter((n) => n.kind === "field")
              .map((n) => (n as any).qId as string);
            const results = await Promise.all(
              qIds.map((id) => rt.actions.validate(id)),
            );
            const allValid = results.every((r) => r.isValid);
            if (!allValid) return;
            if (step < steps.length - 1) setStep((s) => s + 1);
            else await rt.actions.submit();
          }}
        >
          {step < steps.length - 1 ? "Continue" : "Submit"}
        </Button>
      </div>
    ),
  };

  const nodes = [
    {
      kind: "element",
      id: "intro",
      colSpan: 12,
      node: () => (
        <div className="mb-2">
          <div className="text-sm text-muted-foreground">
            Step {step + 1} of {steps.length}
          </div>
          <Separator className="mt-2" />
        </div>
      ),
    },
    ...steps[step],
    ActionsBar,
  ];

  return (
    <ShadCnProvider components={{ Button, Separator }}>
      <RuntimeProvider runtime={rt} showDevtools>
        <UniversalClassic nodes={nodes} showDefaultSubmit={false} />
      </RuntimeProvider>
    </ShadCnProvider>
  );
}
```

Notes

- Multi‑step here is client‑controlled. You decide what belongs to each step and when to advance.
- `element.node` functions can close over local state (`step`) and the runtime (`rt`) for validation and submission.
- For one‑at‑a‑time steps with keyboard/swipe navigation, use `UniversalTypeform` instead.

Minimal Devtools support (Classic multi‑step)

- To support Devtools “jump to question” in a multi‑step flow, listen for the custom event and switch steps accordingly:

```tsx
// Build a map from qId → step index
const stepIndexByQId = React.useMemo(() => {
  const m = new Map<string, number>();
  steps.forEach((arr, idx) => {
    arr.forEach((n) => {
      if (n.kind === "field") m.set((n as any).qId, idx);
    });
  });
  return m;
}, [steps]);

React.useEffect(() => {
  const onGoto = (ev: Event) => {
    const e = ev as CustomEvent<{ questionId?: string }>;
    const qid = e.detail?.questionId;
    if (!qid) return;
    const idx = stepIndexByQId.get(qid);
    if (typeof idx === "number") setStep(idx);
  };
  window.addEventListener("formlink:devtools:goto", onGoto as any);
  return () =>
    window.removeEventListener("formlink:devtools:goto", onGoto as any);
}, [stepIndexByQId]);
```

---

## 0.1 ShadCnProvider (Host‑provided shadcn components)

Runtime UI components are provider‑driven. Supply your app’s shadcn‑style primitives directly via `ShadCnProvider`. Do not create a wrapper; use the provider inline where you render the form component.

Important: This assumes your app already exposes shadcn/ui primitives under paths like `@/components/ui`, `@/components/ui/popover`, and `@/components/ui/command`. If not, set up shadcn/ui first using their manual installation guide:

- https://ui.shadcn.com/docs/installation/manual

Minimal wiring (Next.js or SPA):

### Exact Keys Required (Provider Mapping)

| Group   | Keys                                                                                                            |
| ------- | --------------------------------------------------------------------------------------------------------------- |
| Popover | `PopoverRoot`, `PopoverTrigger`, `PopoverContent`, `PopoverAnchor`                                              |
| Command | `CommandRoot`, `CommandList`, `CommandItem`, `CommandGroup`, `CommandEmpty`, `CommandInput`, `CommandSeparator` |

Note: map these names exactly. Components may wrap Radix primitives under different export names in your registry; alias to the above keys.

> TypeScript footnote (shadcn registries)
>
> - Many registries assume `exactOptionalPropertyTypes: false` and may access index signatures.
> - If types complain, either widen props locally or set `exactOptionalPropertyTypes: false` and `noPropertyAccessFromIndexSignature: false` in your app `tsconfig`.

---

## Reactivity (Required)

Always subscribe to the runtime store so UI re-renders on state changes.

- Wrap your page with `RuntimeProvider` and pass a non‑null `runtime` instance.
- Subscribe using `useSyncExternalStore` with `runtime.context.subscribe` and
  `runtime.context.getSnapshot`. Do not rely on a module variable without subscribing;
  clicking Start will appear to “do nothing” because React won’t re-render.

Minimal pattern:

```
'use client'
import * as React from 'react'
import { useSyncExternalStore } from 'react'
import { createRuntime, createMockTransport as mockTransportInDraft } from '@formlink/runtime'
import { RuntimeProvider, ShadCnProvider, TypeFormTextInput, TypeFormContinueFooter, InlineSelect, InlineMultiSelect, UnifiedDropdownSelect, UnifiedDropdownMultiSelect, UnifiedFileUpload } from '@formlink/runtime/ui/react'
import type { Form } from '@formlink/runtime/schema'
import '@formlink/runtime/ui/react/style.css'

// Map your design system primitives — these keys are required in dev:
// Button, Input, Textarea, Label, Badge, ScrollArea, Separator,
// PopoverRoot/Trigger/Content/Anchor, CommandRoot/List/Item/Group/Empty/Input/Separator
import { Button, Input, Textarea, Label, Badge, ScrollArea, Separator } from '@/components/ui/your-ds'
import { Popover, PopoverTrigger, PopoverContent, PopoverAnchor } from '@/components/ui/popover'
import { Command, CommandList, CommandItem, CommandGroup, CommandEmpty, CommandInput, CommandSeparator } from '@/components/ui/command'

const components = { Button, Input, Textarea, Label, Badge, ScrollArea, Separator,
  PopoverRoot: Popover, PopoverTrigger, PopoverContent, PopoverAnchor,
  CommandRoot: Command, CommandList, CommandItem, CommandGroup, CommandEmpty, CommandInput, CommandSeparator }

const FORM: Form = { id: 'example', title: 'Example', description: 'Demo', questions: [ /* ... */ ] }

// Create a stable runtime once per mount
function useRuntime() {
  return React.useMemo(() => (
    createRuntime({ form: FORM, transport: mockTransportInDraft(), uiMode: 'typeform' })
  ), [])
}

function useRuntimeSnapshot(rt: ReturnType<typeof useRuntime>) {
  return useSyncExternalStore(rt.context.subscribe, rt.context.getSnapshot, rt.context.getSnapshot)
}

export default function Page() {
  const rt = useRuntime()
  return (
    <RuntimeProvider runtime={rt} showDevtools>
      <ShadCnProvider components={components}>
        <Content rt={rt} />
      </ShadCnProvider>
    </RuntimeProvider>
  )
}

function Content({ rt }: { rt: ReturnType<typeof useRuntime> }) {
  const snap = useRuntimeSnapshot(rt)
  const qId = snap.currentId ?? snap.firstUnansweredId ?? snap.eligibleIds[0] ?? null
  const onContinue = async () => {
    if (!qId) return
    const res = await rt.actions.validate(qId)
    if (res.isValid) {
      const hasNext = snap.progress.index < snap.progress.total - 1
      return hasNext ? rt.actions.next() : rt.actions.submit()
    }
  }
  if (snap.status === 'idle') {
    return <Button onClick={() => rt.actions.start()}>Start</Button>
  }
  // render based on question type, e.g.:
  // <TypeFormTextInput value={String(rt.context.get.value(qId) ?? '')} onChange={(v) => rt.actions.set(qId, v)} />
  return null
}
```

---

## Devtools API (Version‑safe)

- Use `<RuntimeProvider showDevtools>`.

---

## Schema Types (Required)

- Always import types from `@formlink/runtime/schema`. Do not use `@formlink/schema` and do not use `any`/hand‑rolled types.

Required primitives by component (runtime/ui):

- UnifiedDropdownSelect / UnifiedDropdownMultiSelect / UnifiedCountrySelect
  - Requires: `Button` and the Popover + Command keys mapped in ShadCnProvider.
- InlineSelect / InlineRating / InlineSignature / TypeForm\* primitives
  - Use plain HTML + Tailwind for layout; no extra keys beyond Button.

Draft transport

- Use `transport: mockTransportInDraft()` during draft. Publishing swaps to the real transport server‑side automatically.

---

## Common Import Mistakes (Fixes)

- Error: "The '@formlink/runtime/ui/react' module does not provide an export named 'createRuntime'" → Import `createRuntime` from `@formlink/runtime`.
- Error: "The '@formlink/runtime' module does not provide an export named 'mockTransportInDraft'" → Import `createMockTransport` and alias: `import { createMockTransport as mockTransportInDraft } from '@formlink/runtime'`.

---

## Common Pitfalls

- Start button does nothing (no UI change)
  - Cause: reading `rt.context.getSnapshot()` once without subscribing; React doesn’t know the runtime store changed.
  - Fix: use `useSyncExternalStore(rt.context.subscribe, rt.context.getSnapshot, rt.context.getSnapshot)` and re-render from the returned snapshot. Ensure `RuntimeProvider` receives a non-null `runtime` created with `useMemo` before render.

- Provider receives `null` runtime on first render
  - Cause: creating `rt` inside `useEffect` or module variable set later.
  - Fix: `const rt = useMemo(() => createRuntime({...}), [])`; pass it directly to `<RuntimeProvider runtime={rt} ... />`.

- Missing primitives in `ShadCnProvider`
  - Symptom: runtime throws in dev: “Missing required primitives …”.
  - Fix: provide at least these keys: `Button, Input, Textarea, Label, Badge, ScrollArea, Separator, PopoverRoot/Trigger/Content/Anchor, CommandRoot/List/Item/Group/Empty/Input/Separator`.

- File upload value never sticks
  - Cause: not setting the returned descriptor from `rt.actions.upload`.
  - Fix: in `UnifiedFileUpload`’s `onFileUpload`, call `const d = await rt.actions.upload(qId, file); rt.actions.set(qId, d);`.

- Incorrect imports for runtime/API
  - Fix: `createRuntime` from `@formlink/runtime`. Alias draft transport: `import { createMockTransport as mockTransportInDraft } from '@formlink/runtime'`. UI components from `@formlink/runtime/ui/react`.

- Runtime UI unstyled
  - Cause: CSS not imported.
  - Fix: import `@formlink/runtime/ui/react/style.css` once in your app entry or root layout.

---

## Schema Generation Hints (for any AI)

These rules help assistants produce schemas that map cleanly to the runtime UI without extra repair.

- Choice `display` is derived from option count:
  - `singleChoice`: 1–5 → `radio`, ≥6 → `dropdown`.
  - `multipleChoice`: 1–5 → `checkbox`, ≥6 → `multiSelectDropdown`.
- Text `format` reflects semantics:
  - `email`, `url`, `tel`, `country`, `textarea`; otherwise `text`.
- Option objects: `{ value: string; label: string; score: number }` with 2–7 items and unique `value` slugs.
- Only include `validations` when explicitly requested (e.g., required, minLength, regex). The runtime will validate types implied by `format`.

These conventions ensure the renderer selects Inline* vs Unified* components correctly and shows errors in the expected places (inline + Typeform footer).

## 1. Core Concepts

1.  **Architecture**: A **headless runtime** (`@formlink/runtime`) manages all state and logic. UI components come from your app's design system wired via `ShadCnProvider` or the primitives under `@formlink/runtime/ui/react`.
2.  **Single Source of Truth**: The runtime is the **only** source of truth for form state. Your generated UI code must **never** use `useState` or other hooks to manage form data.
3.  **Packages**:
    - `@formlink/runtime`: The headless logic engine.
    - Your own UI primitives: provided via a shadcn-style registry and mapped through `ShadCnProvider`.
    - `@formlink/chat`: A specialized adapter for conversational forms.

---

## 2. Form Schema Contract

This section defines the JSON structure for a form, which is generated by a separate AI based on a user prompt. Your goal is to generate a UI that correctly interprets this schema.

### Top-Level `Form` Object

- `id`: `string` - Unique identifier for the form.
- `title`: `string` - The main title of the form.
- `description`: `string` (optional) - A subtitle or description.
- `questions`: `Question[]` - An array of question objects.
- `settings`: `object` (optional) - Contains settings for the form.

### `Question` Object

- `id`: `string` - A unique identifier for the question (e.g., `q1_full_name`).
- `title`: `string` - The main text of the question/label.
- `description`: `string` (optional) - Additional help text.
- `validations`: `object` (optional) - A map of validation rules (e.g., `{ "required": { "value": true } }`).
- `type`: `object` - **This is a discriminated union.** The `name` property determines the question type and the other properties available within the `type` object.

### Question Types (Discriminated by `type.name`)

- `name: 'text'`
  - `format`: `string` - e.g., `"text"`, `"textarea"`, `"email"`, `"url"`, `"number"`.
- `name: 'singleChoice' | 'multipleChoice'`
  - `display`: `string` - e.g., `"radio"`, `"dropdown"`, `"checkbox"`.
  - `options`: `Array<{ value: string, label: string, score: number }>`.
- `name: 'rating'`
  - `config`: `{ min: number, max: number, step: number, minLabel?: string, maxLabel?: string }`.
- `name: 'linearScale'`
  - `config`: `{ start: number, end: number, step: number, startLabel?: string, endLabel?: string }`.
- `name: 'likertScale'`
  - `options`: `string[]` - An array of labels (e.g., `["Strongly Disagree", ..., "Strongly Agree"]`).
- `name: 'ranking'`
  - `options`: `Array<{ value: string, label: string, score: number }>`.
- `name: 'date'`
  - `format`: `string` - e.g., `"date"`, `"dateRange"`.
- `name: 'fileUpload'`, `name: 'address'`, `name: 'signature'`: These types have no additional properties within the `type` object.

### `settings` Object

- `branching`: `{ enabled: boolean }` - Must be true to enable branching.
- `journeyScript`: `string` - An **XML string** (not JavaScript) that describes the high-level branching logic for the backend to interpret. The client runtime reads the _result_ of this logic in `context.visibleIds`.

### Schema-to-Validator Translation (Internal Runtime Process)

The runtime internally translates the declarative `FormSchema` into an executable `zod` validation schema that is then used by TanStack Form. This process happens automatically within `createRuntime`.

1.  **Iteration**: The runtime iterates through the `form.questions` array.
2.  **Dynamic Zod Chain Construction**: For each `question`, it constructs a `zod` validator chain by mapping the schema rules to Zod methods.
    - `validations.required: true` -> `.min(1, "...")` or `.nonempty()`
    - `type.format: 'email'` -> `.email()`
    - `validations.minLength` -> `.min()`
    - `validations.pattern` -> `.regex()`
3.  **Assembly**: It assembles these individual validators into a single `z.object({...})`, where keys are the question `id`s.

This architecture allows the `FormSchema` to remain simple and AI-friendly, while the runtime handles the complex task of creating the executable validation logic.

---

## 3. Runtime API (`@formlink/runtime`)

### Initialization (draft)

Publish will switch the transport to the real backend automatically; no changes in this component are needed.

Notes

- Mock transport is for development and demos; do not ship to production.
- `createMockTransport` produces object URLs for File uploads by default; set `revokeAfterMs` to auto‑revoke or disable with `generateObjectUrl: false`.
- Devtools can also run in overlay mode (default). Use dock‑left to keep the page visible.

### Reading State (`context`)

- `context.status`: The overall state of the form: `'idle' | 'filling' | 'submitting' | 'completed' | 'error'`.
- `context.currentId`: The ID of the current question (for Typeform-like flows).
- `context.visibleIds`: An array of all currently visible question IDs (for Classic flows).
- `context.progress`: An object `{ index, total, percent }`.
- `context.get.q(qId)`: Returns the question object.
- `context.get.value(qId)`: Returns the question's current answer.
- `context.get.error(qId)`: Returns the first validation error for a question.

### Changing State (`actions`)

- `actions.start()`: Begins the form, changing `status` from `'idle'` to `'filling'`.
- `actions.set(qId, value)`: Sets an answer.
- `actions.validate(qId)` / `actions.validateAll()`: Trigger validation.
- `actions.next()` / `actions.prev()` / `actions.goTo(qId)`: Handle navigation.
- `actions.submit()`: Submits the form. Manages the `'submitting'` and `'completed'` statuses.
- `actions.reset()`: Resets the form and returns `status` to `'idle'`.

---

## 4. UI Generation Rules & Patterns

### Overall Structure: The Status Machine

Your top-level component **MUST** use `context.status` to route between the different stages of the user journey.

REQUIRED — Completion behavior

- When `context.status === 'completed'`, the UI MUST render a dedicated completion/thank‑you view and MUST NOT render the form controls anymore.
- The completion view can be a simple message card or a full‑page screen, but it should clearly indicate success and provide an optional action (e.g., `Restart` via `actions.reset()` and then `actions.start()`).
- Do not leave the user on the last step with inputs visible after a successful `actions.submit()`; swap the view immediately on status change.
- Stories generated for documentation and testing MUST implement this behavior (acceptance criteria).

## 5. UI Component Reference

### Allowed Imports

- `@formlink/runtime`: `createRuntime`, `createMockTransport as mockTransportInDraft`
- `@formlink/runtime/ui/react`: `RuntimeProvider`, `ShadCnProvider`, `Inline*`, `Unified*`, and Typeform primitives (`TypeForm*`)
- `@formlink/runtime/schema`: types (`Form`, `Question`, …)
- `motion/react`: `motion`, `AnimatePresence` (optional)

## 7. Available Runtime UI Components

## Typeform Mode: Canonical Mapping and Error Flow

This section is normative. Agents MUST follow these rules for Typeform‑style flows.

### Component Mapping (Typeform)

All components referenced below are exported from `@formlink/runtime/ui/react`. This table applies specifically to Typeform mode.

- text.format = `tel` → `UnifiedPhoneInput` with `mode="typeform"`.
  - Set `preventInvalidSubmit` so Enter does not advance when invalid.
  - Wire `onSubmit={onContinue}` and `onChange={(v) => rt.actions.set(qid, v)}`.
- text.format = `country` → `UnifiedCountrySelect` with `mode="typeform"`.
  - Use `buildCountryOptions()` for options.
  - Wire `onSubmit` and `onChange` the same way.
- fileUpload → `UnifiedFileUpload` with `mode="typeform"`.
  - In `onFileUpload(qid, file)`, call `await rt.actions.upload(qid, file)`; set the returned descriptor with `rt.actions.set(qid, desc)`.
- singleChoice:
  - 1–5 options → `InlineSelect` (Typeform list).
  - ≥6 options → `UnifiedDropdownSelect` with `mode="typeform"`.
- multipleChoice:
  - 1–5 options → `InlineMultiSelect` (checklist, keyboard‑first).
  - ≥6 options → `UnifiedDropdownMultiSelect` with `mode="typeform"`.

Always import runtime UI CSS once in your entry (e.g., `src/main.tsx` or root layout):

### 5.3 Normative Component Mapping (Typeform Mode)

This is the single source of truth for mapping a schema question to a React component. Do not deviate.

| If `q.type.name` is… | And `q.type.format` is…                              | You MUST use this component (props abbreviated)                                                                                                                                       |
| :------------------- | :--------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `text`               | `tel`                                                | `<UnifiedPhoneInput mode="typeform" value={String(rt.context.get.value(qId) ?? '')} onChange={(v)=>rt.actions.set(qId,v)} onSubmit={onContinue} preventInvalidSubmit />`              |
| `text`               | `country`                                            | `<UnifiedCountrySelect mode="typeform" options={buildCountryOptions()} value={rt.context.get.value<string                                                                             | null>(qId) ?? null} onChange={(v)=>rt.actions.set(qId,v)} onSubmit={onContinue} />`                              |
| `text`               | `textarea`                                           | `<TypeFormTextInput value={String(rt.context.get.value(qId) ?? '')} onChange={(v)=>rt.actions.set(qId,v)} />` (Note: submit handled by footer; there is no `multiline` prop)          |
| `text`               | `email` \| `url` \| `text` \| `password` \| `number` | `<TypeFormTextInput type={q.type.format} value={String(rt.context.get.value(qId) ?? '')} onChange={(v)=>rt.actions.set(qId,v)} onSubmit={onContinue} />`                              |
| `singleChoice`       | options ≤ 5                                          | `<InlineSelect options={opts} value={rt.context.get.value<string                                                                                                                      | null>(qId) ?? null} onChange={(v)=>rt.actions.set(qId,v)} onSubmit={onContinue} />`                              |
| `singleChoice`       | options > 5                                          | `<UnifiedDropdownSelect mode="typeform" options={opts} value={rt.context.get.value<string                                                                                             | null>(qId) ?? null} onChange={(v)=>rt.actions.set(qId,v)} onSubmit={onContinue} />`                              |
| `multipleChoice`     | options ≤ 5                                          | `<InlineMultiSelect options={opts} value={(rt.context.get.value(qId) as string[]) ?? []} onChange={(arr)=>rt.actions.set(qId,arr)} onSubmit={onContinue} />`                          |
| `multipleChoice`     | options > 5                                          | `<UnifiedDropdownMultiSelect mode="typeform" options={opts} value={(rt.context.get.value(qId) as string[]) ?? []} onChange={(arr)=>rt.actions.set(qId,arr)} onSubmit={onContinue} />` |
| `rating`             | N/A                                                  | `<InlineRating max={q.type.config?.max ?? 5} value={rt.context.get.value<number                                                                                                       | null>(qId) ?? null} onChange={(n)=>rt.actions.set(qId,n)} onSubmit={onContinue} />`(Note: no`min`or`step` props) |
| `fileUpload`         | N/A                                                  | `<UnifiedFileUpload mode="typeform" questionId={qId} onFileUpload={async (id,file)=>{ const desc=await rt.actions.upload(id,file); rt.actions.set(id,desc); }} />`                    |
| `signature`          | N/A                                                  | `<InlineSignature value={rt.context.get.value<string                                                                                                                                  | null>(qId) ?? null} onChange={(s)=>rt.actions.set(qId,s)} onSubmit={onContinue} />`                              |
| `date`               | N/A                                                  | `<UnifiedDatePicker mode="typeform" value={rt.context.get.value<string                                                                                                                | null>(qId) ?? null} onChange={(v)=>rt.actions.set(qId,v)} />`                                                    |

### Required Semantics

- Single choice: non‑null string required.
- Multiple choice: non‑empty `string[]` required (empty array is invalid); do not advance until length > 0.
- Phone: rely on `UnifiedPhoneInput` validity; with `preventInvalidSubmit`, Enter should not advance when invalid.
