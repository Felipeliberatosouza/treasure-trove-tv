-- ============================================================
-- Hardening: bloquear leitura de conteúdo protegido para usuários
-- atualmente sob suspensão (user_blocks). Aplica-se a SELECT.
-- Admins e dono (teacher) continuam vendo. Anônimos não são afetados
-- porque is_user_blocked(NULL) retorna false.
-- ============================================================

-- ---------- lessons ----------
DROP POLICY IF EXISTS "Anyone authenticated can view approved published lessons" ON public.lessons;
CREATE POLICY "Anyone authenticated can view approved published lessons"
  ON public.lessons
  FOR SELECT
  TO authenticated
  USING (
    (
      ((published = true) AND (admin_approved = true))
      OR (teacher_id = auth.uid())
      OR public.has_role(auth.uid(), 'admin'::app_role)
    )
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR (teacher_id = auth.uid())
      OR NOT public.is_user_blocked(auth.uid())
    )
  );

-- ---------- exam_solutions ----------
DROP POLICY IF EXISTS "Anyone authenticated can view approved published exam_solutions" ON public.exam_solutions;
CREATE POLICY "Anyone authenticated can view approved published exam_solutions"
  ON public.exam_solutions
  FOR SELECT
  TO authenticated
  USING (
    (
      ((published = true) AND (admin_approved = true))
      OR (teacher_id = auth.uid())
      OR public.has_role(auth.uid(), 'admin'::app_role)
    )
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR (teacher_id = auth.uid())
      OR NOT public.is_user_blocked(auth.uid())
    )
  );

-- ---------- lesson_summaries ----------
DROP POLICY IF EXISTS "View summaries of approved lessons or own" ON public.lesson_summaries;
CREATE POLICY "View summaries of approved lessons or own"
  ON public.lesson_summaries
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.lessons l
      WHERE l.id = lesson_summaries.lesson_id
        AND (
          ((l.published = true) AND (l.admin_approved = true))
          OR (l.teacher_id = auth.uid())
          OR public.has_role(auth.uid(), 'admin'::app_role)
        )
        AND (
          public.has_role(auth.uid(), 'admin'::app_role)
          OR (l.teacher_id = auth.uid())
          OR NOT public.is_user_blocked(auth.uid())
        )
    )
  );

-- ---------- lesson_quiz_questions ----------
DROP POLICY IF EXISTS "View quiz questions of approved lessons or own" ON public.lesson_quiz_questions;
CREATE POLICY "View quiz questions of approved lessons or own"
  ON public.lesson_quiz_questions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.lessons l
      WHERE l.id = lesson_quiz_questions.lesson_id
        AND (
          ((l.published = true) AND (l.admin_approved = true))
          OR (l.teacher_id = auth.uid())
          OR public.has_role(auth.uid(), 'admin'::app_role)
        )
        AND (
          public.has_role(auth.uid(), 'admin'::app_role)
          OR (l.teacher_id = auth.uid())
          OR NOT public.is_user_blocked(auth.uid())
        )
    )
  );

-- ---------- lesson_top_questions ----------
DROP POLICY IF EXISTS "View top questions of approved lessons or own" ON public.lesson_top_questions;
CREATE POLICY "View top questions of approved lessons or own"
  ON public.lesson_top_questions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.lessons l
      WHERE l.id = lesson_top_questions.lesson_id
        AND (
          ((l.published = true) AND (l.admin_approved = true))
          OR (l.teacher_id = auth.uid())
          OR public.has_role(auth.uid(), 'admin'::app_role)
        )
        AND (
          public.has_role(auth.uid(), 'admin'::app_role)
          OR (l.teacher_id = auth.uid())
          OR NOT public.is_user_blocked(auth.uid())
        )
    )
  );

-- ---------- lesson_cheatsheet_items ----------
DROP POLICY IF EXISTS "View cheatsheet items of approved lessons or own" ON public.lesson_cheatsheet_items;
CREATE POLICY "View cheatsheet items of approved lessons or own"
  ON public.lesson_cheatsheet_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.lessons l
      WHERE l.id = lesson_cheatsheet_items.lesson_id
        AND (
          ((l.published = true) AND (l.admin_approved = true))
          OR (l.teacher_id = auth.uid())
          OR public.has_role(auth.uid(), 'admin'::app_role)
        )
        AND (
          public.has_role(auth.uid(), 'admin'::app_role)
          OR (l.teacher_id = auth.uid())
          OR NOT public.is_user_blocked(auth.uid())
        )
    )
  );

-- ---------- lesson_material_meta ----------
DROP POLICY IF EXISTS "View material meta of approved lessons or own" ON public.lesson_material_meta;
CREATE POLICY "View material meta of approved lessons or own"
  ON public.lesson_material_meta
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.lessons l
      WHERE l.id = lesson_material_meta.lesson_id
        AND (
          ((l.published = true) AND (l.admin_approved = true))
          OR (l.teacher_id = auth.uid())
          OR public.has_role(auth.uid(), 'admin'::app_role)
        )
        AND (
          public.has_role(auth.uid(), 'admin'::app_role)
          OR (l.teacher_id = auth.uid())
          OR NOT public.is_user_blocked(auth.uid())
        )
    )
  );