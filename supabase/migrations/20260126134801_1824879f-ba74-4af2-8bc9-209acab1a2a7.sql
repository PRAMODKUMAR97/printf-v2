-- Create storage policies for the print-files bucket
-- Allow anyone to upload files to the jobs folder (for print job uploads)
CREATE POLICY "Allow public uploads to print-files"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'print-files');

-- Allow anyone to read files from print-files (needed for previews with signed URLs)
CREATE POLICY "Allow public read from print-files"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'print-files');

-- Allow anyone to update their uploaded files
CREATE POLICY "Allow public update in print-files"
ON storage.objects FOR UPDATE
TO anon, authenticated
USING (bucket_id = 'print-files')
WITH CHECK (bucket_id = 'print-files');

-- Allow anyone to delete files (for cleanup)
CREATE POLICY "Allow public delete in print-files"
ON storage.objects FOR DELETE
TO anon, authenticated
USING (bucket_id = 'print-files');