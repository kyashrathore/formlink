-- Google Sheets Integration with Composio
-- Migration for secure integration tables with security hardening

-- 1. User Integrations Table (Secured)
CREATE TABLE IF NOT EXISTS "public"."user_integrations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "toolkit" "text" NOT NULL CHECK (toolkit IN ('GOOGLESHEETS', 'SALESFORCE', 'HUBSPOT', 'SLACKBOT', 'NOTION', 'AIRTABLE')),
    "composio_connection_id" "text" NOT NULL,
    "connection_status" "text" DEFAULT 'active' NOT NULL CHECK (connection_status IN ('active', 'inactive', 'expired', 'revoked')),
    "auth_config_id" "text",
    "granted_scopes" "jsonb" DEFAULT '[]'::jsonb,
    "connection_metadata" "jsonb" DEFAULT '{}'::jsonb,
    "connected_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_used_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "user_integrations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "user_integrations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE,
    CONSTRAINT "user_integrations_user_toolkit_unique" UNIQUE ("user_id", "toolkit")
);

-- Performance indexes
CREATE INDEX "idx_user_integrations_user_id_status" ON "public"."user_integrations" USING "btree" ("user_id", "connection_status");
CREATE INDEX "idx_user_integrations_toolkit" ON "public"."user_integrations" USING "btree" ("toolkit");
CREATE INDEX "idx_user_integrations_last_used" ON "public"."user_integrations" USING "btree" ("last_used_at" DESC NULLS LAST);

-- Row Level Security
ALTER TABLE "public"."user_integrations" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_integrations_select_own" ON "public"."user_integrations"
FOR SELECT USING ("user_id" = "auth"."uid"());
CREATE POLICY "user_integrations_insert_own" ON "public"."user_integrations"
FOR INSERT WITH CHECK ("user_id" = "auth"."uid"());
CREATE POLICY "user_integrations_update_own" ON "public"."user_integrations"
FOR UPDATE USING ("user_id" = "auth"."uid"());
CREATE POLICY "user_integrations_delete_own" ON "public"."user_integrations"
FOR DELETE USING ("user_id" = "auth"."uid"());

-- 2. Form Integration Configurations (Secured)
CREATE TABLE IF NOT EXISTS "public"."form_integration_configs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "form_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "toolkit" "text" NOT NULL CHECK (toolkit IN ('GOOGLESHEETS', 'SALESFORCE', 'HUBSPOT', 'SLACKBOT', 'NOTION', 'AIRTABLE')),
    "action_type" "text" NOT NULL CHECK (action_type IN ('create_row', 'send_message', 'create_contact', 'update_record', 'create_page')),
    "target_config" "jsonb" NOT NULL,
    "field_mappings" "jsonb" NOT NULL,
    "message_template" "text",
    "validation_schema" "jsonb" DEFAULT '{}'::jsonb,
    "is_active" "boolean" DEFAULT true,
    "execution_order" "integer" DEFAULT 1 CHECK (execution_order > 0),
    "rate_limit_per_hour" "integer" DEFAULT 3600 CHECK (rate_limit_per_hour > 0),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "form_integration_configs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "form_integration_configs_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE CASCADE,
    CONSTRAINT "form_integration_configs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE
);

-- Performance indexes
CREATE INDEX "idx_form_integration_configs_form_active" ON "public"."form_integration_configs" USING "btree" ("form_id", "is_active", "execution_order");
CREATE INDEX "idx_form_integration_configs_user_id" ON "public"."form_integration_configs" USING "btree" ("user_id");
CREATE INDEX "idx_form_integration_configs_toolkit" ON "public"."form_integration_configs" USING "btree" ("toolkit");

-- Row Level Security
ALTER TABLE "public"."form_integration_configs" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "form_integration_configs_select_own" ON "public"."form_integration_configs"
FOR SELECT USING ("user_id" = "auth"."uid"());
CREATE POLICY "form_integration_configs_insert_own" ON "public"."form_integration_configs"
FOR INSERT WITH CHECK ("user_id" = "auth"."uid"());
CREATE POLICY "form_integration_configs_update_own" ON "public"."form_integration_configs"
FOR UPDATE USING ("user_id" = "auth"."uid"());
CREATE POLICY "form_integration_configs_delete_own" ON "public"."form_integration_configs"
FOR DELETE USING ("user_id" = "auth"."uid"());

-- 3. Integration Events Log (Secured)
CREATE TABLE IF NOT EXISTS "public"."integration_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "form_id" "uuid",
    "submission_id" "uuid",
    "integration_config_id" "uuid" NOT NULL,
    "toolkit" "text" NOT NULL,
    "action" "text" NOT NULL,
    "status" "text" NOT NULL CHECK (status IN ('success', 'failed', 'pending', 'timeout', 'rate_limited')),
    "input_data_hash" "text", -- Hash of sensitive data instead of storing raw
    "output_data" "jsonb",
    "error_message" "text",
    "error_code" "text",
    "execution_time_ms" integer CHECK (execution_time_ms >= 0),
    "retry_count" integer DEFAULT 0 CHECK (retry_count >= 0),
    "security_context" "jsonb" DEFAULT '{}'::jsonb,
    "ip_address" inet,
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "integration_events_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "integration_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE,
    CONSTRAINT "integration_events_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE SET NULL,
    CONSTRAINT "integration_events_config_id_fkey" FOREIGN KEY ("integration_config_id") REFERENCES "public"."form_integration_configs"("id") ON DELETE CASCADE
);

-- Performance indexes for monitoring and analytics
CREATE INDEX "idx_integration_events_user_created" ON "public"."integration_events" USING "btree" ("user_id", "created_at" DESC);
CREATE INDEX "idx_integration_events_status_created" ON "public"."integration_events" USING "btree" ("status", "created_at" DESC);
CREATE INDEX "idx_integration_events_form_status" ON "public"."integration_events" USING "btree" ("form_id", "status", "created_at" DESC);
CREATE INDEX "idx_integration_events_config_id" ON "public"."integration_events" USING "btree" ("integration_config_id");

-- Row Level Security
ALTER TABLE "public"."integration_events" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "integration_events_select_own" ON "public"."integration_events"
FOR SELECT USING ("user_id" = "auth"."uid"());
CREATE POLICY "integration_events_insert_system" ON "public"."integration_events"
FOR INSERT WITH CHECK (true); -- System can insert events for any user

-- Grant permissions to authenticated users
GRANT ALL ON "public"."user_integrations" TO "authenticated";
GRANT ALL ON "public"."form_integration_configs" TO "authenticated";
GRANT ALL ON "public"."integration_events" TO "authenticated";

-- Grant usage on sequences
GRANT USAGE ON ALL SEQUENCES IN SCHEMA "public" TO "authenticated";