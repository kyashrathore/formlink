# Formlink Feature Status Audit (v1)

Scope: Code‑level audit to confirm what exists, what works, what’s missing, and what to fix/polish. Derived from repository scan; no runtime claims beyond code evidence.

Legend

- Status: Implemented | Partial | Missing | Broken | Needs polish | Not tested
- Effort (AI-estimate): XS (trivial), S (small), M (medium), L (large), XL (epic)

## Orchestrator & Builder Chat

- Entry points
  - request+history: apps/formcraft/app/api/chat/route.ts:1
  - Handler and tools: apps/formcraft/app/api/chat/handlers/form-creation.ts:1, apps/formcraft/app/lib/chat/tools/index.ts:1
  - Tools: createForm, updateForm, getFormContext, response-intelligence, lifecycle: apps/formcraft/app/lib/chat/tools
  - Dashboard → Form page (model + initial prompt handoff): apps/formcraft/app/dashboard/Home.tsx:86, apps/formcraft/app/dashboard/forms/[formId]/page.tsx:57
  - Chat UI: apps/formcraft/app/dashboard/forms/[formId]/components/chat/ChatPanel.tsx:1
- Status: Implemented (core creation/refinement, RI plan streaming)
- Notes
  - Model handoff from Home via works for initial session only; no persisted preference store.
  - Tool set includes response views and lifecycle proposals; no theme tool exposed.
- Gaps/bugs
  - Theme updates via chat: Missing (Design is separate tab). Effort: M
  - Knowledge/RAG helper (educate + alert on unsupported): Missing. Effort: M
  - Model preference persistence (Home → Builder and across sessions): Needs polish. Effort: S

## Theme & Design

- Entry points
  - Design panel + CSS parsing/saving: apps/formcraft/app/dashboard/forms/[formId]/components/form/DesignPanel.tsx:1, apps/formcraft/app/lib/theme/parseShadcn.ts:1
  - Preview live apply: apps/formfiller/app/preview/[formId]/PreviewPageClient.tsx:106
- Status: Implemented (UI-driven). No chat control.
- Gaps
  - Accepting theme tokens pasted via chat (tool) and writing to form : Missing. Effort: M
  - Split‑view classic renderer customization: Missing. Effort: M

## Logic & Validation

- Entry points
  - Branching (Typeform runtime): apps/formfiller/components/typeform/TypeFormView.tsx:120
  - Branching API: apps/formfiller/app/api/ai/branching/route.ts:1
  - Form agent update path: apps/formcraft/app/lib/chat/tools/update-form.ts:1
  - Validation engine: apps/formfiller/lib/validation/FormValidator.ts:1
- Status: Branching Implemented (runtime call); AI‑driven validations Implemented.
- Gaps/bugs
  - Journey refinement not toggling : Likely Missing in update agent. Effort: S/M
  - Answer piping (Typeform & Classic): Missing. Effort: M
  - Prefill via URL params: Missing (no mapping to initial answers). Effort: S/M

## Form Filling Modes

- Entry points
  - AI chat filler: apps/formfiller/app/[formId]/FormAIComponent.tsx:1, apps/formfiller/app/api/ai/chat-assist/route.ts:1, apps/formfiller/app/api/ai/chat-assist/\_lib/tools.ts:1
  - Typeform UI: apps/formfiller/components/typeform/TypeFormView.tsx:1
  - Classic UI: apps/formfiller/components/classic/ClassicFormView.tsx:1
  - Mode selection from URL: apps/formfiller/contexts/FormModeContext.tsx:33, apps/formfiller/app/[formId]/FormPageClient.tsx:197
- Status: Implemented (all 3 modes present)
- Gaps/bugs
  - Chat mode loops / unsaved answers with weaker models: Needs polish (tool choices + retries). Effort: M
  - Classic labels sometimes missing for AI‑created questions: Needs polish (creation normalization). Effort: S
  - Result page generation: Calls but no route exists. Broken. Effort: S

## Response Management

- Entry points
  - Responses API (filtering + insights): apps/formcraft/app/api/responses/route.ts:1
  - Views CRUD: apps/formcraft/app/api/forms/[formId]/views/route.ts:1, apps/formcraft/app/api/forms/[formId]/views/[viewId]/route.ts:1
  - Store + table wiring: apps/formcraft/app/dashboard/forms/[formId]/stores/useResponseViewsStore.ts:1
  - Suggested actions UI: apps/formcraft/app/dashboard/forms/[formId]/components/responses/ActionsManagerCard.tsx:1
- Status
  - Views: Implemented (CRUD + per‑view actions stored). Public toggle not exposed.
  - Insights + filters: Implemented.
  - Sorting: Client‑side table sorting wired; server does not accept sort param. Partial.
- Gaps/bugs
  - Public views: Missing UI/route to expose a public link with access policy. Effort: M
  - Sort: Implement server‑side sort (param → RPC) or stable client sort with paging. Needs polish. Effort: S/M
  - Suggested actions: Not fully validated; API exists to persist per‑view actions. Needs testing. Effort: S

## Submission Intelligence (Sidecar, Spam, Scoring, Enrichment)

- Entry points
  - Job orchestrator + tools: apps/formcraft/app/lib/intel/submission-job/orchestrator.ts:1, tool‑spam/tool‑score/tool‑enrich: apps/formcraft/app/lib/intel/submission-job
  - Trigger: AI chat assist completion: apps/formfiller/app/api/ai/chat-assist/\_lib/tools.ts:200
- Status: Implemented behind config/flags; writes to .
- Notes: Spam tool gated by env .
- Gaps
  - Sidecar correctness coverage: Not tested. Effort: S (test sweep)
  - Enrichment via Fire‑Enrich: Endpoint scaffolding exists; integration not wired. Missing. Effort: M
  - Docs: Clarify spam runs post‑submission only (no timing/fingerprinting). Needs polish. Effort: XS

## Platform & Distribution

- Embeds
  - Embed code generator: apps/formcraft/app/dashboard/forms/[formId]/lib/embed/utils.ts:1
  - Public link: apps/formcraft/app/dashboard/forms/[formId]/components/share/ShareTabContent.tsx:33
  - Scripts: apps/formcraft/public/embed/v1.js:1, apps/formcraft/public/embed/popup/v1.js:1
  - Status: Implemented (code generation) — verify shortId vs id handling across envs.
- Public Views
  - DB columns present; no public view route/UI. Missing. Effort: M

## Known Issues (validated in code)

- Model selection persistence (Home → Form): local only; not persisted as a user preference. Effort: S
- Result page API missing (). Effort: S
- Branch refinement not updating . Effort: S/M
- Answer piping not implemented (Typeform/Classic). Effort: M
- Prefill via URL params not implemented. Effort: S/M
- Sort not server‑applied in responses API. Effort: S/M
- Public response views not implemented. Effort: M
- Embed generator likely OK, but verify + use in prod. Effort: XS (validation)
- Theme via chat tool missing. Effort: M
- Knowledge/RAG helper missing. Effort: M

## Recommendations & Next Steps

1. Ship Result Page API

- Implement to render markdown using form.settings.resultPageGenerationPrompt and current responses.
- Status: Missing · Effort: S

2. Prefill via URL params

- Map → initial responses in and classic/typeform initializers.
- Status: Missing · Effort: S/M

3. Answer Piping

- Add template interpolation in question text (Typeform/Classic) with safe fallbacks, e.g., .
- Status: Missing · Effort: M

4. Branching flag updates

- Ensure update‑agent flips during journey edits.
- Status: Needs polish · Effort: S/M

5. Model preference persistence

- Persist last selected model per user (localStorage + DB fallback) and hydrate on Builder load.
- Status: Needs polish · Effort: S

6. Response sorting

- Accept sort param in and thread into RPC, or stabilize client‑side pagination sorting.
- Status: Partial · Effort: S/M

7. Public Views

- Add with access policy + UI toggle.
- Status: Missing · Effort: M

8. Embeds validation

- Verify base path and shortId usage in , document CSP.
- Status: Needs validation · Effort: XS

9. Theme via chat

- Introduce tool to store and emit preview update event.
- Status: Missing · Effort: M

10. Knowledge agent

- Add lightweight in‑chat helper tool reading a curated spec/FAQ to respond “unsupported” and guide flows.
- Status: Missing · Effort: M

11. Chat filler robustness

- Tune step limits, tool call boundaries, and partialSubmission save‑paths; add retry/backoff.
- Status: Needs polish · Effort: M

12. Classic labels normalization

- Normalize generated question schema to ensure for classic where required.
- Status: Needs polish · Effort: S

## Notes on Evidence

- File references are concrete code locations; behavior may depend on env flags, RLS, and migrations.
- Some features appear scaffolded in docs but not present at runtime (e.g., , prefill, answer piping).
