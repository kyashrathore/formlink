import {
  ActionTemplate,
  FormSubmissionData,
  IntegrationConfig,
} from "../types/integrations-secure";

// Utility functions for validation and sanitization
function sanitizeHtml(input: string): string {
  return input
    .replace(/[<>]/g, "") // Remove < and >
    .replace(/javascript:/gi, "") // Remove javascript: protocol
    .replace(/on\w+\s*=/gi, "") // Remove event handlers
    .trim();
}

function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
}

function validateUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return ["http:", "https:"].includes(urlObj.protocol);
  } catch {
    return false;
  }
}

export const SECURE_ACTION_TEMPLATES: Record<
  string,
  Record<
    string,
    ActionTemplate & {
      param_mapping: (
        config: IntegrationConfig,
        formData: FormSubmissionData,
      ) => Promise<Record<string, unknown>>;
      validate_config: (config: IntegrationConfig) => Promise<boolean>;
    }
  >
> = {
  GOOGLESHEETS: {
    create_row: {
      composio_action: "GOOGLESHEETS_CREATE_SPREADSHEET_ROW",
      required_params: ["spreadsheet_id", "worksheet_name", "values"],
      required_scopes: ["https://www.googleapis.com/auth/spreadsheets"],
      timeout_ms: 30000,
      max_retries: 3,
      rate_limit: {
        requests_per_minute: 30,
        requests_per_hour: 1800,
      },

      async validate_config(config: IntegrationConfig): Promise<boolean> {
        const { spreadsheet_id, worksheet_name } = config.target_config;

        // Validate spreadsheet_id format (Google Sheets ID pattern)
        if (!spreadsheet_id || typeof spreadsheet_id !== "string") return false;
        if (!/^[a-zA-Z0-9-_]{44}$/.test(spreadsheet_id)) return false;

        // Validate worksheet_name
        if (!worksheet_name || typeof worksheet_name !== "string") return false;
        if (worksheet_name.length > 100) return false;

        return true;
      },

      async param_mapping(
        config: IntegrationConfig,
        formData: FormSubmissionData,
      ): Promise<Record<string, unknown>> {
        // Validate and transform form data based on field mappings
        const values: unknown[] = [];

        for (const [formField, mapping] of Object.entries(
          config.field_mappings,
        )) {
          let value = formData[formField];

          // Apply transformations
          if (typeof value === "string") {
            switch (mapping.transform) {
              case "uppercase":
                value = value.toUpperCase();
                break;
              case "lowercase":
                value = value.toLowerCase();
                break;
              case "trim":
                value = value.trim();
                break;
            }

            // Sanitize HTML content
            value = sanitizeHtml(value);
          }

          // Type validation and conversion
          switch (mapping.type) {
            case "number":
              value = typeof value === "string" ? parseFloat(value) : value;
              if (isNaN(value as number)) value = null;
              break;
            case "email":
              if (typeof value === "string" && !validateEmail(value))
                value = null;
              break;
            case "url":
              if (typeof value === "string" && !validateUrl(value))
                value = null;
              break;
            case "date":
              if (typeof value === "string") {
                const date = new Date(value);
                value = isNaN(date.getTime())
                  ? null
                  : date.toISOString().split("T")[0];
              }
              break;
          }

          // Required field validation
          if (
            mapping.required &&
            (value === null || value === undefined || value === "")
          ) {
            throw new Error(
              `Required field '${formField}' is missing or empty`,
            );
          }

          values.push(value ?? "");
        }

        return {
          spreadsheet_id: config.target_config.spreadsheet_id,
          worksheet_name: config.target_config.worksheet_name,
          values,
        };
      },
    },
  },

  SLACKBOT: {
    send_message: {
      composio_action: "SLACKBOT_SENDS_A_MESSAGE_TO_A_SLACK_CHANNEL",
      required_params: ["channel", "text"],
      required_scopes: ["chat:write"],
      timeout_ms: 15000,
      max_retries: 2,
      rate_limit: {
        requests_per_minute: 20,
        requests_per_hour: 1200,
      },

      async validate_config(config: IntegrationConfig): Promise<boolean> {
        const { channel_id } = config.target_config;

        // Validate Slack channel ID format
        if (!channel_id || typeof channel_id !== "string") return false;
        if (!/^C[A-Z0-9]{8,}$/.test(channel_id)) return false;

        // Validate message template
        if (config.message_template && config.message_template.length > 2000)
          return false;

        return true;
      },

      async param_mapping(
        config: IntegrationConfig,
        formData: FormSubmissionData,
      ): Promise<Record<string, unknown>> {
        let text = config.message_template || "New form submission received";

        // Secure template variable replacement
        for (const [formField, value] of Object.entries(formData)) {
          const sanitizedValue =
            typeof value === "string" ? sanitizeHtml(value) : String(value);
          const placeholder = `{${formField}}`;
          text = text.replace(
            new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"),
            sanitizedValue,
          );
        }

        // Truncate message if too long
        if (text.length > 2000) {
          text = text.substring(0, 1997) + "...";
        }

        return {
          channel: config.target_config.channel_id,
          text,
        };
      },
    },
  },

  SALESFORCE: {
    create_contact: {
      composio_action: "SALESFORCE_CREATE_CONTACT",
      required_params: ["FirstName", "LastName", "Email"],
      required_scopes: ["api"],
      timeout_ms: 45000,
      max_retries: 3,
      rate_limit: {
        requests_per_minute: 10,
        requests_per_hour: 600,
      },

      async validate_config(config: IntegrationConfig): Promise<boolean> {
        // Ensure required Salesforce fields are mapped
        const mappedFields = Object.values(config.field_mappings).map(
          (m) => m.target,
        );
        const requiredFields = ["FirstName", "LastName", "Email"];

        return requiredFields.every((field) => mappedFields.includes(field));
      },

      async param_mapping(
        config: IntegrationConfig,
        formData: FormSubmissionData,
      ): Promise<Record<string, unknown>> {
        const salesforceData: Record<string, unknown> = {};

        for (const [formField, mapping] of Object.entries(
          config.field_mappings,
        )) {
          let value = formData[formField];

          // Salesforce-specific validation
          switch (mapping.target) {
            case "Email":
              if (typeof value === "string" && !validateEmail(value)) {
                throw new Error(
                  `Invalid email format for field '${formField}'`,
                );
              }
              break;
            case "Phone":
              if (typeof value === "string") {
                value = value.replace(/[^\d+\-\(\)\s]/g, ""); // Clean phone number
              }
              break;
          }

          if (mapping.required && !value) {
            throw new Error(
              `Required Salesforce field '${mapping.target}' is missing`,
            );
          }

          salesforceData[mapping.target] = value;
        }

        return salesforceData;
      },
    },
  },

  HUBSPOT: {
    create_contact: {
      composio_action: "HUBSPOT_CREATE_CONTACT",
      required_params: ["properties"],
      required_scopes: ["contacts"],
      timeout_ms: 30000,
      max_retries: 3,
      rate_limit: {
        requests_per_minute: 15,
        requests_per_hour: 900,
      },

      async validate_config(config: IntegrationConfig): Promise<boolean> {
        // Ensure at least email is mapped for HubSpot
        const mappedFields = Object.values(config.field_mappings).map(
          (m) => m.target,
        );
        return mappedFields.includes("email");
      },

      async param_mapping(
        config: IntegrationConfig,
        formData: FormSubmissionData,
      ): Promise<Record<string, unknown>> {
        const properties: Record<string, unknown> = {};

        for (const [formField, mapping] of Object.entries(
          config.field_mappings,
        )) {
          let value = formData[formField];

          // HubSpot-specific validation
          if (mapping.target === "email" && typeof value === "string") {
            if (!validateEmail(value)) {
              throw new Error(`Invalid email format for field '${formField}'`);
            }
          }

          if (mapping.required && !value) {
            throw new Error(
              `Required HubSpot field '${mapping.target}' is missing`,
            );
          }

          properties[mapping.target] = value;
        }

        return { properties };
      },
    },
  },

  NOTION: {
    create_page: {
      composio_action: "NOTION_CREATE_PAGE",
      required_params: ["parent", "properties"],
      required_scopes: ["content.write"],
      timeout_ms: 30000,
      max_retries: 3,
      rate_limit: {
        requests_per_minute: 10,
        requests_per_hour: 600,
      },

      async validate_config(config: IntegrationConfig): Promise<boolean> {
        const { database_id } = config.target_config;

        // Validate Notion database ID format
        if (!database_id || typeof database_id !== "string") return false;
        if (!/^[a-f0-9]{32}$/.test(database_id.replace(/-/g, ""))) return false;

        return true;
      },

      async param_mapping(
        config: IntegrationConfig,
        formData: FormSubmissionData,
      ): Promise<Record<string, unknown>> {
        const properties: Record<string, unknown> = {};

        for (const [formField, mapping] of Object.entries(
          config.field_mappings,
        )) {
          let value = formData[formField];

          // Notion property formatting
          switch (mapping.type) {
            case "string":
              properties[mapping.target] = {
                title: [{ text: { content: String(value || "") } }],
              };
              break;
            case "number":
              properties[mapping.target] = {
                number: typeof value === "number" ? value : parseFloat(String(value)),
              };
              break;
            case "email":
              properties[mapping.target] = {
                email: String(value || ""),
              };
              break;
            case "date":
              properties[mapping.target] = {
                date: { start: String(value || "") },
              };
              break;
            default:
              properties[mapping.target] = {
                rich_text: [{ text: { content: String(value || "") } }],
              };
          }
        }

        return {
          parent: { database_id: config.target_config.database_id },
          properties,
        };
      },
    },
  },

  AIRTABLE: {
    create_row: {
      composio_action: "AIRTABLE_CREATE_RECORD",
      required_params: ["base_id", "table_id", "fields"],
      required_scopes: ["data.records:write"],
      timeout_ms: 30000,
      max_retries: 3,
      rate_limit: {
        requests_per_minute: 5,
        requests_per_hour: 300,
      },

      async validate_config(config: IntegrationConfig): Promise<boolean> {
        const { base_id, table_id } = config.target_config;

        // Validate Airtable base and table IDs
        if (!base_id || typeof base_id !== "string") return false;
        if (!table_id || typeof table_id !== "string") return false;
        if (!/^app[a-zA-Z0-9]{14}$/.test(base_id)) return false;
        if (!/^tbl[a-zA-Z0-9]{14}$/.test(table_id)) return false;

        return true;
      },

      async param_mapping(
        config: IntegrationConfig,
        formData: FormSubmissionData,
      ): Promise<Record<string, unknown>> {
        const fields: Record<string, unknown> = {};

        for (const [formField, mapping] of Object.entries(
          config.field_mappings,
        )) {
          let value = formData[formField];

          // Type-specific formatting for Airtable
          switch (mapping.type) {
            case "number":
              value = typeof value === "string" ? parseFloat(value) : value;
              if (isNaN(value as number)) value = null;
              break;
            case "email":
              if (typeof value === "string" && !validateEmail(value)) {
                throw new Error(`Invalid email format for field '${formField}'`);
              }
              break;
          }

          if (mapping.required && !value) {
            throw new Error(
              `Required Airtable field '${mapping.target}' is missing`,
            );
          }

          fields[mapping.target] = value;
        }

        return {
          base_id: config.target_config.base_id,
          table_id: config.target_config.table_id,
          fields,
        };
      },
    },
  },
};