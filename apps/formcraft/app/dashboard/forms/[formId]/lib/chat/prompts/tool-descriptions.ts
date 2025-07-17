export const TOOL_DESCRIPTIONS = {
  createFormAgent:
    "Create a new form based on user requirements. Use this when users want to create a new form from scratch, including when they mention 'removing all questions' from an empty form.",

  updateForm:
    "Update an existing form's title, description, or questions. Use this ONLY when the form already has content to modify. Do not use for empty forms.",

  queryDocs:
    "Answer questions about FormCraft features, capabilities, and best practices. Use this when users ask about how FormCraft works.",

  showConfigButton:
    "Display configuration options for integrations like Slack, webhooks, or email notifications. Use this when users want to set up integrations.",

  getFormContext:
    "Retrieves the current structure (title, description, questions with their IDs, types, and key configurations) of an existing form. Use this to check if a form is empty before deciding between createFormAgent and updateForm. If the form has no questions and user wants to add content, use createFormAgent instead of updateForm.",
}
