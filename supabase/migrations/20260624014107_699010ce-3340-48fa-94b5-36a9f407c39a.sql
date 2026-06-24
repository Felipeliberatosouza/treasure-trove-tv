
CREATE OR REPLACE FUNCTION public.is_content_teacher(_user_id uuid, _content_type text, _content_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN _content_type = 'lesson' THEN EXISTS (
      SELECT 1 FROM public.lessons WHERE id = _content_id AND teacher_id = _user_id
    )
    WHEN _content_type = 'exam_solution' THEN EXISTS (
      SELECT 1 FROM public.exam_solutions WHERE id = _content_id AND teacher_id = _user_id
    )
    ELSE false
  END;
$$;

CREATE POLICY "Teachers can view ratings on own content"
ON public.video_ratings
FOR SELECT
TO authenticated
USING (public.is_content_teacher(auth.uid(), content_type, content_id));
