-- Secure fix for anonymous users with proper restrictions
-- This migration maintains security while enabling anonymous functionality

-- 1. Users table - Allow anonymous users to manage only their own records
-- Keep existing policies but add anonymous support with restrictions
DROP POLICY IF EXISTS "Enable users to insert their own record" ON "public"."users";
DROP POLICY IF EXISTS "Enable users to view their own record" ON "public"."users";
DROP POLICY IF EXISTS "Enable users to update their own record" ON "public"."users";

-- Separate policies for authenticated and anonymous users
CREATE POLICY "Authenticated users can insert their own record" 
ON "public"."users" 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = id);

CREATE POLICY "Anonymous users can insert their own record" 
ON "public"."users" 
FOR INSERT 
TO anon
WITH CHECK (
  auth.uid() = id 
  AND email LIKE '%@anonymous.%'  -- Ensure it's an anonymous email pattern
);

CREATE POLICY "Users can view their own record" 
ON "public"."users" 
FOR SELECT 
TO authenticated, anon
USING (auth.uid() = id);

CREATE POLICY "Users can update their own record" 
ON "public"."users" 
FOR UPDATE 
TO authenticated, anon
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
  AND (
    -- Authenticated users can update freely
    (auth.role() = 'authenticated') 
    OR 
    -- Anonymous users can only update specific fields and maintain anonymous email
    (auth.role() = 'anon' AND email LIKE '%@anonymous.%')
  )
);

-- 2. Forms table - Maintain form limits for anonymous users
-- Drop only the policies we're replacing
DROP POLICY IF EXISTS "Enable users to create forms" ON "public"."forms";
DROP POLICY IF EXISTS "Enable users to view their own forms" ON "public"."forms";
DROP POLICY IF EXISTS "Enable users to update their own forms" ON "public"."forms";
DROP POLICY IF EXISTS "Enable users to delete their own forms" ON "public"."forms";

-- Authenticated users - standard access
CREATE POLICY "Authenticated users can create forms" 
ON "public"."forms" 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Anonymous users - with form limit check
CREATE POLICY "Anonymous users can create limited forms" 
ON "public"."forms" 
FOR INSERT 
TO anon
WITH CHECK (
  auth.uid() = user_id
  AND (
    SELECT COUNT(*) 
    FROM public.forms 
    WHERE user_id = auth.uid()
  ) < 3  -- Enforce 3 form limit for anonymous users
);

-- Both can view their own forms
CREATE POLICY "Users can view their own forms" 
ON "public"."forms" 
FOR SELECT 
TO authenticated, anon
USING (auth.uid() = user_id);

-- Both can update their own forms
CREATE POLICY "Users can update their own forms" 
ON "public"."forms" 
FOR UPDATE 
TO authenticated, anon
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Only authenticated users can delete (anonymous users shouldn't delete)
CREATE POLICY "Authenticated users can delete their own forms" 
ON "public"."forms" 
FOR DELETE 
TO authenticated
USING (auth.uid() = user_id);

-- 3. Messages table - Strict ownership checks
DROP POLICY IF EXISTS "Enable users to create messages" ON "public"."messages";
DROP POLICY IF EXISTS "Enable users to view messages for their forms" ON "public"."messages";

-- Users can only create messages for forms they own
CREATE POLICY "Users can create messages for their forms" 
ON "public"."messages" 
FOR INSERT 
TO authenticated, anon
WITH CHECK (
  auth.uid() = user_id 
  AND EXISTS (
    SELECT 1 FROM public.forms 
    WHERE id = form_id AND user_id = auth.uid()
  )
);

-- Users can only view messages for forms they own
CREATE POLICY "Users can view messages for their forms" 
ON "public"."messages" 
FOR SELECT 
TO authenticated, anon
USING (
  EXISTS (
    SELECT 1 FROM public.forms 
    WHERE id = form_id AND user_id = auth.uid()
  )
);

-- 4. Form submissions - Properly scoped access
DROP POLICY IF EXISTS "Enable form owners to view submissions" ON "public"."form_submissions";
DROP POLICY IF EXISTS "Enable public form submissions" ON "public"."form_submissions";
DROP POLICY IF EXISTS "Enable users to update own submissions" ON "public"."form_submissions";

-- Form owners can view all submissions to their forms
CREATE POLICY "Form owners can view submissions" 
ON "public"."form_submissions" 
FOR SELECT 
TO authenticated, anon
USING (
  EXISTS (
    SELECT 1 
    FROM public.form_versions fv
    JOIN public.forms f ON fv.form_id = f.id
    WHERE fv.version_id = form_version_id
    AND f.user_id = auth.uid()
  )
);

-- Public can submit to published forms only
CREATE POLICY "Public can submit to published forms" 
ON "public"."form_submissions" 
FOR INSERT 
TO authenticated, anon, public
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM public.form_versions fv
    WHERE fv.version_id = form_version_id
    AND fv.status = 'published'
  )
);

-- Users can view their own submissions
CREATE POLICY "Users can view own submissions"
ON "public"."form_submissions"
FOR SELECT
TO authenticated, anon
USING (user_id = auth.uid());

-- Users can update only their own incomplete submissions
CREATE POLICY "Users can update own incomplete submissions"
ON "public"."form_submissions"
FOR UPDATE
TO authenticated, anon
USING (user_id = auth.uid() AND status != 'completed')
WITH CHECK (user_id = auth.uid());

-- 5. Form answers - Strict access control
DROP POLICY IF EXISTS "Enable form owners to view answers" ON "public"."form_answers";
DROP POLICY IF EXISTS "Enable public to submit answers" ON "public"."form_answers";

-- Form owners can view all answers
CREATE POLICY "Form owners can view answers" 
ON "public"."form_answers" 
FOR SELECT 
TO authenticated, anon
USING (
  EXISTS (
    SELECT 1
    FROM public.form_submissions fs
    JOIN public.form_versions fv ON fs.form_version_id = fv.version_id
    JOIN public.forms f ON fv.form_id = f.id
    WHERE fs.submission_id = form_answers.submission_id
    AND f.user_id = auth.uid()
  )
);

-- Submission owners can view their own answers
CREATE POLICY "Submission owners can view own answers"
ON "public"."form_answers"
FOR SELECT
TO authenticated, anon
USING (
  EXISTS (
    SELECT 1
    FROM public.form_submissions fs
    WHERE fs.submission_id = form_answers.submission_id
    AND fs.user_id = auth.uid()
  )
);

-- Users can insert answers only for their own submissions
CREATE POLICY "Users can submit answers to own submissions"
ON "public"."form_answers"
FOR INSERT
TO authenticated, anon
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.form_submissions fs
    WHERE fs.submission_id = form_answers.submission_id
    AND (
      fs.user_id = auth.uid() 
      OR fs.user_id IS NULL  -- Allow anonymous submissions
    )
    AND fs.status != 'completed'  -- Can't add answers to completed submissions
  )
);

-- 6. Form versions - Maintain ownership chain
DROP POLICY IF EXISTS "Enable users to create form versions" ON "public"."form_versions";
DROP POLICY IF EXISTS "Enable users to view form versions" ON "public"."form_versions";
DROP POLICY IF EXISTS "Enable users to update form versions" ON "public"."form_versions";
DROP POLICY IF EXISTS "Enable users to delete form versions" ON "public"."form_versions";

-- Only form owners can manage versions
CREATE POLICY "Form owners can create versions" 
ON "public"."form_versions" 
FOR INSERT 
TO authenticated, anon
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.forms 
    WHERE id = form_id 
    AND user_id = auth.uid()
  )
);

CREATE POLICY "Form owners can view versions" 
ON "public"."form_versions" 
FOR SELECT 
TO authenticated, anon
USING (
  EXISTS (
    SELECT 1 FROM public.forms 
    WHERE id = form_id 
    AND user_id = auth.uid()
  )
);

CREATE POLICY "Form owners can update versions" 
ON "public"."form_versions" 
FOR UPDATE 
TO authenticated, anon
USING (
  EXISTS (
    SELECT 1 FROM public.forms 
    WHERE id = form_id 
    AND user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.forms 
    WHERE id = form_id 
    AND user_id = auth.uid()
  )
);

-- Only authenticated form owners can delete versions
CREATE POLICY "Authenticated form owners can delete versions" 
ON "public"."form_versions" 
FOR DELETE 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.forms 
    WHERE id = form_id 
    AND user_id = auth.uid()
  )
);

-- Add helpful comments
COMMENT ON POLICY "Anonymous users can create limited forms" ON "public"."forms" IS 
'Allows anonymous users to create up to 3 forms';

COMMENT ON POLICY "Public can submit to published forms" ON "public"."form_submissions" IS 
'Allows anyone to submit responses to published forms';