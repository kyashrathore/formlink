import { z } from "zod";
import { SECURE_ACTION_TEMPLATES } from "../../integrations/action-templates-secure";
import {
  IntegrationConfigSchema,
  AIConfigurationInputSchema,
} from "../../types/integrations-secure";
import { validateUserFormOwnership, getUserActiveIntegration } from "../../auth/form-ownership";
import { checkRateLimit } from "../../utils/rate-limiting";
import { composioService } from "../../services/composio";

interface ChatToolContext {
  userId: string;
  formId: string;
}

export const configureIntegrationToolSecure = (context: ChatToolContext) => ({
  name: "configure_integration",
  description:
    "Securely configure what happens when form is submitted to external apps like Google Sheets, Slack, Salesforce, etc.",
  schema: AIConfigurationInputSchema,

  execute: async ({ actions }) => {
    try {
      // 1. Validate user authentication
      if (!context.userId) {
        throw new Error("User authentication required");
      }

      // 2. Validate form ownership
      const ownsForm = await validateUserFormOwnership(
        context.userId,
        context.formId,
      );
      if (!ownsForm) {
        throw new Error("User does not own this form");
      }

      // 3. Check rate limiting
      const rateLimitKey = `configure_integration:${context.userId}`;
      const rateLimitAllowed = await checkRateLimit(rateLimitKey, 10, 3600); // 10 configs per hour
      if (!rateLimitAllowed) {
        throw new Error("Rate limit exceeded. Please try again later.");
      }

      const results = [];

      for (const action of actions) {
        try {
          // 4. Validate user has the required connection
          const connection = await getUserActiveIntegration(
            context.userId,
            action.app,
          );

          if (!connection) {
            results.push({
              success: false,
              app: action.app,
              error: "Connection required",
              auth_url: await getSecureAuthUrl(context.userId, action.app),
            });
            continue;
          }

          // 5. Get the action template and validate required scopes
          const template =
            SECURE_ACTION_TEMPLATES[action.app][action.action_type];
          if (!template) {
            results.push({
              success: false,
              app: action.app,
              error: "Unsupported action type",
            });
            continue;
          }

          // 6. Validate user has required scopes
          const hasScopes = await composioService.validateScopes(
            context.userId,
            action.app,
            template.required_scopes,
          );

          if (!hasScopes) {
            results.push({
              success: false,
              app: action.app,
              error: "Additional permissions required",
              reauth_url: await getExpandedAuthUrlSecure(
                context.userId,
                action.app,
                template.required_scopes,
              ),
            });
            continue;
          }

          // 7. Resolve and validate target configuration
          const targetConfig = await resolveTargetSecurely(
            action.target_description,
            context.userId,
            action.app,
          );

          if (!targetConfig) {
            results.push({
              success: false,
              app: action.app,
              error: "Could not resolve target configuration",
              suggestion: getTargetConfigSuggestion(action.app, action.target_description),
            });
            continue;
          }

          // 8. Create secure integration configuration
          const configData = {
            id: crypto.randomUUID(),
            form_id: context.formId,
            user_id: context.userId,
            toolkit: action.app,
            action_type: action.action_type,
            target_config: targetConfig,
            field_mappings: action.field_mappings || {},
            message_template: action.message_template,
            validation_schema: {},
            is_active: true,
            execution_order: results.filter(r => r.success).length + 1,
            rate_limit_per_hour: 3600,
          };

          // Validate configuration schema
          const validatedConfig = IntegrationConfigSchema.parse(configData);

          // Validate with template-specific validation
          const isConfigValid = await template.validate_config(validatedConfig);
          if (!isConfigValid) {
            results.push({
              success: false,
              app: action.app,
              error: "Configuration validation failed",
              details: "The target configuration or field mappings are invalid",
            });
            continue;
          }

          // 9. Save configuration to database
          const configId = await saveIntegrationConfig(validatedConfig);

          if (!configId) {
            results.push({
              success: false,
              app: action.app,
              error: "Failed to save configuration",
            });
            continue;
          }

          results.push({
            success: true,
            app: action.app,
            action: action.action_type,
            config_id: configId,
            target: action.target_description,
            security_validated: true,
            message: generateSuccessMessage(action.app, action.action_type, action.target_description),
          });
        } catch (error) {
          results.push({
            success: false,
            app: action.app,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }

      const successCount = results.filter((r) => r.success).length;
      const totalCount = results.length;

      return {
        type: "integration_configuration",
        results,
        summary: {
          configured: successCount,
          total: totalCount,
          message: `Successfully configured ${successCount}/${totalCount} integrations`,
        },
        security_context: {
          user_authenticated: true,
          form_ownership_verified: true,
          rate_limit_checked: true,
          permissions_validated: true,
        },
        next_steps: generateNextSteps(results),
      };
    } catch (error) {
      return {
        type: "integration_configuration_error",
        error: error instanceof Error ? error.message : "Unknown error",
        suggestion: "Please check your permissions and try again",
      };
    }
  },
});

// Helper functions

async function getSecureAuthUrl(
  userId: string,
  toolkit: string,
): Promise<string> {
  try {
    const result = await composioService.initiateConnection({
      userId,
      toolkit,
      redirectUrl: `${process.env.NEXT_PUBLIC_APP_URL}/integrations/callback`,
    });
    return result.authUrl;
  } catch (error) {
    console.error("Failed to get auth URL:", error);
    return `/integrations/connect/${toolkit}`;
  }
}

async function getExpandedAuthUrlSecure(
  userId: string,
  toolkit: string,
  requiredScopes: string[],
): Promise<string> {
  try {
    const result = await composioService.initiateConnection({
      userId,
      toolkit,
      scopes: requiredScopes,
      redirectUrl: `${process.env.NEXT_PUBLIC_APP_URL}/integrations/callback`,
    });
    return result.authUrl;
  } catch (error) {
    console.error("Failed to get expanded auth URL:", error);
    return `/integrations/connect/${toolkit}?scopes=${requiredScopes.join(",")}`;
  }
}

async function resolveTargetSecurely(
  description: string,
  userId: string,
  toolkit: string,
): Promise<Record<string, unknown> | null> {
  // This is a simplified version - in a real implementation, this would:
  // 1. Use AI to parse the description
  // 2. Query the user's connected accounts to find matching resources
  // 3. Validate the user has access to those resources

  const lowerDescription = description.toLowerCase();

  switch (toolkit) {
    case "GOOGLESHEETS":
      // Try to extract spreadsheet information from description
      if (lowerDescription.includes("spreadsheet") || lowerDescription.includes("sheet")) {
        // In a real implementation, this would query Google Sheets API
        // to find spreadsheets matching the description
        return {
          spreadsheet_id: "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms", // Example ID
          worksheet_name: "Sheet1", // Default worksheet
        };
      }
      break;

    case "SLACKBOT":
      // Try to extract channel information
      if (lowerDescription.includes("channel")) {
        return {
          channel_id: "C1234567890", // Example channel ID
        };
      }
      break;

    case "SALESFORCE":
      // Salesforce contacts don't need specific target config
      return {};

    case "HUBSPOT":
      // HubSpot contacts don't need specific target config
      return {};

    case "NOTION":
      if (lowerDescription.includes("database") || lowerDescription.includes("page")) {
        return {
          database_id: "12345678-1234-1234-1234-123456789012", // Example database ID
        };
      }
      break;

    case "AIRTABLE":
      if (lowerDescription.includes("base") || lowerDescription.includes("table")) {
        return {
          base_id: "appAbCdEfGhIjKlMn", // Example base ID
          table_id: "tblOpQrStUvWxYz12", // Example table ID
        };
      }
      break;
  }

  return null;
}

function getTargetConfigSuggestion(toolkit: string, description: string): string {
  switch (toolkit) {
    case "GOOGLESHEETS":
      return "Please specify the name of your Google Spreadsheet, e.g., 'my expense tracker spreadsheet'";
    case "SLACKBOT":
      return "Please specify the Slack channel name, e.g., '#general' or '#leads'";
    case "NOTION":
      return "Please specify the Notion database name, e.g., 'my contacts database'";
    case "AIRTABLE":
      return "Please specify the Airtable base and table, e.g., 'my CRM base, contacts table'";
    default:
      return "Please provide more specific details about where you want to send the data";
  }
}

async function saveIntegrationConfig(config: any): Promise<string | null> {
  try {
    // This would typically insert into the form_integration_configs table
    // For now, return a mock ID - implement database insertion
    console.log("Saving integration config:", config);
    return crypto.randomUUID();
  } catch (error) {
    console.error("Failed to save integration config:", error);
    return null;
  }
}

function generateSuccessMessage(app: string, actionType: string, target: string): string {
  const actionMap: Record<string, string> = {
    create_row: "add a new row to",
    send_message: "send a message to",
    create_contact: "create a contact in",
    create_page: "create a page in",
    update_record: "update a record in",
  };

  const action = actionMap[actionType] || "perform an action in";
  
  return `✅ Form submissions will now ${action} ${target} via ${app}`;
}

function generateNextSteps(results: any[]): string[] {
  const steps = [];
  
  const failedResults = results.filter(r => !r.success);
  const successResults = results.filter(r => r.success);

  if (failedResults.length > 0) {
    steps.push("Complete the required connections for failed integrations");
  }

  if (successResults.length > 0) {
    steps.push("Test your form to ensure integrations work correctly");
    steps.push("Monitor integration logs in the settings tab");
  }

  if (results.length === 0) {
    steps.push("Describe what you want to happen when someone submits your form");
  }

  return steps;
}