# Response Processing, Views, and Actions — First Principles and Practical Blueprints

Purpose: Define precise, shippable blueprints for high‑value use cases using one core model: data ingestion → enrichment → tabbed views → insights → actions (via MCP). Each section specifies the exact views, actions, enabling tech, and whether a public page/API/embed is needed.

Scope: Single‑form first (Level 1). All designs map to a table with saved views, light insights, and configurable actions. Multi‑form is an extension (Level 2) of the same patterns.

Contents

- Key decisions (from recent discussion)
- Core primitives (applies to every use case)
- Use‑case blueprints (views, actions, enablement)
- Public/Embed patterns
- Security, auditing, operability

## Key Decisions (Updated)

- AI‑generated views and insights (no static defaults): The system proposes views/insights/actions based on the form schema and question types, optionally using a small sample of recent submissions. Users review, tweak, and save. Deterministic heuristics exist as fallback.
- Single transport (ACI): All actions (email, Slack, Webhook, Google Sheets, HubSpot, Notion, GitHub, Stripe, etc.) execute via our self‑hosted ACI (MCP) instance.
- Automations: Support on_submission and schedule (cron) triggers. Scope by saved view or inline filters. Same action definitions, idempotent, audit‑logged. Our scheduler triggers runs; ACI executes tools.
- Compliance: With ACI self‑hosted inside our infra/VPC, data egress is minimized. Admins can restrict which ACI apps/tools are permitted and which fields may be used in action parameter mappings.
- Email sending: Route through ACI email apps (e.g., Gmail/SendGrid/Resend) using the user’s linked account; no separate in‑house mailer required.
- Sidecar annotations model: Per‑submission annotations (status/tags/notes/sentiment/votes/mailed_count/sale_made, etc.) live in dedicated tables and are joined in responses. We do not create per‑view physical tables nor mutate core answers.
- Dynamic columns: A view’s columns can include system fields, answer fields, annotation fields, AI fields, and computed fields. New needs map to new annotation keys/typed columns without runtime DDL.
- No per‑view materialization: Saved views persist configuration only (filters/columns/sort); the RPC applies them over submissions + joins to sidecar tables.

## Core Primitives

- Data ingestion
  - Form submissions create `form_submissions` (in_progress → completed) and `form_answers` rows.
  - Query parameters saved (e.g., `utm_source`, `ref`) via `settings.additionalFields.queryParamater`.
  - Partial saves on each answer (resume-safe), plus localStorage cache for refresh.

- Enrichment (optional, per form)
  - Computed fields: deterministic transforms (e.g., scoring, UTM normalization). Persist as annotations when they must be filterable/sortable.
  - AI fields: sentiment, themes, classification tags; stored in a side table (e.g., `submission_ai_insights`) and/or promoted into annotations for hot filters.
  - Votes/reactions: `submission_votes` with an aggregate view for totals.

- Views (saved configurations)
  - Schema: `{ id, name, filters, columns, sort, isDefault }` persisted in `response_views`.
  - Filters: by system fields (created_at, status, testmode), answer fields (question ids), annotation/AI fields (e.g., `annotations.status = 'shortlisted'`, `annotations.sentiment = 'positive'`).
  - Columns: union of system, answer, annotation, AI, and computed columns; labels resolve from the form schema for answer fields.

- Insights (per view)
  - Lightweight aggregates over current view: total count, last 7d trend, simple breakdowns.
  - Backed by SQL, cached per view (no heavy analytics needed initially).

- Actions (row/bulk) — via ACI (MCP)
  - Registry: `{ id, name, aciApp, aciFunction, paramMappings, batchMode, allowedFields? }`.
  - Execution: selected rows → resolve parameters (field/constant/template) → call ACI function with `linked_account_owner_id` → audit.
  - Catalog: 600+ ACI apps cover email, Slack, Notion, HubSpot, GitHub, Stripe, Sheets, generic webhooks, and more.

- Auditing
  - `actions_log`: `{ id, actionId, formId, userId, selection, payload, status, startedAt, finishedAt, error? }`.
  - Row annotations: optional `last_action_at`, `last_action_name` in an index table for quick UI badges.

### AI‑Generated Views & Insights (Updated)

- Inputs: `formSchema`, optional `sampleResponses` (n recent), `additionalFields` (e.g., UTM), optional `journeyScript`.
- Goals: `propose_views`, `propose_insights`, `propose_actions`.
- Response JSON contract:
  - `views[]`: `{ id, name, filters[], columns[], sort }`
  - `insights[]`: `{ viewId, cards[] }` where card = `{ type: "count"|"trend"|"breakdown", field, window }`
  - `actions[]`: `{ name, description, intent, inputs[], suggestedTargets[] }`
- Heuristic fallback (non‑AI): Identify rating/NPS, stage/status, UTM fields, budget/timeline keywords; propose 1–3 sensible views and insights accordingly.

### Action Transport: ACI Self‑Hosted (Updated)

- We deploy/manage ACI; it handles provider auth/secrets and exposes MCP tools callable from our backend/UI.
- All actions (email, Slack, Webhook, Sheets, CRM, DevOps, Payments) execute via ACI functions.
- Registry stores `aciApp`, `aciFunction`, and `paramMappings` for deterministic execution.

### Automations (Auto‑Triggered Actions)

- Triggers: `on_submission` and `schedule` (cron + timezone).
- Scope: saved `viewId` or inline `filters[]`.
- Runner: Our backend evaluates scope and enqueues work; executor resolves params and calls ACI.
- Idempotency: per submission per automation; for schedules, per run id (stored in automations_log).
- Scheduled digests: Backend generates CSV (or exposes a signed export URL) and uses ACI email/Slack functions to deliver.
- Triggers: `on_submission` and `schedule` (cron + timezone).
- Scope: saved `viewId` or inline `filters[]`.
- Transport: same as action (`internal`, `aci`, or optionally `pipedream`). Internal/ACI preferred for low latency/compliance.
- Idempotency: per submission per automation; for schedules, per run id.
- Scheduled digests: Internal (server generates CSV and emails/Slacks) or ACI scheduler (or Pipedream) fetches signed CSV/JSON export and executes tools.
- UI: Convert any manual action to an automation (pick trigger, scope, transport). Include “Send test” and “Run now”.

## Use‑Case Blueprints

Below, each use case lists: required inputs (fields), default tabs/views, insights, actions, enabling tech, and whether a public page/API/embed is used.

### Column Model (Dynamic)

- Fixed vs dynamic: Fixed system fields exist, but most business‑specific needs (shortlisted, mailed_count, sale_made, approved, owner, etc.) are dynamic via annotations/AI. No migrations are required to “add a column”; add an annotation key or a typed column on the annotations table and expose it in views.
- Sort/filter readiness: Promote frequently filtered annotation keys to typed columns with indexes (e.g., status, shortlisted, sentiment, mailed_count, sale_made). Long‑tail keys live in an `extra` jsonb and remain queryable when needed.

### 1) Waitlist OS (Startups/Launches)

- Required fields: `email`, `name` (opt), `company` (opt), `role` (opt), `why_join` (opt), `utm_*` (optional via query extraction).
- Views (tabs):
  - All (default): sort by `created_at desc`.
  - Verified emails: filter `email_verified = true`.
  - High‑intent: filter `company != null or role != null`.
  - Top sources: saved grouping by `utm_source` (presented as a table view + small breakdown insight).
- Insights: total signups, 7‑day trend, top 3 sources.
- Actions:
  - Send welcome/confirmation email (SMTP) — bulk; increment annotations.mailed_count; set last_mailed_at.
  - Invite to cohort (Mailchimp/ConvertKit via MCP) — bulk; add tag in annotations (e.g., cohort_X).
  - Export to CRM (HubSpot create_contact) — bulk; set annotations.status = 'synced_crm'.
- Tech enablement: query param extraction (done), SMTP action, HubSpot MCP tool. Optional: annotation field for email verification.
- Public/Embed: Not required; optional public counter widget later.

### 2) Feedback/NPS Hub (SaaS)

- Required: `rating` (or NPS 0–10), `comment`, `email` (opt), `account` (opt), `category` (opt).
- Views:
  - All feedback (default).
  - NPS Detractors (0–6), Passives (7–8), Promoters (9–10).
  - Bugs (category = bug), Feature requests (category = feature).
- Insights: NPS score, volume trend, category breakdown.
- Actions:
  - Create issue (GitHub/Linear) for bug rows — bulk or row; store annotations.tracked_issue_url.
  - Follow‑up email to detractors (SMTP) — bulk; set annotations.followup_sent = true; increment mailed_count.
  - Push to Notion “Feedback backlog” — bulk; set annotations.status = 'backlog'.
- Tech: simple filters, MCP tools for GitHub/Linear/Notion/SMTP. Optional AI tagging later.
- Public/Embed: Not required; possible public “What’s New / Feedback” later.

### 3) Reviews & Testimonials Manager

- Required: `rating`, `review_text`, `name`, `company` (opt), consent flag.
- Views:
  - All.
  - Needs approval (consent=false or status=pending).
  - Approved (public).
  - Website widget (tagged `widget=true`).
- Insights: avg rating, source breakdown.
- Actions:
  - Approve & publish to widget (set annotations.approved = true; tag annotations.widget = true).
  - Request consent email (SMTP) — row/bulk; set annotations.consent_requested_at.
  - Cross‑post to Slack/Twitter (Slack MCP, webhook for socials); optionally store annotations.published_url.
- Tech: publish endpoint (public JSON) for widget consumption; action toggles status; SMTP/Slack MCP.
- Public/Embed: Yes — public JSON endpoint + lightweight JS widget snippet.

### 4) ATS Lite (Job Applications)

- Required: `name`, `email`, `phone` (opt), `role_applied`, `resume_link`, `notes`, `stage`.
- Views:
  - Pipeline tabs: Applied → Screening → Interview → Offer → Hired (filter by `stage`).
  - Shortlisted (tag=true) view.
- Insights: stage counts; conversion rate (later).
- Actions:
  - Move to stage — bulk; set annotations.stage and optional annotations.shortlisted.
  - Send screening email — bulk/row; increment mailed_count.
  - Create candidate in HubSpot/Notion — bulk; set annotations.synced = true.
- Tech: field updates, SMTP, CRM MCP tools.
- Public/Embed: No.

### 5) Lead Capture → Micro‑CRM

- Required: `name`, `email`, `company` (opt), `industry` (opt), `budget` (opt), `notes`.
- Views:
  - All.
  - Qualified (budget/industry matches rules).
  - High‑value (budget >= threshold).
  - Needs follow‑up (no email sent yet).
- Insights: qualified rate; source breakdown.
- Actions: create contact/deal (HubSpot/Pipedrive), send intro email, assign owner (Slack notify); set annotations.status = 'qualified'|'won'|'lost', annotations.owner, optional sale_made/sale_amount.
- Tech: computed “qualified” flag; MCP: HubSpot/Pipedrive/SMTP/Slack.
- Public/Embed: No.

### 6) Quote Requests (B2B Services)

- Required: `contact`, `company`, `scope_description`, `budget_range`, `timeline`, `status`.
- Views:
  - New (status=new), Needs scoping, Ready to quote, Sent, Won/Lost.
- Insights: avg quote value (computed), win rate.
- Actions: generate quote PDF (doc MCP), email quote (SMTP), create deal (CRM MCP); update annotations.status (New/Scoping/Sent/Won/Lost) and annotations.quote_amount.
- Tech: document generation MCP (e.g., a PDF server), SMTP, CRM.
- Public/Embed: No.

### 7) Bug Report Hub

- Required: `title`, `description`, `severity`, `steps_to_repro`, `contact` (opt), `status`.
- Views: New, High severity, Repro available, Waiting on user, Resolved.
- Insights: issues by severity; time‑to‑first‑response (manual to start).
- Actions: create GitHub/Linear issue, request more info (email), assign owner (Slack tag); set annotations.status, annotations.owner, annotations.issue_url.
- Tech: GitHub/Linear MCP, SMTP, Slack.
- Public/Embed: No.

### 8) Feature Requests Manager

- Required: `title`, `description`, `impact`, `category`, `status`.
- Views: All; P1 candidates (impact high), Needs spec, In backlog, Released.
- Insights: top requested themes (manual tags first); request velocity.
- Actions: create Linear/Jira ticket; add to Notion roadmap; notify subscribers (email batch); write annotations.priority, annotations.tags, annotations.roadmap_link.
- Tech: MCP: Linear/Jira/Notion/SMTP; manual tagging fields.
- Public/Embed: Optional public roadmap JSON for website widget.

### 9) Client Onboarding Checklist (Agencies)

- Required: `client_name`, `contact`, `assets_provided` (multi), `missing_assets`, `status`.
- Views: Ready to kickoff, Missing assets, In progress, Blocked.
- Insights: time‑to‑kickoff; bottlenecks (count missing_assets).
- Actions: request missing assets (email), create project in Asana/ClickUp, assign PM (Slack); set annotations.status, annotations.assignee, annotations.missing_assets_count.
- Tech: MCP: SMTP, Asana/ClickUp, Slack.
- Public/Embed: No.

### 10) Event Registrations / RSVPs

- Required: `name`, `email`, `ticket_type`, `status` (registered/confirmed/waitlisted/checked_in).
- Views: Confirmed, Waitlisted, Checked‑in.
- Insights: capacity utilization; daily signups.
- Actions: send ticket/QR (doc MCP + email), move waitlist → confirmed, export to CSV; set annotations.checked_in and annotations.ticket_id.
- Tech: PDF/QR MCP, SMTP.
- Public/Embed: Optional public attendee count widget.

### 11) UGC / Content Submissions

- Required: `content_type`, `url_or_upload`, `consent`, `status`.
- Views: All, For review, Approved, With consent.
- Insights: source mix; approval rate.
- Actions: request rights (email), publish to CMS (Notion/Webflow CMS via MCP), schedule post (Slack/Twitter webhook); update annotations.rights_granted, annotations.published_url, annotations.publish_at.
- Tech: Webflow/Notion MCP, SMTP, Slack/webhook.
- Public/Embed: Public JSON for website components (gallery feed).

### 12) Warranty / RMA Intake (E‑commerce)

- Required: `order_id`, `product`, `reason`, `photos` (opt), `eligibility`, `status`.
- Views: New, Eligible, Needs info, Approved, Denied.
- Insights: reasons breakdown; approval rate.
- Actions: generate RMA + label (Shippo MCP), email instructions, refund/replace link (Stripe payment/refund link).
- Tech: Shippo MCP, SMTP, Stripe MCP.
- Public/Embed: No.

## Public/Embed Patterns

- Public JSON endpoints per view (read‑only): for testimonials/UGC widgets. Public responses include only allowed columns; annotation/AI fields follow explicit allow‑lists.
- Public page (view-only): optional share for stakeholders (later access control).
- Embed snippet: small JS to render testimonials/attendee counts on websites.

## Enabling Technology — Checklist

- Views store and API: CRUD for saved views; server applies filters/columns/sort; dynamic columns include annotation/AI fields.
- Insights service: simple SQL aggregate endpoints bound to a view.
- Actions service:
  - Single transport: ACI self‑hosted MCP.
  - ACI: deploy in our infra; manage provider OAuth/secrets; expose MCP tools; discover tools per workspace/connection.
  - Execution engine (batch per selection; retry; audit log); idempotency keys. Batch effects write to annotations/votes (e.g., status changes, mailed counters, vote totals).
  - Param resolution mapping (field→param), with templates for email/docs.
- Public endpoints: per‑view JSON with cache headers; optional ISR; per‑field allow‑lists for annotation/AI columns (default deny).
- Security:
  - Workspace ACI app/tool allowlist; per‑action field‑level egress allowlist.
  - Access control to views/actions; secrets storage; tokenized public endpoints; RLS on annotation tables keyed by form ownership.
- Operability: audit log UI, action status toasts, idempotency keys.

## Minimum Viable Implementation Plan

1. Views + Actions skeleton (AI‑first)
   - Save views; render tabs; default views for Waitlist, Testimonials, ATS, Leads.
   - AI proposal endpoint `POST /api/ai/generate-views` (gemini‑2.5‑flash) returning `views/insights/actions`; inline edit and save.
   - Actions: Execute via ACI (e.g., send_email, slack_send_message, hubspot_create_contact, notion_create_page).
   - Audit log writes.
2. Insights lite
   - Count; 7‑day trend; 1 breakdown (by a selected field).
3. Public JSON for Testimonials (widget)
   - Approve/publish flow + endpoint.
4. Add 2–3 more MCP actions
   - Notion create_page, GitHub issue, Stripe payment link.

This doc is the blueprint used to implement per‑use‑case tabs, insights, and MCP actions without bloating the surface area. Each use case here can replace a $20–$100/mo tool for indies/SMBs with minimal additional infra beyond what already exists.
