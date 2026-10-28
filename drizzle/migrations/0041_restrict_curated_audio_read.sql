DROP POLICY IF EXISTS "Curated audio leitura" ON storage.objects;
CREATE POLICY "Curated audio leitura" ON storage.objects FOR SELECT TO anon, authenticated
USING (
  bucket_id = 'curated-audio' AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (SELECT 1 FROM public.curated_lessons c WHERE c.audio_path = storage.objects.name AND c.published = true)
  )
);