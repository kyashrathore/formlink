export const TOOL_DESCRIPTIONS = {
  createForm:
    "Create a new form based on user requirements. Use this immediately when the user asks to create/build/make a new form. Do NOT call getFormContext as a preliminary step for new form creation.",

  generateCode:
    "Generate or update the runtime code for the active form using the Bun + Vite template. Call this when the user wants working code, a preview, or deployment-ready changes for the form runtime.",

  updateForm:
    "Update an existing form's title, description, or questions. Use this ONLY when the form already has content to modify. Do not use for empty forms.",

  queryDocs:
    "Answer questions about FormLink features, capabilities, and best practices. Use this when users ask about how FormLink works.",

  showConfigButton:
    "Display configuration options for integrations like Slack, webhooks, or email notifications. Use this when users want to set up integrations.",

  getFormContext:
    "Retrieves the current structure (title, description, questions with their IDs, types, and key configurations) of an existing form. Use this when the user wants to modify an existing form and you need its current state. Do NOT use this as a pre-check for new form creation—call createForm instead.",

  createResponseView:
    "Create a Responses View (RI plan JSON) for the Responses tab. Use when the user asks to create a new responses view/dashboard/insights plan or when no existing plan is in context. Return a full plan: rpc submission/answer filters, UI columns/sort, and optional insight specs.",

  updateResponseView:
    "Update/refine an existing Responses View (RI plan JSON). Use when the user asks to tweak/adjust an existing view (e.g., change filters, columns, or insights). Requires a currentPlan in planContext; otherwise ask for it or create a new view instead.",

  proposeLifecycleAutomation:
    "Propose lifecycle automations for new submissions. Always use this when the user asks for Submission Hooks and/or Automation Actions (e.g., 'when a submission comes in', 'auto check spam', 'notify/email/slack/hubspot'), even if the Responses tab is active or ri_requested=true. Return only curated action slugs in allowedActions and put hooks in enabledHooks; emit a lifecycle_automation_plan event (do not create or update a Response View).",
}
