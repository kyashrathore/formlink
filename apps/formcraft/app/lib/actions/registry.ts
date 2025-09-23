import { z } from "zod"
import type { ActionProvider } from "./types"

export type ActionDescriptor = {
  helpText?: string
  hiddenFields?: string[]
  defaultValues?: Record<string, unknown>
}

type CuratedAction = {
  slug: string
  label: string
  description?: string
  provider: ActionProvider
  toolkit?: string
  requiredScopes?: string[]
  descriptor?: ActionDescriptor
  // Per-view required params for readiness gating
  requiredParams?: Record<string, z.ZodTypeAny>
}

export const CURATED_ACTIONS: CuratedAction[] = [
  {
    slug: "SLACK_SENDS_A_MESSAGE_TO_A_SLACK_CHANNEL",
    label: "Notify Slack channel",
    description: "Post an update into a Slack channel",
    provider: "composio",
    toolkit: "slack",
    descriptor: {
      helpText: "Send a formatted message into a specific Slack channel or DM.",
      hiddenFields: ["channel"],
    },
    requiredParams: {
      channel_id: z.string().min(1, "channel_id is required"),
      text: z.string().min(1, "Message content is required"),
    },
  },
  {
    slug: "LINEAR_CREATE_LINEAR_ISSUE",
    label: "Create Linear issue",
    description: "Create a follow-up issue in Linear",
    provider: "composio",
    toolkit: "linear",
    descriptor: {
      helpText: "Open a Linear issue assigned to the appropriate team.",
    },
    requiredParams: {
      title: z.string().min(1, "title is required"),
      team_id: z.string().min(1, "team_id is required"),
      description: z.string().optional(),
      assignee_id: z.string().optional(),
      labels: z.array(z.string()).optional(),
      priority: z.string().optional(),
    },
  },
  {
    slug: "HUBSPOT_CREATE_CONTACT_OBJECT_WITH_PROPERTIES",
    label: "Create HubSpot contact",
    description: "Log the lead as a HubSpot contact with properties",
    provider: "composio",
    toolkit: "hubspot",
    // View-scoped parameters: collect contact properties to send
    // to HubSpot. Keep 'email' required; others optional.
    requiredParams: {
      properties: z
        .object({
          email: z.string().min(1, "email is required"),
          firstname: z.string().optional(),
          lastname: z.string().optional(),
          phone: z.string().optional(),
          company: z.string().optional(),
        })
        .strict(),
    },
  },
  {
    slug: "HUBSPOT_PUBLISH_MARKETING_EMAIL",
    label: "Send HubSpot marketing email",
    description: "Publish or send a HubSpot marketing email",
    provider: "composio",
    toolkit: "hubspot",
  },
  {
    slug: "USESEND_SEND_EMAIL",
    label: "Send email (useSend)",
    description: "Send a transactional email via useSend",
    provider: "usesend",
    descriptor: {
      helpText:
        "Delivers a templated email through the Formlink useSend instance.",
      hiddenFields: ["from"],
    },
  },
  {
    slug: "SALESFORCE_CREATE_LEAD_WITH_SPECIFIED_CONTENT_TYPE",
    label: "Create Salesforce lead",
    description: "Push the lead into Salesforce",
    provider: "composio",
    toolkit: "salesforce",
  },
  {
    slug: "APOLLO_ADD_CONTACTS_TO_SEQUENCE",
    label: "Add to Apollo sequence",
    description: "Enroll the lead in an Apollo sequence",
    provider: "composio",
    toolkit: "apollo",
  },
  {
    slug: "ZOOMINFO_ENRICH_CONTACT",
    label: "Enrich with ZoomInfo",
    description: "Enrich the lead record via ZoomInfo",
    provider: "composio",
    toolkit: "zoominfo",
  },
  {
    slug: "NOTION_ADD_MULTIPLE_PAGE_CONTENT",
    label: "Append Notion summary",
    description: "Append AI summary into a Notion page",
    provider: "composio",
    toolkit: "notion",
    requiredParams: {
      parent_block_id: z.string().min(1, "parent_block_id is required"),
      content_blocks: z.array(z.any()),
      after: z.string().optional(),
    },
  },
  {
    slug: "AIRTABLE_CREATE_RECORD",
    label: "Create Airtable record",
    description: "Insert the lead into an Airtable base",
    provider: "composio",
    toolkit: "airtable",
    requiredParams: {
      base_id: z.string().min(1, "base_id is required"),
      table_id: z.string().min(1, "table_id is required"),
      fields: z.object({}).passthrough(),
    },
  },
  {
    slug: "GOOGLESHEETS_BATCH_UPDATE",
    label: "Update Google Sheet",
    description: "Write response data into Google Sheets",
    provider: "composio",
    toolkit: "googlesheets",
    requiredParams: {
      spreadsheet_id: z.string().min(1, "spreadsheet_id is required"),
      sheet_id: z.string().optional(),
      range: z.string().optional(),
      values: z.array(z.array(z.any())).optional(),
    },
  },
  {
    slug: "MAILCHIMP_ADD_CAMPAIGN",
    label: "Create Mailchimp campaign",
    description: "Spin up a Mailchimp campaign for the lead",
    provider: "composio",
    toolkit: "mailchimp",
    requiredParams: {
      campaign_name: z.string().min(1, "Campaign name required"),
      type: z.string().min(1, "Type is required"),
      recipients: z.object({
        list_id: z.string().min(1, "list_id required"),
      }),
      settings: z.object({
        subject_line: z.string(),
        title: z.string(),
        from_name: z.string(),
        reply_to: z.string(),
      }),
    },
  },
  {
    slug: "CUSTOMERIO_TRIGGER_BROADCAST",
    label: "Trigger Customer.io broadcast",
    description: "Kick off a Customer.io broadcast for the lead",
    provider: "composio",
    toolkit: "customerio",
    requiredParams: {
      broadcast_id: z.string().min(1, "broadcast_id required"),
      recipients: z.array(z.string()).optional(),
      data: z.object({}).passthrough().optional(),
    },
  },
  {
    slug: "MICROSOFT_TEAMS_TEAMS_POST_CHANNEL_MESSAGE",
    label: "Post Teams channel message",
    description: "Alert a Microsoft Teams channel",
    provider: "composio",
    toolkit: "microsoft_teams",
    requiredParams: {
      team_id: z.string().min(1, "team_id required"),
      channel_id: z.string().min(1, "channel_id required"),
      message: z.string().min(1, "message required"),
    },
  },
  {
    slug: "ASANA_CREATE_A_PROJECT",
    label: "Create Asana project",
    description: "Log follow-up work in Asana",
    provider: "composio",
    toolkit: "asana",
    requiredParams: {
      workspace_id: z.string().min(1, "workspace_id required"),
      name: z.string().min(1, "Project name required"),
      team_id: z.string().optional(),
      notes: z.string().optional(),
    },
  },
  {
    slug: "TRELLO_ADD_BOARDS",
    label: "Create Trello board",
    description: "Spin up a Trello board for the campaign",
    provider: "composio",
    toolkit: "trello",
    requiredParams: {
      name: z.string().min(1, "Board name required"),
      description: z.string().optional(),
      organization_id: z.string().optional(),
    },
  },
  {
    slug: "MONDAY_CREATE_BOARD",
    label: "Create Monday board",
    description: "Track follow-up work in Monday.com",
    provider: "composio",
    toolkit: "monday",
    requiredParams: {
      name: z.string().min(1, "Board name required"),
      board_kind: z.enum(["public", "private", "share"]),
    },
  },
  {
    slug: "JIRA_ADD_COMMENT",
    label: "Add Jira comment",
    description: "Attach feedback to an existing Jira issue",
    provider: "composio",
    toolkit: "jira",
    requiredParams: {
      issue_id_or_key: z.string().min(1, "issue id or key required"),
      body: z.string().min(1, "Comment body required"),
    },
  },
  {
    slug: "ZOOM_ADD_A_MEETING_REGISTRANT",
    label: "Register Zoom attendee",
    description: "Register the lead for a Zoom meeting or webinar",
    provider: "composio",
    toolkit: "zoom",
    requiredParams: {
      meeting_id: z.string().min(1, "meeting_id required"),
      email: z.string().min(1, "Email required"),
      first_name: z.string().min(1, "First name required"),
      last_name: z.string().optional(),
    },
  },

  {
    slug: "CALENDLY_CREATE_SCHEDULING_LINK",
    label: "Create Calendly link",
    description: "Generate a Calendly scheduling link",
    provider: "composio",
    toolkit: "calendly",
    requiredParams: {
      event_type: z.string().min(1, "event_type required"),
      invitee_email: z.string().min(1, "invitee_email required"),
    },
  },
  {
    slug: "SURVEY_MONKEY_CREATE_SURVEY",
    label: "Create SurveyMonkey survey",
    description: "Launch a survey for market research",
    provider: "composio",
    toolkit: "survey_monkey",
    requiredParams: {
      title: z.string().min(1, "Survey title required"),
      pages: z
        .array(
          z.object({
            questions: z.array(
              z.object({
                heading: z.string(),
                type: z.string(),
                options: z.array(z.string()).optional(),
              })
            ),
          })
        )
        .optional(),
    },
  },
]

export function getCuratedActionsByToolkit(toolkit?: string) {
  if (!toolkit) return CURATED_ACTIONS
  return CURATED_ACTIONS.filter((action) => action.toolkit === toolkit)
}

export function getActionDescriptor(
  slug: string
): ActionDescriptor | undefined {
  return CURATED_ACTIONS.find((action) => action.slug === slug)?.descriptor
}
