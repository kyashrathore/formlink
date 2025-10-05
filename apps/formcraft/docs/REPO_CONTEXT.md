Braintrust Tracing

- Initialization: `instrumentation.ts` calls `initLogger` with `BRAINTRUST_API_KEY` and optional `BRAINTRUST_PROJECT_NAME`. Next.js loads this at server startup.
- Wrapper: `app/lib/ai/tracing.ts` wraps Vercel AI SDK top-level functions using `wrapAISDK(ai)` and re-exports `generateObject`, `generateText`, `streamText`, and `streamObject`.
- Usage: Import wrapped functions from `@/app/lib/ai/tracing` instead of `ai`.
  - Example: `import { generateObject } from '@/app/lib/ai/tracing'`.
- Scope: All server calls in this app that used `generateObject`/`generateText` now use the wrapped versions. `streamText` in chat handler is also wrapped.
- Environment: Set `BRAINTRUST_API_KEY` (required) and optionally `BRAINTRUST_PROJECT_NAME`.

Notes

- Existing experimental telemetry blocks (Vercel AI `experimental_telemetry`) were left intact where present. Braintrust spans are produced via the wrapper regardless.
- No provider/model behavior changed; `getModel` remains the single source of model resolution.

Prompt Guards

- Background: The shared prompts library may include `md/_guards.md` in local development. Including it in every prompt (especially for internal tool calls) is noisy.
- Change: We now explicitly request guardrails only for user-facing chat endpoints by passing `include_guards: true` into `loadPrompt(...)`:
  - formcraft: `app/api/chat/handlers/form-creation.ts: loadPrompt('chat/form-creation-system.md', { include_guards: true, ... })`
  - formfiller: `formfiller/app/api/ai/chat-assist/route.ts: loadPrompt('filler/form-assistant-system.md', { include_guards: true, ... })`
- Internal calls (all other `loadPrompt` usages) do not pass this flag and should render without guardrails if the template honors the `include_guards` variable.
- Follow-up: Ensure the prompts templates conditionally include guards via `{{#include_guards}}…{{/include_guards}}` (or equivalent) and do not auto-inject guards globally.

- Single-Pass Generation (default)

- The single-pass form creation mode is enabled by default.
- Disable via either:
  - Request body: `options.singlePass: false`
  - Query string: `/api/chat?singlePass=false`
- Behavior:
  - Uses `packages/prompts/md/form/create-form.md` with `FormSchema` to generate the full form in one AI call.
  - Synthesizes standard `data-agent_event` stream events so the UI remains compatible:
    - `agent_initialized`, `state_snapshot` (metadata), `agent_warning` (question count), `question_schema_generated` per question, `state_snapshot` (final), `agent_finalized`.
  - Finalizes to DB via `finalizeForm` (version insert + form update) and writes a brief assistant summary message.
  - The legacy workflow/tool-based streaming path is used only when single-pass is disabled.
