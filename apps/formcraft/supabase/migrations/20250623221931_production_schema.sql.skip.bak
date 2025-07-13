

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."form_status" AS ENUM (
    'draft',
    'published',
    'archived'
);


ALTER TYPE "public"."form_status" OWNER TO "postgres";


CREATE TYPE "public"."submission_status" AS ENUM (
    'in_progress',
    'completed',
    'abandoned'
);


ALTER TYPE "public"."submission_status" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_anonymous_form_limit"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
  DECLARE
    form_count integer;
    user_email text;
  BEGIN
    -- Get user email to check if anonymous
    SELECT email INTO user_email
    FROM public.users
    WHERE id = NEW.user_id;

    -- Check if user is anonymous (using Supabase's anonymous email pattern)
    IF user_email LIKE '%@anonymous.example' THEN
      -- Count existing forms
      SELECT COUNT(*) INTO form_count
      FROM public.forms
      WHERE user_id = NEW.user_id;

      -- Limit anonymous users to 3 forms
      IF form_count >= 3 THEN
        RAISE EXCEPTION 'Anonymous users are limited to 3 forms';
      END IF;
    END IF;

    RETURN NEW;
  END;
  $$;


ALTER FUNCTION "public"."check_anonymous_form_limit"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_short_id"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.short_id := hashids.encode(NEW.id); -- Ensure NEW.id is the correct column to encode
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."generate_short_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_filtered_submissions"("submission_filters" "jsonb", "answer_filters" "jsonb", "page" integer DEFAULT 1, "page_size" integer DEFAULT 50) RETURNS TABLE("data" "jsonb", "total_count" bigint, "total_completed_count" bigint, "total_in_progress_count" bigint, "total_filtered_count" bigint, "completed_count" bigint, "in_progress_count" bigint)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  WITH filtered_submissions_base AS (
    -- This CTE selects submissions based on general submission-level filters.
    -- It selects the original UUIDs and other necessary fields for internal use.
    SELECT
        fs_inner.submission_id AS original_submission_id,
        fs_inner.form_version_id,
        fs_inner.user_id,
        fs_inner.created_at,
        fs_inner.completed_at,
        fs_inner.status,
        fs_inner.testmode
    FROM form_submissions fs_inner
    WHERE
      (submission_filters->>'form_version_id' IS NULL OR fs_inner.form_version_id = (submission_filters->>'form_version_id')::uuid)
      AND (submission_filters->>'status' IS NULL OR fs_inner.status = (submission_filters->>'status')::public.submission_status)
      AND (submission_filters->>'user_id' IS NULL OR fs_inner.user_id = (submission_filters->>'user_id')::uuid)
      AND (submission_filters->>'created_at' IS NULL OR fs_inner.created_at >= (submission_filters->>'created_at')::timestamptz)
      AND (submission_filters->>'testmode' IS NULL OR fs_inner.testmode = (submission_filters->>'testmode')::boolean)
  ),
  relevant_filter_data AS (
    -- Pre-processes answer_filters to get question_id and their filter_criteria (JSONB values).
    SELECT key AS question_id, value AS filter_criteria
    FROM jsonb_each(answer_filters)
    WHERE answer_filters IS NOT NULL AND answer_filters != '{}'::jsonb
  ),
  answer_conditions AS (
    -- Identifies submissions and question_ids that match answer filter criteria.
    SELECT DISTINCT
      a.submission_id,
      a.question_id
    FROM
      form_answers a
      JOIN relevant_filter_data rfd ON a.question_id = rfd.question_id
      LEFT JOIN LATERAL jsonb_array_elements(
          CASE
              WHEN jsonb_typeof(rfd.filter_criteria) = 'array' THEN rfd.filter_criteria
              ELSE NULL
          END
      ) AS arr_elem(val) ON TRUE
    WHERE
      (
        (jsonb_typeof(rfd.filter_criteria) = 'array' AND a.answer_value = arr_elem.val) OR
        (jsonb_typeof(rfd.filter_criteria) = 'string' AND a.answer_value = rfd.filter_criteria) OR
        (jsonb_typeof(rfd.filter_criteria) IN ('number', 'boolean') AND a.answer_value = rfd.filter_criteria) OR
        (jsonb_typeof(rfd.filter_criteria) = 'null' AND (a.answer_value IS NULL OR a.answer_value = 'null'::jsonb))
      )
  ),
  submissions_meeting_filter_criteria AS (
    -- Counts distinct matched questions per submission and filters them.
    SELECT
      fsb.original_submission_id,
      fsb.form_version_id,
      fsb.user_id,
      fsb.created_at,
      fsb.completed_at,
      fsb.status,
      fsb.testmode,
      COUNT(DISTINCT ac.question_id) AS matched_question_count
    FROM filtered_submissions_base fsb
    LEFT JOIN answer_conditions ac ON fsb.original_submission_id = ac.submission_id
    GROUP BY
      fsb.original_submission_id, fsb.form_version_id, fsb.user_id, fsb.created_at, fsb.completed_at, fsb.status, fsb.testmode
  ),
  answer_filter_stats AS (
    -- Pre-calculates the total number of keys in answer_filters.
    SELECT
      CASE
        WHEN answer_filters IS NOT NULL AND answer_filters != '{}'::jsonb
        THEN (SELECT count(*) FROM jsonb_object_keys(answer_filters))::integer
        ELSE 0
      END AS total_filter_keys
  ),
  qualified_submissions AS (
    -- Selects submissions that pass all filters.
    SELECT
      smfc.original_submission_id,
      smfc.form_version_id,
      smfc.user_id,
      smfc.created_at,
      smfc.completed_at,
      smfc.status,
      smfc.testmode
    FROM submissions_meeting_filter_criteria smfc
    CROSS JOIN answer_filter_stats afs
    WHERE
      (
        afs.total_filter_keys = 0 OR
        smfc.matched_question_count = afs.total_filter_keys
      )
  ),
  aggregated_answers AS (
    -- Aggregates all answers for the qualified submissions.
    SELECT
      fa.submission_id,
      jsonb_object_agg(fa.question_id, fa.answer_value) as submission_answers
    FROM form_answers fa
    WHERE fa.submission_id IN (SELECT qs.original_submission_id FROM qualified_submissions qs)
    GROUP BY fa.submission_id
  ),
  paginated_results AS (
    -- Get paginated results with aggregated answers
    SELECT
      qs.original_submission_id::TEXT AS submission_id,
      qs.form_version_id::TEXT AS form_version_id,
      qs.user_id::TEXT AS user_id,
      qs.created_at,
      qs.completed_at,
      qs.status::TEXT AS status,
      qs.testmode,
      COALESCE(aa.submission_answers, '{}'::jsonb) AS answers
    FROM qualified_submissions qs
    LEFT JOIN aggregated_answers aa ON qs.original_submission_id = aa.submission_id
    ORDER BY qs.created_at DESC
    LIMIT page_size OFFSET (page - 1) * page_size
  ),
  counts AS (
    -- Calculate counts from qualified submissions (filtered)
    SELECT
      COUNT(*) AS total_filtered,
      COUNT(*) FILTER (WHERE status = 'completed') AS completed,
      COUNT(*) FILTER (WHERE status = 'in_progress') AS in_progress
    FROM qualified_submissions
  ),
  total_counts AS (
    -- Calculate total counts for the form (ignoring all filters except form_version_id)
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE status = 'completed') AS total_completed,
      COUNT(*) FILTER (WHERE status = 'in_progress') AS total_in_progress
    FROM form_submissions
    WHERE form_version_id = (submission_filters->>'form_version_id')::uuid
  )
  -- Return a single row with data array and counts
  SELECT
    COALESCE(
      (SELECT jsonb_agg(row_to_json(pr.*)) FROM paginated_results pr),
      '[]'::jsonb
    ) AS data,
    tc.total AS total_count,
    tc.total_completed AS total_completed_count,
    tc.total_in_progress AS total_in_progress_count,
    c.total_filtered AS total_filtered_count,
    c.completed AS completed_count,
    c.in_progress AS in_progress_count
  FROM counts c
  CROSS JOIN total_counts tc;
END;
$$;


ALTER FUNCTION "public"."get_filtered_submissions"("submission_filters" "jsonb", "answer_filters" "jsonb", "page" integer, "page_size" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_last_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- Check if the operation is an UPDATE and the row data has actually changed
    IF TG_OP = 'UPDATE' AND OLD IS DISTINCT FROM NEW THEN
        NEW.last_updated_at = NOW();
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_last_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_submission_timestamp_on_answer"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    target_submission_id UUID;
BEGIN
    IF (TG_OP = 'DELETE') THEN
        target_submission_id := OLD.submission_id;
    ELSE
        target_submission_id := NEW.submission_id;
    END IF;

    UPDATE public.form_submissions
    SET last_updated_at = NOW()
    WHERE submission_id = target_submission_id;

    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$;


ALTER FUNCTION "public"."update_submission_timestamp_on_answer"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- Check if the operation is an UPDATE and the row data has actually changed
    IF TG_OP = 'UPDATE' AND OLD IS DISTINCT FROM NEW THEN
        NEW.updated_at = NOW();
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."brands" (
    "brand_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "logo_url" "text",
    "theme" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."brands" OWNER TO "postgres";


COMMENT ON TABLE "public"."brands" IS 'Stores branding information (logo, theme) for forms.';



CREATE TABLE IF NOT EXISTS "public"."form_answers" (
    "answer_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "submission_id" "uuid" NOT NULL,
    "question_id" character varying(255) NOT NULL,
    "answer_value" "jsonb" NOT NULL,
    "chat_messages" "jsonb",
    "is_additional_field" boolean DEFAULT false
);


ALTER TABLE "public"."form_answers" OWNER TO "postgres";


COMMENT ON TABLE "public"."form_answers" IS 'Stores individual answers provided within a form submission.';



CREATE TABLE IF NOT EXISTS "public"."form_chat_attachments" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_id" "uuid" DEFAULT "gen_random_uuid"(),
    "file_name" "text",
    "file_size" numeric,
    "file_url" "text",
    "file_type" "text",
    "form_id" "uuid"
);


ALTER TABLE "public"."form_chat_attachments" OWNER TO "postgres";


ALTER TABLE "public"."form_chat_attachments" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."form_chat_attachments_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."form_submissions" (
    "submission_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "form_version_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "status" "public"."submission_status" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone,
    "metadata" "jsonb",
    "testmode" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."form_submissions" OWNER TO "postgres";


COMMENT ON TABLE "public"."form_submissions" IS 'Records each attempt or instance of filling out a form version.';



CREATE TABLE IF NOT EXISTS "public"."form_versions" (
    "version_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "form_id" "uuid" NOT NULL,
    "status" "public"."form_status" DEFAULT 'draft'::"public"."form_status" NOT NULL,
    "title" "jsonb" NOT NULL,
    "description" "jsonb",
    "questions" "jsonb" NOT NULL,
    "settings" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "published_at" timestamp with time zone,
    "archived_at" timestamp with time zone,
    "user_id" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."form_versions" OWNER TO "postgres";


COMMENT ON TABLE "public"."form_versions" IS 'Stores specific versions (schema, elements) of a form.';



CREATE TABLE IF NOT EXISTS "public"."forms" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "brand_id" "uuid",
    "user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "current_published_version_id" "uuid",
    "current_draft_version_id" "uuid",
    "short_id" "text",
    "agent_state" "jsonb"
);


ALTER TABLE "public"."forms" OWNER TO "postgres";


COMMENT ON TABLE "public"."forms" IS 'Represents the high-level form entity.';



CREATE TABLE IF NOT EXISTS "public"."messages" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "role" "text",
    "user_id" "uuid",
    "parts" "jsonb",
    "attachments" "jsonb",
    "content" "jsonb",
    "form_id" "uuid",
    CONSTRAINT "messages_role_check" CHECK (("role" = ANY (ARRAY['system'::"text", 'user'::"text", 'assistant'::"text", 'data'::"text"])))
);


ALTER TABLE "public"."messages" OWNER TO "postgres";


COMMENT ON TABLE "public"."messages" IS 'Stores individual messages within a chat.';



ALTER TABLE "public"."messages" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."messages_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."submission_chat_attachments" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_id" "uuid" DEFAULT "gen_random_uuid"(),
    "file_name" "text",
    "file_size" numeric,
    "file_url" "text",
    "file_type" "text",
    "submission_id" "uuid"
);


ALTER TABLE "public"."submission_chat_attachments" OWNER TO "postgres";


COMMENT ON TABLE "public"."submission_chat_attachments" IS 'This is a duplicate of form_chat_attachments';



ALTER TABLE "public"."submission_chat_attachments" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."submission_chat_attachments_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."submission_messages" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "role" "text",
    "user_id" "uuid",
    "parts" "jsonb",
    "attachments" "jsonb",
    "content" "jsonb",
    "submission_id" "uuid",
    CONSTRAINT "messages_role_check" CHECK (("role" = ANY (ARRAY['system'::"text", 'user'::"text", 'assistant'::"text", 'data'::"text"])))
);


ALTER TABLE "public"."submission_messages" OWNER TO "postgres";


ALTER TABLE "public"."submission_messages" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."submission_messages_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "form_id" "uuid" NOT NULL,
    "task_definition" "jsonb" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "output" "jsonb",
    "error" "text",
    "retries" integer DEFAULT 0,
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."tasks" OWNER TO "postgres";


COMMENT ON COLUMN "public"."tasks"."form_id" IS 'Foreign key linking to the parent form generation process';



COMMENT ON COLUMN "public"."tasks"."task_definition" IS 'JSON object describing the task (e.g., { type: "generate_schema", question_title: "..." })';



COMMENT ON COLUMN "public"."tasks"."status" IS 'Current status of the task execution';



COMMENT ON COLUMN "public"."tasks"."output" IS 'Result of the task if successful (e.g., generated schema)';



COMMENT ON COLUMN "public"."tasks"."error" IS 'Error message if the task failed';



CREATE TABLE IF NOT EXISTS "public"."usage_history" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "message_count" integer NOT NULL,
    "period_start" timestamp with time zone NOT NULL,
    "period_end" timestamp with time zone NOT NULL
);


ALTER TABLE "public"."usage_history" OWNER TO "postgres";


COMMENT ON TABLE "public"."usage_history" IS 'Tracks user message usage over periods.';



ALTER TABLE "public"."usage_history" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."usage_history_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "anonymous" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "daily_message_count" integer DEFAULT 0,
    "daily_reset" timestamp with time zone,
    "display_name" "text",
    "message_count" integer DEFAULT 0,
    "preferred_model" "text",
    "premium" boolean DEFAULT false,
    "profile_image" "text"
);


ALTER TABLE "public"."users" OWNER TO "postgres";


COMMENT ON TABLE "public"."users" IS 'Stores user profile information, linked to auth.users.';



ALTER TABLE ONLY "public"."brands"
    ADD CONSTRAINT "brands_pkey" PRIMARY KEY ("brand_id");



ALTER TABLE ONLY "public"."form_answers"
    ADD CONSTRAINT "form_answers_pkey" PRIMARY KEY ("answer_id");



ALTER TABLE ONLY "public"."form_chat_attachments"
    ADD CONSTRAINT "form_chat_attachments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."form_submissions"
    ADD CONSTRAINT "form_submissions_pkey" PRIMARY KEY ("submission_id");



ALTER TABLE ONLY "public"."form_versions"
    ADD CONSTRAINT "form_versions_pkey" PRIMARY KEY ("version_id");



ALTER TABLE ONLY "public"."forms"
    ADD CONSTRAINT "forms_current_draft_version_id_key" UNIQUE ("current_draft_version_id");



ALTER TABLE ONLY "public"."forms"
    ADD CONSTRAINT "forms_current_published_version_id_key" UNIQUE ("current_published_version_id");



ALTER TABLE ONLY "public"."forms"
    ADD CONSTRAINT "forms_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."forms"
    ADD CONSTRAINT "forms_short_id_key" UNIQUE ("short_id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."submission_chat_attachments"
    ADD CONSTRAINT "submission_chat_attachments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."submission_messages"
    ADD CONSTRAINT "submission_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."form_answers"
    ADD CONSTRAINT "uq_answer_per_question_per_submission" UNIQUE ("submission_id", "question_id");



ALTER TABLE ONLY "public"."usage_history"
    ADD CONSTRAINT "usage_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_brands_created_by" ON "public"."brands" USING "btree" ("created_by");



CREATE INDEX "idx_form_answers_question_id" ON "public"."form_answers" USING "btree" ("question_id");



CREATE INDEX "idx_form_answers_submission_id" ON "public"."form_answers" USING "btree" ("submission_id");



CREATE INDEX "idx_form_answers_submission_question" ON "public"."form_answers" USING "btree" ("submission_id", "question_id");



CREATE INDEX "idx_form_submissions_last_updated" ON "public"."form_submissions" USING "btree" ("last_updated_at");



CREATE INDEX "idx_form_submissions_status" ON "public"."form_submissions" USING "btree" ("status");



CREATE INDEX "idx_form_submissions_user_id" ON "public"."form_submissions" USING "btree" ("user_id");



CREATE INDEX "idx_form_submissions_version_id" ON "public"."form_submissions" USING "btree" ("form_version_id");



CREATE INDEX "idx_form_versions_form_id" ON "public"."form_versions" USING "btree" ("form_id");



CREATE INDEX "idx_form_versions_status" ON "public"."form_versions" USING "btree" ("form_id", "status");



CREATE INDEX "idx_forms_brand_id" ON "public"."forms" USING "btree" ("brand_id");



CREATE INDEX "idx_forms_created_by" ON "public"."forms" USING "btree" ("user_id");



CREATE OR REPLACE TRIGGER "check_anonymous_form_limit_trigger" BEFORE INSERT ON "public"."forms" FOR EACH ROW EXECUTE FUNCTION "public"."check_anonymous_form_limit"();



CREATE OR REPLACE TRIGGER "update_brands_updated_at" BEFORE UPDATE ON "public"."brands" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_form_versions_updated_at" BEFORE UPDATE ON "public"."form_versions" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_forms_updated_at" BEFORE UPDATE ON "public"."forms" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_submission_on_answer_change" AFTER INSERT OR DELETE OR UPDATE ON "public"."form_answers" FOR EACH ROW EXECUTE FUNCTION "public"."update_submission_timestamp_on_answer"();



CREATE OR REPLACE TRIGGER "update_submissions_last_updated_at" BEFORE UPDATE ON "public"."form_submissions" FOR EACH ROW EXECUTE FUNCTION "public"."update_last_updated_at_column"();



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "fk_auth_user" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."form_answers"
    ADD CONSTRAINT "fk_form_answers_submission" FOREIGN KEY ("submission_id") REFERENCES "public"."form_submissions"("submission_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."form_submissions"
    ADD CONSTRAINT "fk_form_submissions_version" FOREIGN KEY ("form_version_id") REFERENCES "public"."form_versions"("version_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."form_versions"
    ADD CONSTRAINT "fk_form_versions_form" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."forms"
    ADD CONSTRAINT "fk_forms_brand" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("brand_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."forms"
    ADD CONSTRAINT "fk_forms_current_draft_version" FOREIGN KEY ("current_draft_version_id") REFERENCES "public"."form_versions"("version_id") ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED;



ALTER TABLE ONLY "public"."forms"
    ADD CONSTRAINT "fk_forms_current_published_version" FOREIGN KEY ("current_published_version_id") REFERENCES "public"."form_versions"("version_id") ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED;



ALTER TABLE ONLY "public"."form_chat_attachments"
    ADD CONSTRAINT "form_chat_attachments_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id");



ALTER TABLE ONLY "public"."form_versions"
    ADD CONSTRAINT "form_versions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."forms"
    ADD CONSTRAINT "forms_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."submission_chat_attachments"
    ADD CONSTRAINT "submission_chat_attachments_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "public"."form_submissions"("submission_id");



ALTER TABLE ONLY "public"."submission_messages"
    ADD CONSTRAINT "submission_messages_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "public"."form_submissions"("submission_id");



ALTER TABLE ONLY "public"."submission_messages"
    ADD CONSTRAINT "submission_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."usage_history"
    ADD CONSTRAINT "usage_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Allow users to delete their own brands" ON "public"."brands" FOR DELETE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "created_by"));



CREATE POLICY "Allow users to delete their own form versions" ON "public"."form_versions" FOR DELETE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = ( SELECT "forms"."user_id" AS "created_by"
   FROM "public"."forms"
  WHERE ("forms"."id" = "form_versions"."form_id"))));



CREATE POLICY "Allow users to delete their own forms" ON "public"."forms" FOR DELETE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Allow users to delete their own records" ON "public"."users" FOR DELETE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "id"));



CREATE POLICY "Allow users to delete their own usage history records" ON "public"."usage_history" FOR DELETE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Allow users to insert their own brands" ON "public"."brands" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Allow users to insert their own form versions" ON "public"."form_versions" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Allow users to insert their own messages" ON "public"."messages" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Allow users to insert their own usage history records" ON "public"."usage_history" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Allow users to select their own brands" ON "public"."brands" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "created_by"));



CREATE POLICY "Allow users to select their own form versions" ON "public"."form_versions" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = ( SELECT "forms"."user_id" AS "created_by"
   FROM "public"."forms"
  WHERE ("forms"."id" = "form_versions"."form_id"))));



CREATE POLICY "Allow users to select their own forms" ON "public"."forms" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Allow users to select their own records" ON "public"."users" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "id"));



CREATE POLICY "Allow users to select their own usage history records" ON "public"."usage_history" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Allow users to update their own brands" ON "public"."brands" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "created_by")) WITH CHECK (true);



CREATE POLICY "Allow users to update their own form versions" ON "public"."form_versions" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = ( SELECT "forms"."user_id" AS "created_by"
   FROM "public"."forms"
  WHERE ("forms"."id" = "form_versions"."form_id")))) WITH CHECK (true);



CREATE POLICY "Allow users to update their own forms" ON "public"."forms" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK (true);



CREATE POLICY "Allow users to update their own records" ON "public"."users" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "id")) WITH CHECK (true);



CREATE POLICY "Allow users to update their own usage history records" ON "public"."usage_history" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK (true);



CREATE POLICY "Enable insert for authenticated users only" ON "public"."forms" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Enable insert for authenticated users only" ON "public"."users" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "id"));



ALTER TABLE "public"."brands" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "brands_insert_own" ON "public"."brands" FOR INSERT WITH CHECK (("created_by" = "auth"."uid"()));



CREATE POLICY "brands_select_own" ON "public"."brands" FOR SELECT USING (("created_by" = "auth"."uid"()));



CREATE POLICY "brands_update_own" ON "public"."brands" FOR UPDATE USING (("created_by" = "auth"."uid"()));



ALTER TABLE "public"."form_answers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "form_answers_insert_public" ON "public"."form_answers" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."form_submissions"
     JOIN "public"."form_versions" ON (("form_versions"."version_id" = "form_submissions"."form_version_id")))
  WHERE (("form_submissions"."submission_id" = "form_answers"."submission_id") AND (("form_submissions"."testmode" = true) OR ("form_versions"."status" = 'published'::"public"."form_status"))))));



CREATE POLICY "form_answers_select_form_owner" ON "public"."form_answers" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (("public"."form_submissions"
     JOIN "public"."form_versions" ON (("form_versions"."version_id" = "form_submissions"."form_version_id")))
     JOIN "public"."forms" ON (("forms"."id" = "form_versions"."form_id")))
  WHERE (("form_submissions"."submission_id" = "form_answers"."submission_id") AND ("forms"."user_id" = "auth"."uid"())))));



CREATE POLICY "form_answers_update_submission_owner" ON "public"."form_answers" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."form_submissions"
  WHERE (("form_submissions"."submission_id" = "form_answers"."submission_id") AND ("form_submissions"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."form_chat_attachments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "form_chat_attachments_insert_form_owner" ON "public"."form_chat_attachments" FOR INSERT WITH CHECK ((("user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."forms"
  WHERE (("forms"."id" = "form_chat_attachments"."form_id") AND ("forms"."user_id" = "auth"."uid"()))))));



CREATE POLICY "form_chat_attachments_select_form_owner" ON "public"."form_chat_attachments" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."forms"
  WHERE (("forms"."id" = "form_chat_attachments"."form_id") AND ("forms"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."form_submissions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "form_submissions_insert_public" ON "public"."form_submissions" FOR INSERT WITH CHECK ((("testmode" = true) OR (EXISTS ( SELECT 1
   FROM "public"."form_versions"
  WHERE (("form_versions"."version_id" = "form_submissions"."form_version_id") AND ("form_versions"."status" = 'published'::"public"."form_status"))))));



CREATE POLICY "form_submissions_select_form_owner" ON "public"."form_submissions" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."form_versions"
     JOIN "public"."forms" ON (("forms"."id" = "form_versions"."form_id")))
  WHERE (("form_versions"."version_id" = "form_submissions"."form_version_id") AND ("forms"."user_id" = "auth"."uid"())))));



CREATE POLICY "form_submissions_update_own" ON "public"."form_submissions" FOR UPDATE USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."form_versions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "form_versions_insert_own" ON "public"."form_versions" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."forms"
  WHERE (("forms"."id" = "form_versions"."form_id") AND ("forms"."user_id" = "auth"."uid"())))));



CREATE POLICY "form_versions_select_own" ON "public"."form_versions" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."forms"
  WHERE (("forms"."id" = "form_versions"."form_id") AND ("forms"."user_id" = "auth"."uid"())))));



CREATE POLICY "form_versions_update_own" ON "public"."form_versions" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."forms"
  WHERE (("forms"."id" = "form_versions"."form_id") AND ("forms"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."forms" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "forms_delete_own" ON "public"."forms" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "forms_insert_own" ON "public"."forms" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "forms_select_own" ON "public"."forms" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "forms_update_own" ON "public"."forms" FOR UPDATE USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "messages_insert_form_owner" ON "public"."messages" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."forms"
  WHERE (("forms"."id" = "messages"."form_id") AND ("forms"."user_id" = "auth"."uid"())))));



CREATE POLICY "messages_select_form_owner" ON "public"."messages" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."forms"
  WHERE (("forms"."id" = "messages"."form_id") AND ("forms"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."submission_chat_attachments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "submission_chat_attachments_insert_public" ON "public"."submission_chat_attachments" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."form_submissions"
     JOIN "public"."form_versions" ON (("form_versions"."version_id" = "form_submissions"."form_version_id")))
  WHERE (("form_submissions"."submission_id" = "submission_chat_attachments"."submission_id") AND (("form_submissions"."testmode" = true) OR ("form_versions"."status" = 'published'::"public"."form_status"))))));



CREATE POLICY "submission_chat_attachments_select_form_owner" ON "public"."submission_chat_attachments" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (("public"."form_submissions"
     JOIN "public"."form_versions" ON (("form_versions"."version_id" = "form_submissions"."form_version_id")))
     JOIN "public"."forms" ON (("forms"."id" = "form_versions"."form_id")))
  WHERE (("form_submissions"."submission_id" = "submission_chat_attachments"."submission_id") AND ("forms"."user_id" = "auth"."uid"())))));



CREATE POLICY "submission_chat_attachments_select_submission_owner" ON "public"."submission_chat_attachments" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."form_submissions"
  WHERE (("form_submissions"."submission_id" = "submission_chat_attachments"."submission_id") AND ("form_submissions"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."submission_messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "submission_messages_insert_public" ON "public"."submission_messages" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."form_submissions"
     JOIN "public"."form_versions" ON (("form_versions"."version_id" = "form_submissions"."form_version_id")))
  WHERE (("form_submissions"."submission_id" = "submission_messages"."submission_id") AND (("form_submissions"."testmode" = true) OR ("form_versions"."status" = 'published'::"public"."form_status"))))));



CREATE POLICY "submission_messages_select_form_owner" ON "public"."submission_messages" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (("public"."form_submissions"
     JOIN "public"."form_versions" ON (("form_versions"."version_id" = "form_submissions"."form_version_id")))
     JOIN "public"."forms" ON (("forms"."id" = "form_versions"."form_id")))
  WHERE (("form_submissions"."submission_id" = "submission_messages"."submission_id") AND ("forms"."user_id" = "auth"."uid"())))));



CREATE POLICY "submission_messages_select_submission_owner" ON "public"."submission_messages" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."form_submissions"
  WHERE (("form_submissions"."submission_id" = "submission_messages"."submission_id") AND ("form_submissions"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."tasks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tasks_insert_form_owner" ON "public"."tasks" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."forms"
  WHERE (("forms"."id" = "tasks"."form_id") AND ("forms"."user_id" = "auth"."uid"())))));



CREATE POLICY "tasks_select_form_owner" ON "public"."tasks" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."forms"
  WHERE (("forms"."id" = "tasks"."form_id") AND ("forms"."user_id" = "auth"."uid"())))));



CREATE POLICY "tasks_update_form_owner" ON "public"."tasks" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."forms"
  WHERE (("forms"."id" = "tasks"."form_id") AND ("forms"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."usage_history" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "usage_history_insert_service" ON "public"."usage_history" FOR INSERT WITH CHECK (false);



CREATE POLICY "usage_history_select_own" ON "public"."usage_history" FOR SELECT USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "users_insert_service" ON "public"."users" FOR INSERT WITH CHECK (true);



CREATE POLICY "users_select_own" ON "public"."users" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "users_update_own" ON "public"."users" FOR UPDATE USING (("auth"."uid"() = "id"));



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."check_anonymous_form_limit"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_anonymous_form_limit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_anonymous_form_limit"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_short_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_short_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_short_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_filtered_submissions"("submission_filters" "jsonb", "answer_filters" "jsonb", "page" integer, "page_size" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_filtered_submissions"("submission_filters" "jsonb", "answer_filters" "jsonb", "page" integer, "page_size" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_filtered_submissions"("submission_filters" "jsonb", "answer_filters" "jsonb", "page" integer, "page_size" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."update_last_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_last_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_last_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_submission_timestamp_on_answer"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_submission_timestamp_on_answer"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_submission_timestamp_on_answer"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON TABLE "public"."brands" TO "anon";
GRANT ALL ON TABLE "public"."brands" TO "authenticated";
GRANT ALL ON TABLE "public"."brands" TO "service_role";



GRANT ALL ON TABLE "public"."form_answers" TO "anon";
GRANT ALL ON TABLE "public"."form_answers" TO "authenticated";
GRANT ALL ON TABLE "public"."form_answers" TO "service_role";



GRANT ALL ON TABLE "public"."form_chat_attachments" TO "anon";
GRANT ALL ON TABLE "public"."form_chat_attachments" TO "authenticated";
GRANT ALL ON TABLE "public"."form_chat_attachments" TO "service_role";



GRANT ALL ON SEQUENCE "public"."form_chat_attachments_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."form_chat_attachments_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."form_chat_attachments_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."form_submissions" TO "anon";
GRANT ALL ON TABLE "public"."form_submissions" TO "authenticated";
GRANT ALL ON TABLE "public"."form_submissions" TO "service_role";



GRANT ALL ON TABLE "public"."form_versions" TO "anon";
GRANT ALL ON TABLE "public"."form_versions" TO "authenticated";
GRANT ALL ON TABLE "public"."form_versions" TO "service_role";



GRANT ALL ON TABLE "public"."forms" TO "anon";
GRANT ALL ON TABLE "public"."forms" TO "authenticated";
GRANT ALL ON TABLE "public"."forms" TO "service_role";



GRANT ALL ON TABLE "public"."messages" TO "anon";
GRANT ALL ON TABLE "public"."messages" TO "authenticated";
GRANT ALL ON TABLE "public"."messages" TO "service_role";



GRANT ALL ON SEQUENCE "public"."messages_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."messages_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."messages_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."submission_chat_attachments" TO "anon";
GRANT ALL ON TABLE "public"."submission_chat_attachments" TO "authenticated";
GRANT ALL ON TABLE "public"."submission_chat_attachments" TO "service_role";



GRANT ALL ON SEQUENCE "public"."submission_chat_attachments_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."submission_chat_attachments_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."submission_chat_attachments_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."submission_messages" TO "anon";
GRANT ALL ON TABLE "public"."submission_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."submission_messages" TO "service_role";



GRANT ALL ON SEQUENCE "public"."submission_messages_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."submission_messages_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."submission_messages_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."tasks" TO "anon";
GRANT ALL ON TABLE "public"."tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."tasks" TO "service_role";



GRANT ALL ON TABLE "public"."usage_history" TO "anon";
GRANT ALL ON TABLE "public"."usage_history" TO "authenticated";
GRANT ALL ON TABLE "public"."usage_history" TO "service_role";



GRANT ALL ON SEQUENCE "public"."usage_history_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."usage_history_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."usage_history_id_seq" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE ON TABLE "public"."users" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";



GRANT UPDATE("daily_message_count") ON TABLE "public"."users" TO "authenticated";
GRANT UPDATE("daily_message_count") ON TABLE "public"."users" TO "anon";



GRANT UPDATE("daily_reset") ON TABLE "public"."users" TO "authenticated";
GRANT UPDATE("daily_reset") ON TABLE "public"."users" TO "anon";



GRANT UPDATE("display_name") ON TABLE "public"."users" TO "authenticated";
GRANT UPDATE("display_name") ON TABLE "public"."users" TO "anon";



GRANT UPDATE("preferred_model") ON TABLE "public"."users" TO "authenticated";
GRANT UPDATE("preferred_model") ON TABLE "public"."users" TO "anon";



GRANT UPDATE("profile_image") ON TABLE "public"."users" TO "authenticated";
GRANT UPDATE("profile_image") ON TABLE "public"."users" TO "anon";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "service_role";






RESET ALL;
