-- Create storage bucket for form submission file uploads
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'form-submissions-uploads', 
  'form-submissions-uploads', 
  true, 
  10485760, -- 10MB limit
  ARRAY[
    'image/jpeg',
    'image/png', 
    'image/gif',
    'image/webp',
    'application/pdf',
    'text/plain',
    'text/csv',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for the bucket
CREATE POLICY "Allow authenticated uploads" ON storage.objects 
  FOR INSERT TO authenticated 
  WITH CHECK (bucket_id = 'form-submissions-uploads');

CREATE POLICY "Allow public read access" ON storage.objects 
  FOR SELECT TO public 
  USING (bucket_id = 'form-submissions-uploads');

CREATE POLICY "Allow users to delete own uploads" ON storage.objects 
  FOR DELETE TO authenticated 
  USING (bucket_id = 'form-submissions-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);