CREATE TABLE public.curated_lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_key text NOT NULL,
  title text NOT NULL,
  summary text,
  script text NOT NULL,
  sources text,
  audio_path text,
  published boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.curated_lessons TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.curated_lessons TO authenticated;
GRANT ALL ON public.curated_lessons TO service_role;
ALTER TABLE public.curated_lessons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Publicados visiveis" ON public.curated_lessons FOR SELECT TO anon, authenticated USING (published OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin insere" ON public.curated_lessons FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin altera" ON public.curated_lessons FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin exclui" ON public.curated_lessons FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX curated_lessons_product_idx ON public.curated_lessons(product_key, created_at DESC);

CREATE POLICY "Curated audio leitura" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'curated-audio');
CREATE POLICY "Curated audio admin insere" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'curated-audio' AND public.has_role(auth.uid(), 'admin') AND lower(storage.extension(name)) IN ('mp3','m4a','wav','ogg','webm'));
CREATE POLICY "Curated audio admin altera" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'curated-audio' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Curated audio admin exclui" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'curated-audio' AND public.has_role(auth.uid(), 'admin'));