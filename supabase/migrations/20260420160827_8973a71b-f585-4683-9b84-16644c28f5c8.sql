-- ============================================================
-- Lesson Materials: structured complementary materials
-- ============================================================

-- Per-material meta (price + offered flag) for each lesson + material type
CREATE TABLE public.lesson_material_meta (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  material_type TEXT NOT NULL CHECK (material_type IN ('resumo', 'simulado', 'top_questoes', 'colinha')),
  offered BOOLEAN NOT NULL DEFAULT true,
  price NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (lesson_id, material_type)
);

-- Resumo: text content
CREATE TABLE public.lesson_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL UNIQUE REFERENCES public.lessons(id) ON DELETE CASCADE,
  content TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Simulado: multiple-choice questions
CREATE TABLE public.lesson_quiz_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  question TEXT NOT NULL,
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  correct_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_lesson_quiz_questions_lesson ON public.lesson_quiz_questions(lesson_id, position);

-- Top Questões: open questions with text answer
CREATE TABLE public.lesson_top_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_lesson_top_questions_lesson ON public.lesson_top_questions(lesson_id, position);

-- Colinha: bullet points
CREATE TABLE public.lesson_cheatsheet_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_lesson_cheatsheet_items_lesson ON public.lesson_cheatsheet_items(lesson_id, position);

-- ============================================================
-- Enable RLS
-- ============================================================
ALTER TABLE public.lesson_material_meta ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_top_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_cheatsheet_items ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Helper: check if a lesson belongs to the current teacher
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_lesson_owner(_user_id UUID, _lesson_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.lessons WHERE id = _lesson_id AND teacher_id = _user_id
  )
$$;

-- ============================================================
-- RLS policies (apply same pattern to each materials table)
-- ============================================================

-- lesson_material_meta
CREATE POLICY "View material meta of approved lessons or own"
  ON public.lesson_material_meta FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.lessons l
      WHERE l.id = lesson_material_meta.lesson_id
        AND ((l.published = true AND l.admin_approved = true) OR l.teacher_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
    )
  );
CREATE POLICY "Teachers manage material meta of own lessons"
  ON public.lesson_material_meta FOR ALL
  USING (public.is_lesson_owner(auth.uid(), lesson_id))
  WITH CHECK (public.is_lesson_owner(auth.uid(), lesson_id));
CREATE POLICY "Admins manage all material meta"
  ON public.lesson_material_meta FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- lesson_summaries
CREATE POLICY "View summaries of approved lessons or own"
  ON public.lesson_summaries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.lessons l
      WHERE l.id = lesson_summaries.lesson_id
        AND ((l.published = true AND l.admin_approved = true) OR l.teacher_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
    )
  );
CREATE POLICY "Teachers manage summaries of own lessons"
  ON public.lesson_summaries FOR ALL
  USING (public.is_lesson_owner(auth.uid(), lesson_id))
  WITH CHECK (public.is_lesson_owner(auth.uid(), lesson_id));
CREATE POLICY "Admins manage all summaries"
  ON public.lesson_summaries FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- lesson_quiz_questions
CREATE POLICY "View quiz questions of approved lessons or own"
  ON public.lesson_quiz_questions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.lessons l
      WHERE l.id = lesson_quiz_questions.lesson_id
        AND ((l.published = true AND l.admin_approved = true) OR l.teacher_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
    )
  );
CREATE POLICY "Teachers manage quiz questions of own lessons"
  ON public.lesson_quiz_questions FOR ALL
  USING (public.is_lesson_owner(auth.uid(), lesson_id))
  WITH CHECK (public.is_lesson_owner(auth.uid(), lesson_id));
CREATE POLICY "Admins manage all quiz questions"
  ON public.lesson_quiz_questions FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- lesson_top_questions
CREATE POLICY "View top questions of approved lessons or own"
  ON public.lesson_top_questions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.lessons l
      WHERE l.id = lesson_top_questions.lesson_id
        AND ((l.published = true AND l.admin_approved = true) OR l.teacher_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
    )
  );
CREATE POLICY "Teachers manage top questions of own lessons"
  ON public.lesson_top_questions FOR ALL
  USING (public.is_lesson_owner(auth.uid(), lesson_id))
  WITH CHECK (public.is_lesson_owner(auth.uid(), lesson_id));
CREATE POLICY "Admins manage all top questions"
  ON public.lesson_top_questions FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- lesson_cheatsheet_items
CREATE POLICY "View cheatsheet items of approved lessons or own"
  ON public.lesson_cheatsheet_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.lessons l
      WHERE l.id = lesson_cheatsheet_items.lesson_id
        AND ((l.published = true AND l.admin_approved = true) OR l.teacher_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
    )
  );
CREATE POLICY "Teachers manage cheatsheet items of own lessons"
  ON public.lesson_cheatsheet_items FOR ALL
  USING (public.is_lesson_owner(auth.uid(), lesson_id))
  WITH CHECK (public.is_lesson_owner(auth.uid(), lesson_id));
CREATE POLICY "Admins manage all cheatsheet items"
  ON public.lesson_cheatsheet_items FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ============================================================
-- updated_at triggers
-- ============================================================
CREATE TRIGGER trg_lesson_material_meta_updated_at
  BEFORE UPDATE ON public.lesson_material_meta
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_lesson_summaries_updated_at
  BEFORE UPDATE ON public.lesson_summaries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_lesson_quiz_questions_updated_at
  BEFORE UPDATE ON public.lesson_quiz_questions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_lesson_top_questions_updated_at
  BEFORE UPDATE ON public.lesson_top_questions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();