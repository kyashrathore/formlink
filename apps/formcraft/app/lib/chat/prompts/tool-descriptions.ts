export const TOOL_DESCRIPTIONS = {
  createForm:
    "Create a new form based on user requirements. Use this immediately when the user asks to create/build/make a new form. Do NOT call getFormContext as a preliminary step for new form creation.",

  updateForm:
    "Update an existing form's title, description, or questions. Use this ONLY when the form already has content to modify. Do not use for empty forms.",

  queryDocs:
    "Answer questions about FormLink features, capabilities, and best practices. Use this when users ask about how FormLink works.",

  showConfigButton:
    "Display configuration options for integrations like Slack, webhooks, or email notifications. Use this when users want to set up integrations.",

  getFormContext:
    "Retrieves the current structure (title, description, questions with their IDs, types, and key configurations) of an existing form. Use this when the user wants to modify an existing form and you need its current state. Do NOT use this as a pre-check for new form creation—call createForm instead.",
}
