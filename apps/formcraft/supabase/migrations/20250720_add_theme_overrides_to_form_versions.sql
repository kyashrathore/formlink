-- Add theme_overrides column to form_versions table for form-level theme customization
-- This allows individual forms to override brand-level themes

ALTER TABLE "public"."form_versions" 
ADD COLUMN "theme_overrides" "jsonb" DEFAULT '{}'::"jsonb";

-- Add comment explaining the purpose
COMMENT ON COLUMN "public"."form_versions"."theme_overrides" IS 'Form-specific theme overrides that take precedence over brand theme. Stored as partial FormJunctionTheme JSON.';

-- Create index for efficient theme queries (optional but recommended)
CREATE INDEX IF NOT EXISTS "idx_form_versions_theme_overrides" 
ON "public"."form_versions" USING GIN ("theme_overrides");

-- Update the table comment to reflect new theme capability
COMMENT ON TABLE "public"."form_versions" IS 'Stores specific versions (schema, elements, and theme overrides) of a form.';