INSERT INTO storage.buckets (id, name, public)
VALUES ('report-pdfs', 'report-pdfs', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload report PDFs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'report-pdfs');

CREATE POLICY "Public can read report PDFs"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'report-pdfs');