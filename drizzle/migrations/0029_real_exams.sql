CREATE TABLE public.real_exams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_key text NOT NULL CHECK (product_key IN ('enem','vestibulares','oab','concursos')),
  year int NOT NULL,
  title text NOT NULL,
  board text,
  phase text,
  pdf_url text,
  answer_key_url text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.real_exam_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id uuid NOT NULL REFERENCES public.real_exams(id) ON DELETE CASCADE,
  number int NOT NULL,
  subject text,
  topic text,
  statement text NOT NULL,
  image_url text,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  correct text,
  explanation text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (exam_id, number)
);
CREATE INDEX real_exams_product_year_idx ON public.real_exams(product_key, year DESC);
CREATE INDEX real_exam_questions_exam_idx ON public.real_exam_questions(exam_id, number);
CREATE INDEX real_exam_questions_subject_idx ON public.real_exam_questions(exam_id, subject);
GRANT SELECT ON public.real_exams, public.real_exam_questions TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.real_exams, public.real_exam_questions TO authenticated;
GRANT ALL ON public.real_exams, public.real_exam_questions TO service_role;
ALTER TABLE public.real_exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.real_exam_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Provas ativas públicas" ON public.real_exams FOR SELECT USING (active OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admin gerencia provas" ON public.real_exams FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Questões de provas ativas" ON public.real_exam_questions FOR SELECT USING (EXISTS (SELECT 1 FROM public.real_exams e WHERE e.id = exam_id AND (e.active OR public.has_role(auth.uid(),'admin'))));
CREATE POLICY "Admin gerencia questões" ON public.real_exam_questions FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER real_exams_updated BEFORE UPDATE ON public.real_exams FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();