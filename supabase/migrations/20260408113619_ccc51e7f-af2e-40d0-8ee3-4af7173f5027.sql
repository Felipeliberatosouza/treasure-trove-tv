
-- Create public bucket for platform assets (logo, banner images)
INSERT INTO storage.buckets (id, name, public)
VALUES ('platform-assets', 'platform-assets', true);

-- Anyone can view platform assets
CREATE POLICY "Anyone can view platform assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'platform-assets');

-- Only admins can upload platform assets
CREATE POLICY "Admins can upload platform assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'platform-assets' AND public.has_role(auth.uid(), 'admin'));

-- Only admins can update platform assets
CREATE POLICY "Admins can update platform assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'platform-assets' AND public.has_role(auth.uid(), 'admin'));

-- Only admins can delete platform assets
CREATE POLICY "Admins can delete platform assets"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'platform-assets' AND public.has_role(auth.uid(), 'admin'));
