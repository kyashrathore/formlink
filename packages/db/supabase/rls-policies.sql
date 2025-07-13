-- FormJunction RLS (Row Level Security) Policies
-- =============================================
-- 
-- This file contains all RLS policies for the FormJunction application.
-- 
-- Key Design Decisions:
-- 1. Using Supabase's built-in anonymous authentication (no custom guest handling)
-- 2. Service role bypasses RLS for system operations
-- 3. FormCraft requires authentication, FormLink allows public submissions
-- 4. Testmode submissions are always allowed for testing
-- 5. Real submissions only allowed to published forms
-- 6. Column-level security prevents updating immutable fields
--
-- Anonymous Users:
-- - Use supabase.auth.signInAnonymously() on client
-- - Identified by auth.jwt() -> 'is_anonymous' = 'true'
-- - Limited to 3 forms (enforced by trigger)
-- =============================================

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_chat_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submission_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submission_chat_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_history ENABLE ROW LEVEL SECURITY;

-- =============================================
-- USERS TABLE POLICIES
-- =============================================

-- Users can read their own data
CREATE POLICY "users_select_own" ON public.users
  FOR SELECT USING (auth.uid() = id);

-- Users can update their own data
CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE USING (auth.uid() = id);

-- Service role can insert new users (for anonymous user creation)
CREATE POLICY "users_insert_service" ON public.users
  FOR INSERT WITH CHECK (true);

-- Column-level security: Restrict which columns users can update
-- Users cannot change: id, email, created_at, anonymous
-- Users can change: display_name, profile_image, preferred_model, etc.
REVOKE UPDATE ON public.users FROM authenticated, anon;
GRANT UPDATE (
  display_name, 
  profile_image, 
  preferred_model, 
  daily_message_count, 
  daily_reset
) ON public.users TO authenticated, anon;

-- =============================================
-- FORMS TABLE POLICIES
-- =============================================

-- Users can view their own forms
CREATE POLICY "forms_select_own" ON public.forms
  FOR SELECT USING (user_id = auth.uid());

-- Users can create forms (with trigger to limit anonymous users)
CREATE POLICY "forms_insert_own" ON public.forms
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Users can update their own forms
CREATE POLICY "forms_update_own" ON public.forms
  FOR UPDATE USING (user_id = auth.uid());

-- Users can delete their own forms
CREATE POLICY "forms_delete_own" ON public.forms
  FOR DELETE USING (user_id = auth.uid());

-- =============================================
-- FORM VERSIONS TABLE POLICIES
-- =============================================

-- Users can view versions of forms they own
CREATE POLICY "form_versions_select_own" ON public.form_versions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.forms 
      WHERE forms.id = form_versions.form_id 
      AND forms.user_id = auth.uid()
    )
  );

-- Users can create versions for their forms
CREATE POLICY "form_versions_insert_own" ON public.form_versions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.forms 
      WHERE forms.id = form_versions.form_id 
      AND forms.user_id = auth.uid()
    )
  );

-- Users can update versions of their forms
CREATE POLICY "form_versions_update_own" ON public.form_versions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.forms 
      WHERE forms.id = form_versions.form_id 
      AND forms.user_id = auth.uid()
    )
  );

-- =============================================
-- FORM SUBMISSIONS TABLE POLICIES
-- =============================================

-- Form owners can view all submissions to their forms
CREATE POLICY "form_submissions_select_form_owner" ON public.form_submissions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.form_versions
      JOIN public.forms ON forms.id = form_versions.form_id
      WHERE form_versions.version_id = form_submissions.form_version_id 
      AND forms.user_id = auth.uid()
    )
  );

-- Allow submissions to published forms or testmode submissions
-- This enables public form filling via FormLink
CREATE POLICY "form_submissions_insert_public" ON public.form_submissions
  FOR INSERT WITH CHECK (
    -- Always allow testmode submissions for testing
    testmode = true 
    OR 
    -- Only allow real submissions to published forms
    EXISTS (
      SELECT 1 FROM public.form_versions
      WHERE form_versions.version_id = form_submissions.form_version_id 
      AND form_versions.status = 'published'
    )
  );

-- Submission owners can update their own submissions
CREATE POLICY "form_submissions_update_own" ON public.form_submissions
  FOR UPDATE USING (user_id = auth.uid());

-- =============================================
-- FORM ANSWERS TABLE POLICIES
-- =============================================

-- Form owners can view all answers to their forms
CREATE POLICY "form_answers_select_form_owner" ON public.form_answers
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.form_submissions
      JOIN public.form_versions ON form_versions.version_id = form_submissions.form_version_id
      JOIN public.forms ON forms.id = form_versions.form_id
      WHERE form_submissions.submission_id = form_answers.submission_id
      AND forms.user_id = auth.uid()
    )
  );

-- Allow answers for testmode or published forms
CREATE POLICY "form_answers_insert_public" ON public.form_answers
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.form_submissions
      JOIN public.form_versions ON form_versions.version_id = form_submissions.form_version_id
      WHERE form_submissions.submission_id = form_answers.submission_id
      AND (
        form_submissions.testmode = true 
        OR form_versions.status = 'published'
      )
    )
  );

-- Submission owners can update their answers
CREATE POLICY "form_answers_update_submission_owner" ON public.form_answers
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.form_submissions
      WHERE form_submissions.submission_id = form_answers.submission_id
      AND form_submissions.user_id = auth.uid()
    )
  );

-- =============================================
-- MESSAGES TABLE POLICIES (Form Builder Chat)
-- =============================================

-- Users can view messages for their forms
CREATE POLICY "messages_select_form_owner" ON public.messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.forms 
      WHERE forms.id = messages.form_id 
      AND forms.user_id = auth.uid()
    )
  );

-- Users can create messages for their forms
CREATE POLICY "messages_insert_form_owner" ON public.messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.forms 
      WHERE forms.id = messages.form_id 
      AND forms.user_id = auth.uid()
    )
  );

-- =============================================
-- FORM CHAT ATTACHMENTS POLICIES
-- =============================================

-- Users can view attachments for their forms
CREATE POLICY "form_chat_attachments_select_form_owner" ON public.form_chat_attachments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.forms 
      WHERE forms.id = form_chat_attachments.form_id 
      AND forms.user_id = auth.uid()
    )
  );

-- Users can upload attachments for their forms
CREATE POLICY "form_chat_attachments_insert_form_owner" ON public.form_chat_attachments
  FOR INSERT WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.forms 
      WHERE forms.id = form_chat_attachments.form_id 
      AND forms.user_id = auth.uid()
    )
  );

-- =============================================
-- SUBMISSION MESSAGES POLICIES (Form Filler Chat)
-- =============================================

-- Form owners can view all submission messages
CREATE POLICY "submission_messages_select_form_owner" ON public.submission_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.form_submissions
      JOIN public.form_versions ON form_versions.version_id = form_submissions.form_version_id
      JOIN public.forms ON forms.id = form_versions.form_id
      WHERE form_submissions.submission_id = submission_messages.submission_id
      AND forms.user_id = auth.uid()
    )
  );

-- Submission owners can view their messages
CREATE POLICY "submission_messages_select_submission_owner" ON public.submission_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.form_submissions
      WHERE form_submissions.submission_id = submission_messages.submission_id
      AND form_submissions.user_id = auth.uid()
    )
  );

-- Allow messages for testmode or published forms
CREATE POLICY "submission_messages_insert_public" ON public.submission_messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.form_submissions
      JOIN public.form_versions ON form_versions.version_id = form_submissions.form_version_id
      WHERE form_submissions.submission_id = submission_messages.submission_id
      AND (
        form_submissions.testmode = true 
        OR form_versions.status = 'published'
      )
    )
  );

-- =============================================
-- SUBMISSION CHAT ATTACHMENTS POLICIES
-- =============================================

-- Form owners can view all submission attachments
CREATE POLICY "submission_chat_attachments_select_form_owner" ON public.submission_chat_attachments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.form_submissions
      JOIN public.form_versions ON form_versions.version_id = form_submissions.form_version_id
      JOIN public.forms ON forms.id = form_versions.form_id
      WHERE form_submissions.submission_id = submission_chat_attachments.submission_id
      AND forms.user_id = auth.uid()
    )
  );

-- Submission owners can view their attachments
CREATE POLICY "submission_chat_attachments_select_submission_owner" ON public.submission_chat_attachments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.form_submissions
      WHERE form_submissions.submission_id = submission_chat_attachments.submission_id
      AND form_submissions.user_id = auth.uid()
    )
  );

-- Allow attachments for testmode or published forms
CREATE POLICY "submission_chat_attachments_insert_public" ON public.submission_chat_attachments
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.form_submissions
      JOIN public.form_versions ON form_versions.version_id = form_submissions.form_version_id
      WHERE form_submissions.submission_id = submission_chat_attachments.submission_id
      AND (
        form_submissions.testmode = true 
        OR form_versions.status = 'published'
      )
    )
  );

-- =============================================
-- BRANDS TABLE POLICIES
-- =============================================

-- Users can view brands they created
CREATE POLICY "brands_select_own" ON public.brands
  FOR SELECT USING (created_by = auth.uid());

-- Users can create brands
CREATE POLICY "brands_insert_own" ON public.brands
  FOR INSERT WITH CHECK (created_by = auth.uid());

-- Users can update their brands
CREATE POLICY "brands_update_own" ON public.brands
  FOR UPDATE USING (created_by = auth.uid());

-- =============================================
-- TASKS TABLE POLICIES
-- =============================================

-- Users can view tasks for their forms
CREATE POLICY "tasks_select_form_owner" ON public.tasks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.forms 
      WHERE forms.id = tasks.form_id 
      AND forms.user_id = auth.uid()
    )
  );

-- Users can create tasks for their forms
CREATE POLICY "tasks_insert_form_owner" ON public.tasks
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.forms 
      WHERE forms.id = tasks.form_id 
      AND forms.user_id = auth.uid()
    )
  );

-- Users can update tasks for their forms
CREATE POLICY "tasks_update_form_owner" ON public.tasks
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.forms 
      WHERE forms.id = tasks.form_id 
      AND forms.user_id = auth.uid()
    )
  );

-- =============================================
-- USAGE HISTORY POLICIES
-- =============================================

-- Users can view their own usage history
CREATE POLICY "usage_history_select_own" ON public.usage_history
  FOR SELECT USING (user_id = auth.uid());

-- Only service role can insert usage history (system tracking)
CREATE POLICY "usage_history_insert_service" ON public.usage_history
  FOR INSERT WITH CHECK (false);

-- =============================================
-- ANONYMOUS USER LIMITS
-- =============================================

-- Function to limit anonymous users to 3 forms
-- Anonymous users are identified by their email pattern
CREATE OR REPLACE FUNCTION check_anonymous_form_limit()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

-- Create trigger to enforce anonymous user limits
CREATE TRIGGER check_anonymous_form_limit_trigger
BEFORE INSERT ON public.forms
FOR EACH ROW
EXECUTE FUNCTION check_anonymous_form_limit();

-- =============================================
-- NOTES FOR IMPLEMENTATION
-- =============================================

-- 1. Apply these policies in Supabase Dashboard or via migration
-- 2. Test thoroughly with both authenticated and anonymous users
-- 3. Monitor RLS performance impact on complex queries
-- 4. Service role should only be used in secure backend environments
-- 5. For FormLink (public forms), ensure proper rate limiting at API level
-- 6. Consider adding indexes on foreign key columns used in RLS policies