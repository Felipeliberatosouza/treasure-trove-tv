ALTER TABLE public.real_exams
  ADD COLUMN IF NOT EXISTS exam_number text,
  ADD COLUMN IF NOT EXISTS applied_on date,
  ADD COLUMN IF NOT EXISTS area text,
  ADD COLUMN IF NOT EXISTS institution text,
  ADD COLUMN IF NOT EXISTS cargo text,
  ADD COLUMN IF NOT EXISTS disciplina text;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS selector_options jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS simulado_config jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.work_documents
  ADD COLUMN IF NOT EXISTS layout_theme text,
  ADD COLUMN IF NOT EXISTS presentation_extras jsonb;

CREATE TABLE public.exam_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  exam_id uuid NOT NULL REFERENCES public.real_exams(id) ON DELETE CASCADE,
  product_key text NOT NULL,
  area text,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  score integer,
  total integer,
  duration_min integer,
  essay_text text,
  essay_result jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exam_attempts TO authenticated;
GRANT ALL ON public.exam_attempts TO service_role;
ALTER TABLE public.exam_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own attempts select" ON public.exam_attempts FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "own attempts insert" ON public.exam_attempts FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own attempts update" ON public.exam_attempts FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own attempts delete" ON public.exam_attempts FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE INDEX exam_attempts_user_idx ON public.exam_attempts(user_id, started_at DESC);