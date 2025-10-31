# @formlink/runtime — Headless Runtime (alpha)

Updated: 2025‑10‑31

Single‑install, headless runtime for building delightful forms with deterministic validation, branching, navigation, persistence and uploads. React UI helpers and Devtools included. The canonical schema is embedded and exported via ./schema — install one package only.

Audience: App developers, LLM codegen, and UI engineers who need an authoritative, single source of truth. This doc is the authoritative reference for v1 alpha.

Table of contents

- Why
- Install
- Exports & Subpaths
- Prerequisites (shadcn/ui provider)
- Host Setup Checklist
- Quickstarts (Typeform, Classic)
- Provider & UI Helpers
- Devtools
- Core API Reference (signatures)
- Transports (fetch, formfiller, mock)
- Schema (./schema) — types & shapes
- Error Visibility Policy
- Branching & Progress
- File Uploads
- Styles
- SSR/Edge
- FAQ

Why

- Single source of truth for validation, visibility/branching, progress, persistence.
- Deterministic execution (code) over AI at runtime; AI is for generation.
- Single install: `@formlink/runtime` exports `./schema` to prevent drift.

Install

- pnpm add @formlink/runtime react react-dom
- Optional UI helpers: a shadcn/ui component set is required; you can:
  - Map your own primitives via ShadCnProvider (recommended), or
  - Use our registry to pull UI sources (WIP), or
  - Use the future package @formlink/ui when it’s published (WIP — not on npm yet)
    Notes: ESM‑only; edge‑safe; peer deps react/react‑dom.

Exports & Subpaths

- Core: `@formlink/runtime`
- UI (React): `@formlink/runtime/ui/react`
- Devtools: `@formlink/runtime/devtools`
- Schema: `@formlink/runtime/schema`
- Runtime CSS (precompiled): `@formlink/runtime/ui/react/style.css`
- Tailwind preset: `@formlink/runtime/tailwind-preset`
- Tailwind source sheet (optional): `@formlink/runtime/styles/runtime-tailwind.css`
  WIP packages
- `@formlink/ui` — not yet published; until then, supply your own primitives or pull sources from our registry (see docs/registry/registry.json).
- `@formlink/chat` — not yet published; conversational adapters will ship separately.

Prerequisites (shadcn/ui provider)

- Supply shadcn/ui‑style primitives via `ShadCnProvider` (or equivalent components). These primitives should include their own styles (from your design system or, later, `@formlink/ui`).
- If you don’t have a design system, import our minimal fallback CSS `@formlink/runtime/ui/react/style.css` to style runtime helpers (layout/progress/navigation) and ensure your primitives are styled.

shadcn/ui mapping (two approaches)

- Map your own primitives via `ShadCnProvider` (see Provider & UI Helpers).
- Or pull our ejectable sources from the registry (WIP) and map them; later you’ll be able to install `@formlink/ui` and map its components directly.

Host Setup Checklist

- [ ] `ShadCnProvider` is mounted at app root with required primitives.
- [ ] Import `@formlink/runtime/ui/react/style.css` (minimal CSS) OR ensure your design‑system CSS is present (or future `@formlink/ui` globals).
- [ ] If using Typeform helpers, pages/components rendering them are client components ('use client').

Quickstart — Typeform style (reactive)

```tsx
"use client";
import React from "react";
import { createRuntime } from "@formlink/runtime";
import {
  TypeFormTextInput,
  TypeFormContinueFooter,
  RuntimeProvider,
  ShadCnProvider,
} from "@formlink/runtime/ui/react";
import type { Form } from "@formlink/runtime/schema";

const form: Form = {
  id: "waitlist",
  title: "Join",
  questions: [
    {
      id: "email",
      title: "Work email",
      type: { name: "text", format: "email" },
      validations: { required: { value: true } },
    },
  ],
};

export default function View() {
  const rt = React.useMemo(
    () => createRuntime({ form, uiMode: "typeform" }),
    [],
  );
  const snap = React.useSyncExternalStore(
    rt.context.subscribe,
    rt.context.getSnapshot,
    rt.context.getSnapshot,
  );
  const qId =
    snap.currentId ?? snap.firstUnansweredId ?? snap.eligibleIds[0] ?? null;
  const q = qId ? rt.context.get.q(qId) : undefined;
  async function onContinue() {
    if (!qId) return;
    const res = await rt.actions.validate(qId);
    if (res.isValid) await rt.actions.next();
  }
  return (
    <RuntimeProvider runtime={rt} showDevtools>
      <ShadCnProvider
        components={
          {
            /* your primitives */
          } as any
        }
      >
        {snap.status === "idle" ? (
          <button onClick={() => rt.actions.start()}>Start</button>
        ) : q ? (
          <div>
            <h1>{rt.context.form.title}</h1>
            <h2>{q.title}</h2>
            <TypeFormTextInput
              type={(q.type as any).format}
              value={String(rt.context.get.value(qId) ?? "")}
              onChange={(v) => rt.actions.set(qId, v)}
            />
            <div className="text-red-500 text-sm">
              {rt.context.get.visibleError(qId)}
            </div>
            <TypeFormContinueFooter
              onClick={onContinue}
              isLoadingNext={snap.isSubmitting}
            />
          </div>
        ) : null}
      </ShadCnProvider>
    </RuntimeProvider>
  );
}
```

Quickstart — Classic (reactive)

```tsx
"use client";
import React from "react";
import { createRuntime } from "@formlink/runtime";
import type { Form } from "@formlink/runtime/schema";

const form: Form = {
  id: "ex",
  title: "Example",
  questions: [
    { id: "name", title: "Name", type: { name: "text", format: "text" } },
  ],
};

export default function ClassicPage() {
  const rt = React.useMemo(
    () => createRuntime({ form, uiMode: "classic" }),
    [],
  );
  const snap = React.useSyncExternalStore(
    rt.context.subscribe,
    rt.context.getSnapshot,
    rt.context.getSnapshot,
  );
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        await rt.actions.submit();
      }}
    >
      {snap.eligibleIds.map((qid) => (
        <div key={qid}>
          <label>{rt.context.get.q(qid)?.title}</label>
          <input
            value={String(rt.context.get.value(qid) ?? "")}
            onChange={(e) => rt.actions.set(qid, e.target.value)}
            onBlur={() => rt.actions.blur(qid)}
          />
          <div className="text-sm text-red-500">
            {rt.context.get.visibleError(qid)}
          </div>
        </div>
      ))}
      <button type="submit">Submit</button>
    </form>
  );
}
```

## Provider & UI Helpers (React)

- ShadCnProvider maps your primitives; required keys at minimum: Button, Input, Textarea, Label, Badge, ScrollArea, Separator, PopoverRoot/Trigger/Content/Anchor, CommandRoot/List/Item/Group/Empty/Input/Separator. See packages/runtime/docs/formlink-runtime-spec_v1_normative_only.md.
- Exported helpers:
  - Typeform scaffolding: TypeFormLayout, TypeFormProgress, TypeFormQuestionHeader, TypeFormContinueFooter({ onClick, isLoadingNext? }), TypeFormNavigation({ onNext?, onPrevious?, canGoNext?, canGoPrevious?, isLoadingNext? }), TypeFormTransition.
  - Unified inputs: UnifiedDropdownSelect<T>({ mode:'typeform'|'chat', options, value, onChange, onSubmit? … }), UnifiedDropdownMultiSelect<T>({ options, value: T[], onChange, onSubmit? … }), UnifiedCountrySelect, UnifiedDatePicker, UnifiedPhoneInput, UnifiedFileUpload, InlineSelect, InlineMultiSelect, InlineRating, InlineRanking, InlineSignature.
  - RuntimeProvider (optional React context + Devtools). There is no public useRuntime export; subscribe via useSyncExternalStore as shown in quickstarts.
- Fallback CSS: import '@formlink/runtime/ui/react/style.css' if your Tailwind pipeline does not scan the runtime.

Examples

- docs/examples/universal-typeform.md
- docs/examples/universal-classic.md
- docs/examples/composed-react-wiring.md

Common Pitfalls

- docs/pitfalls/start-button-no-op.md
- docs/pitfalls/createRuntime-import.md
- docs/pitfalls/mockTransport-alias.md
- docs/pitfalls/useRuntime-export-missing.md
- docs/pitfalls/question-undefined-title.md

## Devtools

```tsx
import { Devtools } from '@formlink/runtime/devtools'
<Devtools runtime={rt} mode="overlay" />
// or docked
<Devtools runtime={rt} mode="dock-left" dockWidth={360} />
```

Props: `{ runtime: RuntimeApi; position?: 'bottom-left'|'bottom-right'|'bottom-center'; fixed?: boolean; triggerClassName?: string; label?: string; mode?: 'overlay'|'dock-left'; dockWidth?: number }`

## Core API Reference (signatures)

```ts
// createRuntime
declare function createRuntime(config: RuntimeConfig): RuntimeApi;

// Config
interface RuntimeConfig {
  form: Form;
  transport?: RuntimeTransport;
  formfiller?: FormfillerTransportConfig;
  initialValues?: Partial<RuntimeValues>;
  initialStatus?: RuntimeStatus;
  initialCurrentId?: string | null;
  uiMode?: "typeform" | "classic";
}

// Context
interface RuntimeContext {
  readonly form: Form;
  readonly status: RuntimeStatus;
  readonly currentId: string | null;
  readonly eligibleIds: string[];
  readonly progress: { index: number; total: number; percent: number };
  readonly values: RuntimeValues;
  readonly errors: Record<string, string[]>;
  readonly firstUnansweredId: string | null;
  readonly unansweredIds: string[];
  readonly isValid: boolean;
  readonly isSubmitting: boolean;
  subscribe(listener: (s: RuntimeContextSnapshot) => void): () => void;
  getSnapshot(): RuntimeContextSnapshot;
  get: {
    q(qId: string): Question | undefined;
    value<T = unknown>(qId: string): T | undefined;
    error(qId: string): string | undefined;
    visibleError(qId: string): string | undefined;
  };
}

// Actions
interface RuntimeActions {
  start(): void;
  set(qId: string, value: unknown): void;
  blur(qId: string): void;
  next(): Promise<void>;
  prev(): void;
  goTo(qId: string): void;
  validate(qId: string): Promise<RuntimeValidationResult>;
  validateAll(): Promise<RuntimeValidationResult>;
  submit(): Promise<void>;
  reset(): void;
  savePartial(): Promise<void>;
  upload(qId: string, file: File | Blob): Promise<RuntimeUploadDescriptor>;
}

// Events
type RuntimeEventMap = {
  "status:change": { status: RuntimeStatus };
  "cursor:change": { currentId: string | null };
  "answer:set": { questionId: string; value: unknown };
  "visibility:change": { eligibleIds: string[] };
  "progress:change": { progress: RuntimeProgress };
  "submit:requested": { values: RuntimeValues };
  "submit:transport:start": { values: RuntimeValues };
  "submit:success": { values: RuntimeValues; result: RuntimeSubmissionResult };
  "submit:error": { error: unknown };
  "submit:transport:end": { result: RuntimeSubmissionResult | unknown };
  "upload:success": { questionId: string; descriptor: RuntimeUploadDescriptor };
  "upload:error": { questionId: string; error: unknown };
};
```

## Transports

```ts
// Generic fetch transport
class RuntimeTransportError extends Error {
  constructor(message: string, status?: number);
}
interface FetchTransportOptions {
  baseUrl: string;
  submitPath?: string; // default: /forms/submit
  partialPath?: string; // default: /forms/save
  uploadPath?: string; // default: /files/upload
  headers?: Record<string, string>;
}
declare function fetchTransport(
  options: FetchTransportOptions,
): RuntimeTransport;

// Formfiller‑compatible
type FormfillerTransportOptions = {
  baseUrl?: string;
  formId: string;
  submissionId: string;
  formVersionId: string;
  isTestSubmission?: boolean;
  headers?: Record<string, string>;
};
declare function createFormfillerTransport(
  opts: FormfillerTransportOptions,
): RuntimeTransport;

// Mock (dev)
type MockTransportOptions = {
  delayMs?: number;
  saveDelayMs?: number;
  uploadDelayMs?: number;
  onSubmit?: (values: RuntimeValues) => Promise<unknown> | unknown;
  onSavePartial?: (values: RuntimeValues) => Promise<void> | void;
  onUpload?: (
    qId: string,
    file: File | Blob,
  ) => Promise<RuntimeUploadDescriptor> | RuntimeUploadDescriptor;
  generateObjectUrl?: boolean;
  revokeAfterMs?: number;
};
declare function createMockTransport(
  options?: MockTransportOptions,
): RuntimeTransport;
```

## Schema (single‑install)

- Import types and Zod schemas from `@formlink/runtime/schema`.
- Discriminated union by `type.name`; validations include required/minLength/maxLength/pattern/minSelections/maxSelections/maxFiles/minDate/maxDate/allowedTypes/maxSize.
- The runtime constructs a Zod object from your Form for on‑change and on‑submit validation.

## Error Visibility Policy

- typeform mode: reveal on Continue (next) if invalid; reveal all on submit; clear on valid change.
- classic mode: reveal on blur; clear on valid change.
- Use `visibleError(qId)` for rendering messages; do not compute visibility in the UI.

## Branching & Progress

- `eligibleIds` is the authoritative ordered list of visible questions; navigation respects it.
- `progress` derives from `eligibleIds` and `currentId`.

## File Uploads

- Normalized descriptor: `{ url, name, size, mimeType?, metadata? }`.
- Use `actions.upload(qId, file)` or provide `transport.upload`.
- `UnifiedFileUpload` integrates with the runtime (pass `questionId` and `onFileUpload`).

## Styles

You have two options:

1. **Drop-in CSS bundle**  
   Import the prebuilt file once in your host app (e.g. `_app.tsx`, `layout.tsx`, or entry CSS):

   ```ts
   import "@formlink/runtime/ui/react/style.css";
   ```

   This includes the runtime layout utilities, tokens, and Tailwind utility classes used by our helpers.

2. **Integrate with your own Tailwind pipeline**  
   Extend your Tailwind config with the packaged preset and keep your existing design language:

   ```js
   // tailwind.config.cjs
   const runtimePreset = require("@formlink/runtime/tailwind-preset");

   module.exports = {
     presets: [runtimePreset],
     content: [
       "./src/**/*.{ts,tsx}",
       // ...your content globs
     ],
     safelist: [
       ...(runtimePreset.safelist || []),
       // ...your extra safelist entries
     ],
   };
   ```

   Then include the source layer in your global stylesheet if you want to reuse our tokens:

   ```css
   /* app.css */
   @import "@formlink/runtime/styles/runtime-tailwind.css";
   ```

   The safelist is already bundled in the preset, but you can also `require("@formlink/runtime/tailwind-safelist")` and merge manually if you prefer.

During development, run `pnpm --filter @formlink/runtime dev:css` to watch and rebuild the CSS bundle when editing runtime components locally.

## SSR/Edge

- Runtime is ESM‑only and uses browser‑safe APIs. React helpers are client‑side (`'use client'`).

## FAQ

- Can I use it without React? Yes. The headless runtime is framework‑agnostic.
- Does it support chat? Chat adapters will live in `@formlink/chat` (WIP); this package focuses on non‑chat flows.
- Can I customize UI? Yes. Provide primitives via `ShadCnProvider`. A registry and `@formlink/ui` package (WIP) will make this turnkey.

## License

MIT © Formlink
