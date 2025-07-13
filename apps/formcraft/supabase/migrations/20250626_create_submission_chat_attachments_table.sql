-- Create table for form submission file attachments
CREATE TABLE IF NOT EXISTS public.submission_chat_attachments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  submission_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  file_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  
  -- Add foreign key constraint
  CONSTRAINT submission_chat_attachments_submission_id_fkey 
    FOREIGN KEY (submission_id) 
    REFERENCES public.form_submissions(submission_id) 
    ON DELETE CASCADE
);

-- Create indexes
CREATE INDEX idx_submission_chat_attachments_submission_id ON public.submission_chat_attachments(submission_id);
CREATE INDEX idx_submission_chat_attachments_created_at ON public.submission_chat_attachments(created_at);

-- Enable RLS
ALTER TABLE public.submission_chat_attachments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Allow authenticated users to insert attachments
CREATE POLICY "Authenticated users can insert attachments" 
ON public.submission_chat_attachments 
FOR INSERT 
TO authenticated
WITH CHECK (true);

-- Allow users to view attachments for their submissions
CREATE POLICY "Users can view own submission attachments" 
ON public.submission_chat_attachments 
FOR SELECT 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.form_submissions 
    WHERE submission_id = submission_chat_attachments.submission_id
  )
);

-- Allow form owners to view all attachments for their forms
CREATE POLICY "Form owners can view attachments" 
ON public.submission_chat_attachments 
FOR SELECT 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.form_submissions fs
    JOIN public.forms f ON fs.form_id = f.id
    WHERE fs.submission_id = submission_chat_attachments.submission_id
    AND f.user_id = auth.uid()
  )
);