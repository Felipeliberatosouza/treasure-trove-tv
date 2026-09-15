CREATE POLICY "Administradores leem mídias de revisão por IA"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'ai-revision-media'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY "Administradores gerenciam mídias de revisão por IA"
ON storage.objects FOR ALL TO authenticated
USING (
  bucket_id = 'ai-revision-media'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
)
WITH CHECK (
  bucket_id = 'ai-revision-media'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);