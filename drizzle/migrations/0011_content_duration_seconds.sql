ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS duration_seconds integer;
ALTER TABLE public.exam_solutions ADD COLUMN IF NOT EXISTS duration_seconds integer;

CREATE OR REPLACE FUNCTION public.set_content_duration(_content_type text, _content_id uuid, _seconds integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF _seconds IS NULL OR _seconds <= 0 OR _seconds > 60*60*12 THEN
    RETURN false;
  END IF;

  IF _content_type = 'lesson' THEN
    UPDATE public.lessons
       SET duration_seconds = _seconds
     WHERE id = _content_id
       AND (duration_seconds IS NULL OR duration_seconds <= 0);
  ELSIF _content_type = 'exam_solution' THEN
    UPDATE public.exam_solutions
       SET duration_seconds = _seconds
     WHERE id = _content_id
       AND (duration_seconds IS NULL OR duration_seconds <= 0);
  ELSE
    RETURN false;
  END IF;

  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_content_duration(text, uuid, integer) TO anon, authenticated, service_role;