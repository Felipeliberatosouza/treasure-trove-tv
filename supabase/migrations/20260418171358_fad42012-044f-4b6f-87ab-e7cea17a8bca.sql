
INSERT INTO storage.buckets (id, name, public)
VALUES ('cancellation-receipts', 'cancellation-receipts', false)
ON CONFLICT (id) DO NOTHING;

-- Owner can read their own receipts (path prefix = user_id)
CREATE POLICY "Users can read their own cancellation receipts"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'cancellation-receipts'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Admins can read all receipts
CREATE POLICY "Admins can read all cancellation receipts"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'cancellation-receipts'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);
