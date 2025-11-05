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
- The concept of "published vs draft" is internal to Formlink orchestration. Treat all examples here as draft.

## 0.2 File Layout & Routes

- Single file: generate all form code into one file under `components/` using a descriptive name based on the form's context, not the short id. Examples: `components/JobApplicationForm.tsx`, `components/CustomerFeedbackForm.tsx`.
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

- If the instructions specify a target location (e.g., "add a form on the current homepage" or "add a form on the About page"), do not replace the route or page. Import the generated component and render it inside the specified page where it fits (e.g., after the hero, within a section block).
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

The Classic renderer accepts a schema (Form.questions) and an optional `nodes` prop that controls layout. This enables "schema in → UI out" with precise placement for non‑persisted elements, and custom rendering when needed.

- Component
  - `import { ClassicTemplate } from '@formlink/runtime/ui/react'`
  - `<ClassicTemplate nodes={nodes} />`
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
  <ClassicTemplate
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
- Legacy question hints (`styling.as`, `styling.colSpan`) are still honored when `nodes` isn't provided but are considered deprecated in favor of the `nodes` prop.

### Classic Multi‑Step (client‑controlled)

Classic does not impose a step system. Instead, you can implement steps by controlling the `nodes` prop in your page component and using an element node to render Back/Continue/Submit actions. This keeps rendering instant and fully under your app's control.

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
  ClassicTemplate,
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
        <ClassicTemplate nodes={nodes} showDefaultSubmit={false} />
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

- To support Devtools "jump to question" in a multi‑step flow, listen for the custom event and switch steps accordingly:

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
    const qid = e.detail?.
```
