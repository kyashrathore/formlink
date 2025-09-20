# Technical Feasibility Assessment – Formlink Survey Platform PRD

## 1. Current System Snapshot

- **Architecture:** Monorepo with two Next.js applications – `apps/formcraft` (authoring console) and `apps/formfiller` (respondent runtime) – plus shared packages (`@formlink/schema`, `@formlink/db`, `@formlink/ui`). No Python/Flask services are present; all backend logic runs through Next.js API routes, Supabase functions, and external AI providers.
- **Data model:** Supabase Postgres stores forms/responses. `form_versions.questions` persists the entire survey definition as JSON matching `packages/schema/src/index.ts`, while `form_submissions`/`form_answers` capture respondent data (`packages/db/src/types/database.types.ts`).
- **Survey runtime:** Questions render sequentially in Typeform-style flows (`apps/formfiller/components/typeform/TypeFormView.tsx`). Conditional display is intended via per-question `conditionalLogic`, but `shouldShowQuestion` currently short-circuits to `true` (`apps/formfiller/lib/utils.ts`). AI-driven branching exists as an optional overlay that consults a `journeyScript` and an OpenRouter model (`apps/formfiller/app/api/ai/branching/...`).
- **AI assistants:** Form creation relies heavily on LLM prompts for question generation, validations, and conditional expressions (`apps/formcraft/app/lib/prompts.ts`, `apps/formcraft/app/api/ai/route.ts`). Response Intelligence (RI) features generate insight specs and summaries through AI plans cached in Supabase (`apps/formcraft/app/dashboard/forms/[formId]/components/responses/ResponseCharts.tsx`, `apps/formcraft/app/lib/ri/summaries.ts`).
- **Integrations & compliance:** Existing outbound integrations are limited to generic webhooks and Supabase storage. Security/compliance features are baseline Supabase (row-level security, auth); no multi-region hosting orchestration or SOC reporting exists.

## 2. Phase 1 – Advanced Survey Logic

| Capability                             | Current State                                                                                                    | Feasibility Outlook                                                                                             | Major Workstreams                                                                                                                                                                                |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Loops / Repeating Blocks               | Not supported in schema or runtime. Question order is a flat array.                                              | Requires schema redesign to model loop contexts and runtime renderer updates. High complexity.                  | Extend `QuestionSchema` with loop metadata, migrate stored drafts, rewrite navigation engine, add authoring UI.                                                                                  |
| Randomization (answers/blocks)         | No randomization controls; question lists are static.                                                            | Moderate feasibility; needs deterministic shuffling tied to submission id.                                      | Extend schema with randomization flags, adjust renderer to seed shuffles, ensure analytics preserve original order.                                                                              |
| Respondent Quality Scoring             | No automated checks today; responses stored as-is.                                                               | Moderate effort: trigger background AI pass after submission to flag speeding, straightlining, fraud.           | On submission completion enqueue AI evaluation with response snapshot; write quality score + flags into a sidecar table for downstream filters/RI insights.                                      |
| Rotations / Monadic / BIBD             | Not present. Requires sophisticated assignment engine.                                                           | High complexity: BIBD and monadic cells imply experiment scheduler and metadata tracking.                       | Model these studies as coordinated multi-form projects with shared correlation ids, extend authoring UI to manage linked forms, and generate assignments within existing workflow orchestration. |
| Skip Logic & Multi-condition Branching | Authoring UI captures single-condition `conditionalLogic`, but runtime ignores it by default (AI fallback only). | Implementing deterministic evaluation via JSONata interpreter is feasible. Multi-branch needs schema expansion. | Wire `jsonata` evaluation in runtime, cache parsed expressions, add AND/OR group support in schema + UI, unit test flow.                                                                         |
| Timers / required media viewing        | No timer enforcement in runtime components.                                                                      | Medium effort; requires per-question timer state and video player hooks.                                        | Extend question rendering to track media progress, block navigation until constraints met.                                                                                                       |

**Key Dependencies & Risks:**

- Schema migrations must preserve existing drafts stored as JSON blobs. Versioning strategy for upgraded question definitions is required.
- Looping/BIBD need transaction-safe respondent assignment; if implemented via correlated multi-form studies we can lean on existing Supabase transactions plus background jobs rather than introducing a separate service layer.
- Authoring UX currently optimized for linear flows; significant design work is necessary to keep the UI "Typeform simple" while exposing power features.

## 3. Phase 1 – Dynamic Text & Media

| Feature                    | Current Support                                                                                                                           | Feasibility Assessment                                                                                                                           | Notes |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ----- |
| Piping / Text Substitution | No direct piping. JSONata-derived fields (`settings.additionalFields.computedFromResponses`) exist but are only surfaced in result pages. | Feasible by evaluating JSONata at render time and injecting into question labels/descriptions. Requires sanitization and caching per respondent. |
| Conditional Media          | Media display fields are absent.                                                                                                          | Need new question props for assets + visibility rules; CDN/storage integration required.                                                         |
| Timed media controls       | Not implemented.                                                                                                                          | Requires custom video component with event tracking and gating logic (see timer point above).                                                    |

## 4. Phase 1 – Validation & Quality

- **Input validation:** Per-question validation schema supports required/min/max/pattern checks (`packages/schema/src/index.ts`), enforced in Typeform renderer (`apps/formfiller/components/typeform/utils/validation.ts`). Numeric ranges and regex exist; need to extend to word counts, numeric ranges on other types, and cross-question checks.
- **Fraud checks (speeding, straightlining, geo/IP, dedupe):** No instrumentation. Need submission middleware capturing timestamps, IP, user agent, geo lookup, plus analytics dashboards. Straightlining requires response pattern analysis service.
- **Respondent verification:** No cookie or panel ID tracking. Would need new tables for respondent metadata, cookie hashing, and API endpoints for external panel callbacks.

## 5. Phase 2 – Advanced Methodologies

| Method                         | Existing Building Blocks                                                          | Feasibility & Gaps                                                                                                                                                                                                                                                                                                   |
| ------------------------------ | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Conjoint Analysis              | None. Current schema cannot model attributes/levels or experimental designs.      | Enrich question metadata with `analysis.conjoint` (attributes, levels, task ids) and capture respondent bundles with correlation ids. Implement conditional logit utilities inside the responses API using JS regression libs, returning part-worths, sample-size guidance, and optimal bundles through RI insights. |
| MaxDiff                        | Similar gaps; need enumerated attributes, rotation design, scoring analytics.     | Store task definitions on questions, ingest best/worst picks, and add a responses API helper that computes importance scores via multinomial logit (include bootstrap confidence). Surface ranked results and narrative summaries via RI.                                                                            |
| TURF                           | Needs combinatorial optimization engine and baseline reach datasets; not present. | Reuse multi-select preference data; add a TURF insight helper that runs a capped greedy search to maximise reach, emitting winning combos and diminishing-returns curves. Leverage correlation ids for multi-form studies.                                                                                           |
| Segmentation & Driver Analysis | Only basic summaries today.                                                       | Keep data in Supabase, but add k-means/latent clustering and ridge/relative-importance regression modules under the responses API analytics layer; feed persona labels and driver importance into RI summaries without introducing a new service.                                                                    |

Phase 2 remains a heavier lift but stays within the existing Next.js/Supabase/TypeScript stack—augment schema metadata, extend the responses API with specialised analytics helpers, and rely on the Response Intelligence agent for orchestration and narration rather than spinning up Python services.

## 6. AI-First Enhancements

- **AI Programming Copilot / QA Assistant:** Current chat agents can draft questions, validations, and conditional expressions, and maintain a `journeyScript`. However, there is no automated verification pass—JSONata is not validated against actual question IDs, and runtime logic is manual. Implementing AI QA would require additional prompts plus deterministic validators.
- **AI Insights Layer & Templates:** Response Intelligence already generates charts and narrative summaries via plan specs, but relies on external LLM calls (`apps/formcraft/app/lib/ri/summaries.ts`). Scaling to Conjoint/MaxDiff/TURF templates depends on analytics backend (see Phase 2).
- **AI sidecar data enrichment:** No current pipeline to append derived columns pre-ingestion. Would need asynchronous jobs writing to `form_answers` or a new `response_enrichments` table.

**Risk:** All AI features depend on access to third-party models (OpenRouter/Gemini, Vercel AI). Network restrictions or missing API keys cause silent fallbacks to linear behavior. Production readiness requires monitoring, retries, and on-prem model fallbacks.

## 7. Integrations

- **Panel Providers (Dynata/Cint/Toluna/Lucid):** No existing connectors. Need OAuth/API credential management, invitation sync, status callbacks, and quota reconciliation endpoints. Likely new backend services and scheduled jobs.
- **Analytics Exports (SPSS/R/Python/Tableau/PowerBI):** Current export format is JSON via Supabase. Must add exporters to CSV, SPSS SAV, RDS, etc. Consider server-side data shaping plus cloud storage delivery.
- **Productivity (Sheets/Notion/Slack):** Webhook infrastructure could be extended, but pre-built connectors, auth flows, and retry logic are absent.

## 8. Compliance & Enterprise

- **GDPR & multi-region hosting:** Supabase project appears single-region. Multi-region hosting + data residency would require restructuring databases and CDN. Need data processing agreements and deletion workflows.
- **SOC-lite / security:** No evidence of audit logging beyond Supabase defaults. Add centralized logging, change management, pen-test documentation, role-based access controls.
- **White-labeling:** Branding support is partial (`brands` table) but no dedicated tenant theming beyond logos and CSS overrides. Client dashboards for agencies are not implemented.

## 9. Recommendation Summary

1. **Foundational refactor:** Before layering complex branching/experiments, implement deterministic conditional logic evaluation, strengthen schema versioning, and modularize runtime navigation. This is prerequisite for all advanced logic and QA automation.
2. **RI agent expansion plan:** Document how the existing Response Intelligence agent will host respondent-quality scoring and advanced analytics (conjoint/MaxDiff/TURF) using Supabase + Next.js jobs, so teams align on scaling limits without adding a Python service.
3. **Roadmap sequencing (aligned with current strategy):**
   - Milestone A: Deterministic skip logic, randomization, validation expansion, piping (leveraging existing JSONata). Adds immediate value with moderate scope.
   - Milestone B: Ship respondent-quality scoring by firing an AI review job after each submission and storing flags in the responses sidecar so views and RI plans can filter low-quality completes.
   - Milestone C: Support advanced rotations/monadic/BIBD scenarios by orchestrating linked multi-form studies and correlation identifiers rather than deep loop constructs in a single form. Requires coordinated authoring UX and reporting joins across correlated form submissions.
   - Milestone D: Expand the current Response Intelligence agent for automated QA and advanced methodologies—no new Python service required if we extend the existing Next.js/Supabase-based agent workflows.
4. **Risk management:** Invest in monitoring and graceful degradation for AI dependencies; provide manual overrides when external models fail.
5. **Talent/effort implications:** Phase 1 incremental features could be tackled within the existing TypeScript stack. Phase 2 analytics and panel integrations still demand specialists (statistical programming, data engineering), but work can remain within the established RI agent and Supabase infrastructure.
