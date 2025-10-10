# Formlink Feature Inventory (v1)

Single source of truth for current and upcoming features. Ordered per Orchestrator-first view. Use this list to align scope, ownership, and release readiness.

Legend: Status = Current | Upcoming | Not implemented | Deprecated | Removed. Maturity = Alpha | Beta | GA. Fill Owner/Links as we progress.

Update rules

- Keep items concise; link deeper docs or issues instead of expanding here.
- When scope changes, update this file first; then link to specs/PRDs.
- Prefer edits; create a new file with `_v2` only for major reorgs.

## Form Orchestrator Agent

- Scope: Unified AI agent that handles form creation, iterative refinement, per-submission generation/automation, response views setup, and response analysis via chat.
- Current: AI chat authoring/refinement; builder chat integrated; can update fields/questions; response intelligence chat on Responses tab.
- Upcoming/Not implemented:
  - PDF/Doc/Image/Link parsing (including Typeform, Jotform, YouForm, Tally.so links) — Status: Not implemented.
  - Theme updates via chat (user may paste tokens in chat; UI is separate today) — Status: Upcoming.
  - Knowledge/RAG sub-agent to educate users on supported features and alert on unsupported requests — Status: Upcoming.
- Owner: TODO · Links: docs/formlink-testing-guide.md

## Agent Quality & Observability

- Prompt harnessing and guardrails — Status: Upcoming · Notes: standardize system prompts and tools.
- Error surfacing — Status: Upcoming · Notes: fail loud with actionable messages; no silent degrade.
- Retry strategy — Status: Upcoming · Notes: bounded retries with model-aware backoff.
- Observation & usage logging — Status: Upcoming · Notes: capture prompts, tokens, model, latency (PII-safe).
- Owner: TODO · Links: docs/formlink-testing-guide.md

Known bugs

- Model selection does not persist from Home page to Form page — Status: Bug · Owner: TODO · Link: TODO(issue)

## Logic & Validation

- Branching & conditional logic — Status: Current · Maturity: Alpha · Owner: TODO · Links: docs/formlink-testing-guide.md
  - Known issue: Journey refinement not updating `mightBranchOffNext` on questions; creation path works.
- AI-driven validation — Status: Current · Maturity: Alpha · Owner: TODO · Links: docs/formlink-testing-guide.md
- Answer piping — Status: Not implemented (Typeform & Classic) · Owner: TODO · Links: docs/formlink-testing-guide.md
- Query params support (prefill) — Status: Not implemented · Owner: TODO · Links: docs/formlink-testing-guide.md

## Form Filling Modes

- Conversational (Typeform-like) — Status: Current · Maturity: Beta · Owner: TODO · Links: docs/formlink-testing-guide.md
  - Known issue: With weaker models, answers may not save and questions can loop.
- AI chat filler — Status: Upcoming · Maturity: Alpha · Owner: TODO · Links: docs/formlink-testing-guide.md
- Classic multi-field/page — Status: Current · Maturity: Beta · Owner: TODO · Links: docs/formlink-testing-guide.md
  - Gaps: Need split-view classic mode; labels from AI creation sometimes missing for classic renderer.
  - TODO: Polish docs/classic-field-migration-review.md.
- Result page — Status: Buggy · Notes: not working properly in all modes.

## Design & Theming

- ShadCN/Tailwind themes — Status: Current · Maturity: Beta · Owner: TODO · Links: docs/formlink-testing-guide.md
- Additional design customizations (e.g., split-view classic) — Status: Upcoming · Owner: TODO.

## Submission Intelligence

- Sidecar columns — Status: Not tested · Owner: TODO · Links: docs/submission_intelligence_job_v1.md
- Spam detection — Status: Not tested · Notes: document that detection happens post-response only (no timing/fingerprinting yet). · Links: docs/advanced-analytics-design_v3.md
- Lead scoring — Status: Not tested · Links: docs/advanced-analytics-design_v3.md
- Lead enrichment — Status: Not integrated (self-hosted fire-enrich pending) · Links: docs/fire-enrich-lead-enrichment.md

## Response Management

- Views (multiple/custom) — Status: Current · Maturity: Alpha · Owner: TODO · Links: docs/formlink-testing-guide.md
  - Public views — Status: Not implemented.
- Semantic search/filtering — Status: Current · Maturity: Alpha · Links: docs/advanced-analytics-design_v3.md
- Sort — Status: Not working.
- AI insights — Status: Current · Maturity: Alpha · Links: docs/advanced-analytics-design_v3.md
- Suggested actions — Status: Needs testing · Links: docs/submission_intelligence_job_v1.md
- Generate embeddable UI code — Status: Not working.

## Workflow Automation

- AI-triggered workflows — Status: Upcoming · Owner: TODO · Links: docs/submission_intelligence_job_v1.md
- Composio integration — Status: Upcoming · Links: docs/composio-must-have-support.md
- Conditional triggers — Status: Upcoming · Links: docs/submission_intelligence_job_v1.md

## AI Depth

- End-to-end AI — Status: Current · Maturity: Alpha · Owner: TODO · Links: docs/formlink-testing-guide.md
- Conversational filler AI — Status: Upcoming · Owner: TODO
- Submission enrichment AI — Status: Upcoming · Links: docs/fire-enrich-lead-enrichment.md
- Workflow AI — Status: Upcoming · Links: docs/submission_intelligence_job_v1.md

## Platform & Distribution

- Public views (platform level) — Status: Current (share planned) · Note: No public toggle yet. · Links: docs/formlink-testing-guide.md
- API-first — Status: Upcoming · Links: README.md
- Open-source — Status: Current · Maturity: GA · Links: LICENSE
- Multi-product replacement — Status: Upcoming · Links: docs/formlink-survey-feasibility.md

---

Cross-cutting concerns

- Theming: ShadCN/Tailwind design tokens across Builder, Preview, Embed.
- Auth: Google OAuth as primary sign-in; guest rate limits.
- Rate limiting: Guest vs authenticated caps; chat-heavy sessions.
- Versioning: Draft vs published via form_versions and short_id for sharing.
- Exports: CSV export of responses and selected rows; escaping rules.
- Uploads: Content-type/size validation for image uploads.

## Builder & Question Management

- Question options editing — Status: Not fully tested · Notes: verify options in AI-generated questions are editable and persist.

TODO

- Assign owners per feature; update maturity and status based on current implementation.
- Link each item to its primary doc/spec and top-level route or component.
- Add a simple matrix (Feature → Owner → Status → Next action) if helpful for planning.
