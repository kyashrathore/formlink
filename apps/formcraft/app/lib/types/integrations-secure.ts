import { z } from "zod";

// Secure form submission data schema
export const FormSubmissionDataSchema = z
  .record(
    z.string().min(1).max(1000), // Field names: 1-1000 chars
    z.union([
      z.string().max(10000), // String values: max 10KB
      z.number().finite(), // Numbers: must be finite
      z.boolean(), // Booleans
      z.array(z.string().max(1000)).max(100), // Arrays: max 100 items, 1KB each
      z.null(), // Null values
    ]),
  )
  .refine(
    (data) => Object.keys(data).length <= 100, // Max 100 fields
    { message: "Too many form fields" },
  );

export type FormSubmissionData = z.infer<typeof FormSubmissionDataSchema>;

// Secure field mapping schema
export const FieldMappingSchema = z.object({
  target: z.string().min(1).max(255),
  type: z.enum(["string", "number", "boolean", "date", "email", "url"]),
  required: z.boolean().default(false),
  transform: z.enum(["none", "uppercase", "lowercase", "trim"]).default("none"),
  validation: z
    .object({
      min: z.number().optional(),
      max: z.number().optional(),
      pattern: z.string().optional(),
    })
    .optional(),
});

export type FieldMapping = z.infer<typeof FieldMappingSchema>;

// Secure integration config schema
export const IntegrationConfigSchema = z.object({
  id: z.string().uuid(),
  form_id: z.string().uuid(),
  user_id: z.string().uuid(),
  toolkit: z.enum([
    "GOOGLESHEETS",
    "SALESFORCE",
    "HUBSPOT",
    "SLACKBOT",
    "NOTION",
    "AIRTABLE",
  ]),
  action_type: z.enum([
    "create_row",
    "send_message",
    "create_contact",
    "update_record",
    "create_page",
  ]),
  target_config: z.record(z.unknown()),
  field_mappings: z.record(FieldMappingSchema),
  message_template: z.string().max(2000).optional(),
  validation_schema: z.record(z.unknown()).default({}),
  is_active: z.boolean().default(true),
  execution_order: z.number().int().positive().default(1),
  rate_limit_per_hour: z.number().int().positive().default(3600),
});

export type IntegrationConfig = z.infer<typeof IntegrationConfigSchema>;

// Secure action template schema
export const ActionTemplateSchema = z.object({
  composio_action: z.string().min(1).max(255),
  required_params: z.array(z.string().min(1).max(100)).max(50),
  required_scopes: z.array(z.string().min(1).max(500)).max(20),
  timeout_ms: z.number().int().positive().default(30000),
  max_retries: z.number().int().min(0).max(5).default(3),
  rate_limit: z
    .object({
      requests_per_minute: z.number().int().positive().default(60),
      requests_per_hour: z.number().int().positive().default(3600),
    })
    .default({}),
});

export type ActionTemplate = z.infer<typeof ActionTemplateSchema>;

// User integration schema
export const UserIntegrationSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  toolkit: z.enum([
    "GOOGLESHEETS",
    "SALESFORCE",
    "HUBSPOT",
    "SLACKBOT",
    "NOTION",
    "AIRTABLE",
  ]),
  composio_connection_id: z.string().min(1),
  connection_status: z.enum(["active", "inactive", "expired", "revoked"]),
  auth_config_id: z.string().optional(),
  granted_scopes: z.array(z.string()).default([]),
  connection_metadata: z.record(z.unknown()).default({}),
  connected_at: z.date(),
  last_used_at: z.date().optional(),
  created_at: z.date(),
  updated_at: z.date(),
});

export type UserIntegration = z.infer<typeof UserIntegrationSchema>;

// Integration event schema
export const IntegrationEventSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  form_id: z.string().uuid().optional(),
  submission_id: z.string().uuid().optional(),
  integration_config_id: z.string().uuid(),
  toolkit: z.string(),
  action: z.string(),
  status: z.enum(["success", "failed", "pending", "timeout", "rate_limited"]),
  input_data_hash: z.string().optional(),
  output_data: z.record(z.unknown()).optional(),
  error_message: z.string().optional(),
  error_code: z.string().optional(),
  execution_time_ms: z.number().int().min(0).optional(),
  retry_count: z.number().int().min(0).default(0),
  security_context: z.record(z.unknown()).default({}),
  ip_address: z.string().optional(),
  user_agent: z.string().optional(),
  created_at: z.date(),
});

export type IntegrationEvent = z.infer<typeof IntegrationEventSchema>;

// AI configuration input schema
export const AIConfigurationInputSchema = z.object({
  actions: z
    .array(
      z.object({
        app: z.enum([
          "GOOGLESHEETS",
          "SLACKBOT",
          "SALESFORCE",
          "HUBSPOT",
          "NOTION",
          "AIRTABLE",
        ]),
        action_type: z.enum([
          "create_row",
          "send_message",
          "create_contact",
          "update_record",
          "create_page",
        ]),
        target_description: z.string().min(1).max(500),
        field_mappings: z.record(z.string().min(1).max(100)).optional(),
        message_template: z.string().max(2000).optional(),
      }),
    )
    .min(1)
    .max(5), // Limit to 5 integrations per configuration
});

export type AIConfigurationInput = z.infer<typeof AIConfigurationInputSchema>;

// Composio execution result schema
export const ComposioExecutionResultSchema = z.object({
  success: z.boolean(),
  result: z.record(z.unknown()).optional(),
  error: z.string().optional(),
  execution_id: z.string().optional(),
});

export type ComposioExecutionResult = z.infer<typeof ComposioExecutionResultSchema>;

// Security context schema
export const SecurityContextSchema = z.object({
  user_verified: z.boolean().default(false),
  form_ownership_verified: z.boolean().default(false),
  rate_limit_checked: z.boolean().default(false),
  input_validated: z.boolean().default(false),
  permissions_validated: z.boolean().default(false),
  csrf_validated: z.boolean().default(false),
});

export type SecurityContext = z.infer<typeof SecurityContextSchema>;