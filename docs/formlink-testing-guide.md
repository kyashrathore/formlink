# Formlink QA Testing Guide

This guide gives a first-time QA engineer the full surface area of Formlink, how features are wired, and what to validate while exploring the product end‑to‑end.

## Before You Start

- Apply the Supabase migrations in `packages/db/src/migrations` so API keys, responses, and helper tables exist.
- Configure the AI provider env vars (see `apps/formcraft/app/lib/ai/provider.ts`) because chat, form authoring, and branching rely on `/api/chat` and `/api/ai`.
- Google OAuth is the only sign-in path (`apps/formcraft/app/auth/page.tsx`); make sure tester accounts are whitelisted or available.
- Flip `NEXT_PUBLIC_ENABLE_TESTDATA=true` only when validating synthetic response buttons; default should remain false for production parity.
- Rate limits differ for guests vs authenticated users (`GET /api/rate-limits`); expect 403s after `verifyGuestUserLimits` trips for chat-heavy sessions.

## Product Surfaces at a Glance

- The builder uses a two-column layout: Chat/Design on the left (`ChatDesignPanel`) and Form tabs on the right (`TwoColumnLayout`).
- Right-panel navigation exposes Form, Preview, Responses, Share, and Settings (`NavigationBar.tsx`).
- Autosave, save, and publish status come from `useFormEditorStore` snapshots and the PATCH `/api/forms/:id` endpoint.
- Draft vs published versions live in Supabase `forms` and `form_versions`; publishing swaps `current_published_version_id` and clears draft.
- Chat history and builder actions stream through `/api/chat` and `/api/forms/:id/messages`, scoped per formId.

## AI Builder & Dashboard Chat

- `/dashboard` home chat (`dashboard/Home.tsx`) spins up a new UUID form, offers prompt suggestions, and pushes you into the form workspace.
- `ChatPanel.tsx` supports streaming responses, event logs, detachable panel mode, and hydrates history via `useChatHistoryQuery`.
- When the Responses tab is active the chat automatically switches `intent: "response_intelligence"`, so analytics prompts flow to the RI tool.
- Guest accounts honour `verifyGuestUserLimits`; confirm the API returns 403s once the daily cap is exceeded.
- Response-intelligence follow-up suggestions populate as prompt chips (`riSuggestions`) after a plan preview is delivered.

## Form Details & Journey

- Inline editing for title and description lives in `FormDetailsStep`—verify autosave kicks in and the content persists after refresh.
- `StructuredPromptEditor` in `FormJourneyStep` manages the `<form-journey>` XML; testers can load the default template and tweak sections.
- Updating the journey script writes to `form.settings.journeyScript` and powers Typeform branching plus result-page copy.
- Escaping/quoting is handled in the component; confirm edits with quotes render correctly in subsequent sessions.

## Question Management

- Supported question types (via `@formlink/schema`) include text/textarea/email/url/tel/number/password/country, single & multiple choice, rating, date/dateRange, ranking, file upload, address, linear scale, likert scale, and signature.
- Drag questions to reorder (DndKit in `QuestionsStep.tsx`); `questionNo` is recalculated in `useFormEditorStore`.
- `QuestionHeader` provides inline title/description editing plus duplicate and delete controls—check the duplicate retains options and validations.
- Use the Add Question prompt dialog to call `/api/ai` (`operationType: "add-question"`) and append AI-generated questions.
- Options for choice questions can be added/removed with labels, values, and optional numeric `score` values for downstream scoring.
- Rating-specific guidance is editable through `RatingSection`, which updates `readableRatingConfig`.

## Autosave, Versioning, and Publish

- Manual saves call PATCH `/api/forms/:id`; autosave runs every 8s (and on blur) when `selectIsDirty` is true.
- The save badge distinguishes manual vs auto saves; confirm the dirty indicator clears once `updateSnapshot` runs.
- Publishing hits `/api/forms/:id/publish`, marks the draft version as published, and nulls out `current_draft_version_id`.
- Share-only features stay disabled until the form has a `short_id`; `GET /api/forms/:id/short-id` returns the value.

## Design & Theme Controls

- The Design tab (`DesignPanel.tsx`) validates shadcn CSS before persisting to `settings.theme_overrides.shadcn_css`.
- Theme mode toggles between system/light/dark and stores `theme_mode`, influencing embeds and preview styling.
- CSS changes dispatch `FORMLINK_SHADCN_CSS_UPDATE`, so the Preview iframe restyles immediately without a full save.
- On load, `DesignPanel` fetches the current form to hydrate previously saved theme overrides.

## Previewing Forms

- Preview requires a saved form and short_id; otherwise it explains why the preview is unavailable.
- `FormModeControls` switch between chat, typeform, and classic renderers; the selection feeds into `FormPreviewWithDevices`.
- `DevicePreviewFrame` simulates desktop/tablet/mobile widths; confirm the rendered UI resizes and scrolls appropriately.
- While the AI agent is still generating (`loadingPhase !== "complete"`), chat preview is intentionally gated to avoid stale data.
- `FormPreview.tsx` keeps the filler iframe in sync via `FORMCRAFT_FORM_UPDATE` and `FORMCRAFT_MODE_UPDATE` postMessage events.

## Share & Distribution

- Share tab exposes the public link plus a test link that appends `formlinkai_testmode=true`; draft/test submissions show up flagged in Responses.
- Embed builder supports popup, slider, modal, full-page, and inline variants with the right loader script hints (`lib/embed/utils.ts`).
- `RealEmbedPreview` iframes the embed snippet and honours theme mode, so you can smoke-test embeds without leaving the app.
- Copy buttons provide immediate feedback (“Copied!”); confirm clipboard access works for both link and embed code.
- Publishing should be complete before distributing share links—verify the link renders in the dedicated formfiller app.

## Settings & Integrations

- Webhook configuration (`settings/Integrations.tsx`) persists `settings.integrations.webhookUrl` and shows an example payload.
- Additional Fields lets you declare query parameters to capture alongside responses (`settings.additionalFields.queryParamater`).
- Redirect on submission toggles `settings.redirectOnSubmissionUrl`; ensure Preview reflects the redirect after completion.
- `getDefaultSettings` backfills missing keys so patches only override explicitly changed fields.

## Responses & Analytics

- Summary cards (completed, in-progress, total) read from `/api/responses` metadata; verify counts change with filters.
- `GenerateTestDataButton` and `CleanupTestDataButton` appear when `NEXT_PUBLIC_ENABLE_TESTDATA=true` and call the respective `/api/responses` endpoints.
- Data table toolbar offers search placeholder, status/testmode/date facets, column visibility toggles, and sticky row selection (`data-table-toolbar.tsx`).
- Export actions hit `/api/forms/:id/responses/export` for all or selected rows; confirm CSV content includes core columns and question IDs.
- `ResponseCharts.tsx` renders insights from `plan.ui.insights_spec`; ensure trend/breakdown widgets match the filtered dataset.
- Response Views tabs persist in local storage (`useResponseViewsStore`); default view clears filters while AI-generated views can be saved or closed.

## Response Intelligence

- Ask natural-language prompts while on the Responses tab; the RI plan preview card summarises filters, columns, sort, insights, and proposed actions.
- `applyRIPlanToUI` applies the plan to the table (filters, columns, page size) and creates an ephemeral view via `addOrUpdateFromPlan`.
- Follow-up suggestions render as chips beneath the chat (`riSuggestions`); clicking one should re-run the plan with the suggested tweak.
- Text and summary insights fetch from `/api/ri/summary`; verify loading states and fallbacks display when no summary is available.

## Form Filler – AI Conversation Mode

- `FormAIComponent` now listens for AI SDK tool invocations (`saveAnswer`, `completeSubmission`) and slot tokens; verify `useSlotBridge` updates store.currentQuestionId/presentedQuestionMessageId as soon as a slot streams.
- `useFormSession` hydrates previous answers via `/api/forms/:id/chat-history`, enabling resume flows for in-progress submissions.
- Error states surface as alerts with retry options—test rate-limit and network failures to ensure friendly messaging.
- Test mode submissions (links with `formlinkai_testmode=true`) should create `testmode=true` rows for easy cleanup.

## Form Filler – Typeform Mode

- `TypeFormView` animates between intro and questions with keyboard and swipe shortcuts; confirm navigation works on desktop and mobile.
- AI branching calls `/api/ai/branching` using the journey script and `mightBranchOffNext` hints; ensure fallback order still works if the AI errs.
- Auto-advance checks validation (`validateTextValue`) before moving on; invalid responses should block progression.
- Completion screen leverages `useResultPage` for personalised copy and triggers `useRedirect` if redirect URLs are configured.

## Form Filler – Classic Mode & Scoring

- `ClassicFormView` renders multi-question pages and builds a dynamic Zod schema to enforce required fields per question type.
- `calcScore` aggregates option scores into totals and percentages; verify scoring appears when questions carry `score` metadata.
- File uploads call the `/api/upload-image` endpoint (5 MB cap, JPEG/PNG/GIF/WebP); expect descriptive errors for disallowed files.
- Restarting the form resets state via `onRestart` and should clear stored responses plus progress indicators.

## Cross-Mode Behaviours

- `FormPageClient` respects `settings.defaultMode` and URL overrides (`?mode=`), so mode selection persists between visits.
- Additional fields capture declared query params on submission; confirm values surface in the stored answers payload.
- `RedirectOnSubmissionUrl` applies after completion across all modes via `useRedirect` in the filler.
- Submissions land in Supabase `form_submissions`/`form_answers` with a `testmode` flag and per-question JSON payloads.

## QA Utilities & Supporting APIs

- `GET /api/rate-limits` reveals daily counts vs `AUTH_DAILY_MESSAGE_LIMIT` and `NON_AUTH_DAILY_MESSAGE_LIMIT`—use it during load tests.
- Synthetic data helpers (`/api/responses/generate` and `/api/responses/cleanup`) require auth plus the test-data flag; alerts confirm row counts deleted.
- CSV exports serialise arrays and objects safely (see `escapeCSVValue` in `/api/responses/export`); spot-check special characters.
- `/api/upload-image` enforces content type and size; expect HTTP 400 when constraints are violated.

## Known Gaps & Watchpoints

- Components for manual validations/conditional logic exist but aren’t mounted yet; rely on AI-generated rules and note missing UI.
- Composio-style action execution is planned but not wired—the RI plan may list actions, yet there’s no execute flow today.
- `APIKeyManager` is currently hidden behind a `hidden` class; `/api/api-keys` works once migrations run, but no front-door toggle is shipped.
- Branching enablement still hinges on AI output (`settings.branching.enabled` and `question.mightBranchOffNext`); manipulate data directly if testers need to force it.
