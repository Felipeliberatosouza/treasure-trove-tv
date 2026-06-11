CREATE OR REPLACE FUNCTION public.can_access_lesson_material(_lesson_id uuid, _material_type text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uid uuid := auth.uid();
  normalized_type text;
  lesson_row record;
BEGIN
  IF uid IS NULL OR _lesson_id IS NULL OR _material_type IS NULL THEN
    RETURN false;
  END IF;

  normalized_type := CASE
    WHEN _material_type = 'colinhas' THEN 'colinha'
    ELSE _material_type
  END;

  IF normalized_type NOT IN ('resumo', 'simulado', 'top_questoes', 'colinha') THEN
    RETURN false;
  END IF;

  IF public.has_role(uid, 'admin'::public.app_role) THEN
    RETURN true;
  END IF;

  SELECT id, teacher_id, published, admin_approved
    INTO lesson_row
  FROM public.lessons
  WHERE id = _lesson_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF lesson_row.teacher_id = uid THEN
    RETURN true;
  END IF;

  IF COALESCE(lesson_row.published, false) IS NOT TRUE
     OR COALESCE(lesson_row.admin_approved, false) IS NOT TRUE THEN
    RETURN false;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.lesson_material_meta m
    WHERE m.lesson_id = _lesson_id
      AND m.material_type = normalized_type
      AND m.offered = true
      AND m.admin_approved = true
  ) THEN
    RETURN false;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.student_subscriptions ss
    JOIN public.subscription_plans sp ON sp.id = ss.plan_id
    WHERE ss.user_id = uid
      AND ss.status = 'active'
      AND (ss.expires_at IS NULL OR ss.expires_at > now())
      AND CASE normalized_type
        WHEN 'resumo' THEN COALESCE(sp.service_resumos, false)
        WHEN 'simulado' THEN COALESCE(sp.service_simulados, false)
        WHEN 'top_questoes' THEN COALESCE(sp.service_top_questoes, false)
        WHEN 'colinha' THEN COALESCE(sp.service_colinhas, false)
        ELSE false
      END
  ) THEN
    RETURN true;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.video_purchases vp
    WHERE vp.user_id = uid
      AND vp.content_type = 'lesson'
      AND vp.content_id = _lesson_id
      AND vp.payment_status = 'completed'
  ) THEN
    RETURN true;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.free_trials ft
    WHERE ft.user_id = uid
      AND ft.active = true
      AND (
        (ft.trial_type = 'days' AND ft.started_at + make_interval(days => ft.trial_days) > now())
        OR (ft.trial_type = 'videos' AND ft.videos_watched < ft.trial_videos)
      )
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

DROP POLICY IF EXISTS "View summaries of approved lessons or own" ON public.lesson_summaries;
CREATE POLICY "Authorized users view summaries"
  ON public.lesson_summaries
  FOR SELECT
  TO authenticated
  USING (public.can_access_lesson_material(lesson_id, 'resumo'));

DROP POLICY IF EXISTS "View quiz questions of approved lessons or own" ON public.lesson_quiz_questions;
CREATE POLICY "Authorized users view quiz questions"
  ON public.lesson_quiz_questions
  FOR SELECT
  TO authenticated
  USING (public.can_access_lesson_material(lesson_id, 'simulado'));

DROP POLICY IF EXISTS "View top questions of approved lessons or own" ON public.lesson_top_questions;
CREATE POLICY "Authorized users view top questions"
  ON public.lesson_top_questions
  FOR SELECT
  TO authenticated
  USING (public.can_access_lesson_material(lesson_id, 'top_questoes'));

DROP POLICY IF EXISTS "View cheatsheet items of approved lessons or own" ON public.lesson_cheatsheet_items;
CREATE POLICY "Authorized users view cheatsheet items"
  ON public.lesson_cheatsheet_items
  FOR SELECT
  TO authenticated
  USING (public.can_access_lesson_material(lesson_id, 'colinha'));

DROP POLICY IF EXISTS "Anyone can view materials" ON storage.objects;