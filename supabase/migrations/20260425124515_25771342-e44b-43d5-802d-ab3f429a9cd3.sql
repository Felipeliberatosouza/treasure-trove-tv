CREATE OR REPLACE FUNCTION public.get_teacher_monthly_target(_teacher_id uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  override_val integer;
  default_val integer;
BEGIN
  SELECT monthly_package_target
  INTO override_val
  FROM public.teacher_monthly_targets
  WHERE teacher_id = _teacher_id;

  IF override_val IS NOT NULL THEN
    RETURN override_val;
  END IF;

  SELECT COALESCE(
    NULLIF(
      COALESCE((value #>> '{content_goals,revisoes}')::integer, 0) +
      COALESCE((value #>> '{content_goals,resolucoes}')::integer, 0),
      0
    ),
    COALESCE((value->>'monthly_goal')::integer, 4),
    4
  )
  INTO default_val
  FROM public.platform_settings
  WHERE key = 'teacher_content_goal';

  RETURN COALESCE(default_val, 4);
END;
$$;