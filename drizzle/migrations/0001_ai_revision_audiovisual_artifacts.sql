CREATE TABLE public.ai_content_artifacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_id uuid NOT NULL REFERENCES public.ai_canonical_contents(id) ON DELETE CASCADE,
  slide_index integer NOT NULL CHECK (slide_index >= 0),
  artifact_type text NOT NULL CHECK (artifact_type IN ('audio', 'caption', 'image', 'cover', 'video')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'ready', 'failed')),
  storage_path text,
  public_url text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (canonical_id, slide_index, artifact_type)
);
GRANT SELECT ON public.ai_content_artifacts TO anon, authenticated;
GRANT ALL ON public.ai_content_artifacts TO service_role;
ALTER TABLE public.ai_content_artifacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Artefatos prontos de IA são públicos"
  ON public.ai_content_artifacts FOR SELECT TO anon, authenticated
  USING (status = 'ready');
CREATE POLICY "Administradores gerenciam artefatos de IA"
  ON public.ai_content_artifacts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE INDEX idx_ai_content_artifacts_canonical ON public.ai_content_artifacts (canonical_id, slide_index);
CREATE TRIGGER trg_ai_content_artifacts_updated BEFORE UPDATE ON public.ai_content_artifacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.ai_generation_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_id uuid NOT NULL REFERENCES public.ai_canonical_contents(id) ON DELETE CASCADE,
  job_type text NOT NULL CHECK (job_type IN ('audio', 'caption', 'image', 'cover', 'video')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'ready', 'failed')),
  progress integer NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  attempts integer NOT NULL DEFAULT 0,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ai_generation_jobs TO authenticated;
GRANT ALL ON public.ai_generation_jobs TO service_role;
ALTER TABLE public.ai_generation_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuário acompanha geração do próprio kit"
  ON public.ai_generation_jobs FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.ai_revision_requests r
      WHERE r.canonical_id = ai_generation_jobs.canonical_id
        AND r.user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );
CREATE POLICY "Administradores gerenciam gerações de IA"
  ON public.ai_generation_jobs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE INDEX idx_ai_generation_jobs_canonical ON public.ai_generation_jobs (canonical_id, status);
CREATE TRIGGER trg_ai_generation_jobs_updated BEFORE UPDATE ON public.ai_generation_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();