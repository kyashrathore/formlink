# Formlink Release Blockers — Manual Test Checklist (v1)

Use this as the single source of truth to certify features for release. Keep updates atomic and attributable.

Legend: `[ ]` Not tested · `[~]` In progress · `[x]` Passed · `[!]` Blocker · `[r]` Regressed

How to update:

- Change the checkbox, add `Owner`, `Date (UTC)`, `Env` (local/dev/stage/prod‑like), and a brief `Notes`.
- If a blocker is found, open an issue and paste the link next to the item.
- For detailed steps and endpoints, see `docs/formlink-testing-guide.md`.

Pre‑release gates (must pass before feature sign‑off):

- [ ] `pnpm typecheck` and `pnpm lint` pass cleanly (no warnings promoted to errors) — Owner: · Date: · Notes:
- [ ] DB migrations applied to test environment — Owner: · Date: · Notes:
- [ ] AI provider keys configured and rate limits validated — Owner: · Date: · Notes:
- [ ] Auth (Google OAuth) validated for test accounts — Owner: · Date: · Notes:
- [ ] Smoke E2E: create → design → preview → publish → submit → view response — Owner: · Date: · Notes:

## Form Creation

### Prompt‑based creation

- [ ] Generates a multi‑question form from a natural‑language prompt (≥5 fields, mixed types). Owner: · Date: · Env: · Notes:
- [ ] Titles/descriptions are editable and persist after refresh. Owner: · Date: · Env: · Notes:
- [ ] Publish works and short_id is assigned; preview renders. Owner: · Date: · Env: · Notes:

### PDF/Doc/Image/Link parsing

- [ ] Uploads supported files; rejects disallowed types with clear errors. Owner: · Date: · Env: · Notes:
- [ ] Extracted questions are relevant and correctly typed (text/choice/date/file). Owner: · Date: · Env: · Notes:
- [ ] Large file handling shows progress/errors without crashes. Owner: · Date: · Env: · Notes:

### AI chat refinement

- [ ] Chat edits can add/remove/rename fields; changes persist to draft. Owner: · Date: · Env: · Notes:
- [ ] Conversational context preserved across turns; no rate‑limit regressions. Owner: · Date: · Env: · Notes:

### Multi‑mode starter (Typeform/AI chat/classic)

- [ ] All three starters load and create a new form successfully. Owner: · Date: · Env: · Notes:
- [ ] Switching modes retains current form draft. Owner: · Date: · Env: · Notes:

### ShadCN/Tailwind themes

- [ ] Paste‑in theme tokens apply instantly to preview; persist on reload. Owner: · Date: · Env: · Notes:
- [ ] Invalid CSS is rejected with helpful validation errors. Owner: · Date: · Env: · Notes:

## Logic & Validation

### Branching & conditional logic

- [ ] AI creates branching in journey; navigation follows correct paths. Owner: · Date: · Env: · Notes:
- [ ] Back/forward and restart flows keep branch state consistent. Owner: · Date: · Env: · Notes:

### AI‑driven validation

- [ ] Generated rules (email/number/regex) block invalid input with clear messages. Owner: · Date: · Env: · Notes:
- [ ] Server‑side submit rejects invalid payloads; UI error surfaced. Owner: · Date: · Env: · Notes:

### Answer piping

- [ ] Earlier answers render accurately in later question text. Owner: · Date: · Env: · Notes:
- [ ] Edge: empty/cleared upstream answer de‑piped gracefully. Owner: · Date: · Env: · Notes:

### Query params support

- [ ] URL params prefill fields; protected fields ignore prefill. Owner: · Date: · Env: · Notes:
- [ ] Params do not overwrite user input mid‑session. Owner: · Date: · Env: · Notes:

## Form Filling Modes

### Conversational (Typeform‑like)

- [ ] One‑question‑at‑a‑time flow; keyboard navigation works. Owner: · Date: · Env: · Notes:
- [ ] Progress and required indicators are correct. Owner: · Date: · Env: · Notes:

### AI chat filler

- [ ] AI guides completion without hallucinating non‑existent fields. Owner: · Date: · Env: · Notes:
- [ ] Sensitive inputs (password/PII) are masked/redacted if applicable. Owner: · Date: · Env: · Notes:

### Classic multi‑field/page

- [ ] Multi‑step navigation, validation, and scroll retain focus/state. Owner: · Date: · Env: · Notes:
- [ ] Mobile viewport renders all controls without overflow. Owner: · Date: · Env: · Notes:

## Submission Intelligence

### Sidecar columns

- [ ] Additional columns generated on submit; visible in responses table. Owner: · Date: · Env: · Notes:
- [ ] Manual override/edit persists and is audit‑safe. Owner: · Date: · Env: · Notes:

### Spam detection

- [ ] Bots/obvious spam flagged; false positives minimal in normal use. Owner: · Date: · Env: · Notes:
- [ ] Bypass and re‑classify controls work where exposed. Owner: · Date: · Env: · Notes:

### Lead scoring

- [ ] Scores present per submission; ties rules to prompt criteria. Owner: · Date: · Env: · Notes:
- [ ] Edge: missing fields yield stable, low/no score without crash. Owner: · Date: · Env: · Notes:

### Data enrichment

- [ ] Company/social enrichment adds stable fields; rate limits respected. Owner: · Date: · Env: · Notes:
- [ ] External call failures surface as non‑blocking errors. Owner: · Date: · Env: · Notes:

## Response Management

### Multiple views

- [ ] Create/save custom views with filters and columns. Owner: · Date: · Env: · Notes:
- [ ] Switching views updates results without refetch bugs. Owner: · Date: · Env: · Notes:

### Semantic search/filtering

- [ ] Natural‑language queries filter expected rows. Owner: · Date: · Env: · Notes:
- [ ] No data leakage across forms/tenants. Owner: · Date: · Env: · Notes:

### AI insights

- [ ] Trends/summaries/sentiment generate for selected view. Owner: · Date: · Env: · Notes:
- [ ] Regenerate and copy/export behave predictably. Owner: · Date: · Env: · Notes:

### Suggested actions

- [ ] Action suggestions appear; disabled if integrations unavailable. Owner: · Date: · Env: · Notes:
- [ ] Clicking suggestions pre‑fills the workflow builder (if present). Owner: · Date: · Env: · Notes:

### Public/custom views

- [ ] Share link works; only intended fields exposed; revoke works. Owner: · Date: · Env: · Notes:
- [ ] Private data never appears in public view. Owner: · Date: · Env: · Notes:

### Generate embeddable UI code

- [ ] Embed snippet works on external site; respects theme/mode. Owner: · Date: · Env: · Notes:
- [ ] Cross‑origin errors handled; CSP guidance documented. Owner: · Date: · Env: · Notes:

## Workflow Automation

### AI‑triggered workflows

- [ ] AI conditions trigger correct actions on submit. Owner: · Date: · Env: · Notes:
- [ ] Idempotency: duplicate submits don’t double‑fire. Owner: · Date: · Env: · Notes:

### Composio integration

- [ ] Can authenticate and list available actions. Owner: · Date: · Env: · Notes:
- [ ] Execute sample actions (Slack/Notion/Sheets) in test env. Owner: · Date: · Env: · Notes:

### Conditional triggers

- [ ] Example: negative sentiment + “pricing” → creates Jira ticket. Owner: · Date: · Env: · Notes:
- [ ] Failure paths surface actionable errors; retries limited. Owner: · Date: · Env: · Notes:

## AI Depth

### End‑to‑end AI

- [ ] AI participates in creation, validation, enrichment, and analysis. Owner: · Date: · Env: · Notes:
- [ ] Rate‑limit handling returns friendly errors; no silent degrade. Owner: · Date: · Env: · Notes:

### Conversational filler AI

- [ ] Guidance is contextually correct; avoids hallucinations. Owner: · Date: · Env: · Notes:
- [ ] Can hand off to human mode without losing progress. Owner: · Date: · Env: · Notes:

### Submission enrichment AI

- [ ] Adds missing context fields; marks confidence/uncertainty. Owner: · Date: · Env: · Notes:
- [ ] Errors logged and visible in submission detail. Owner: · Date: · Env: · Notes:

### Workflow AI

- [ ] Chooses correct actions given rules and data. Owner: · Date: · Env: · Notes:
- [ ] Does not trigger on ambiguous inputs; requires confirmation. Owner: · Date: · Env: · Notes:

## Platform & Distribution

### Public views (platform level)

- [ ] Any filtered dataset can be shared read‑only; revocation works. Owner: · Date: · Env: · Notes:

### API‑first

- [ ] Example code snippets work (create form, submit, list responses). Owner: · Date: · Env: · Notes:
- [ ] Auth and rate limits documented; 4xx/5xx errors are clear. Owner: · Date: · Env: · Notes:

### Open‑source

- [ ] Repo builds locally with `pnpm i && pnpm typecheck && pnpm lint`. Owner: · Date: · Env: · Notes:
- [ ] Contribution docs reflect current code; CI green. Owner: · Date: · Env: · Notes:

### Multi‑product replacement

- [ ] Waitlist, feedback, ATS‑light, survey analyzer can be configured from templates. Owner: · Date: · Env: · Notes:
- [ ] Each template ships with a working example flow. Owner: · Date: · Env: · Notes:

---

Operational checkouts

- [ ] Error logging and trace IDs present for AI/submit/workflows. Owner: · Date: · Env: · Notes:
- [ ] CSV export/import sanity checks pass. Owner: · Date: · Env: · Notes:
- [ ] Mobile and low‑bandwidth UX remain usable. Owner: · Date: · Env: · Notes:
- [ ] Accessibility: keyboard, labels, landmarks, contrast. Owner: · Date: · Env: · Notes:

TODO: Assign owners per feature, define stage vs prod‑like environments, and link each item to either a test case or issue.
