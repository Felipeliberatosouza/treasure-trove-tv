GRANT SELECT ON public.free_trials TO authenticated;
GRANT ALL ON public.free_trials TO service_role;

CREATE OR REPLACE FUNCTION public.record_free_trial_content_access()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RETURN false;
  END IF;

  UPDATE public.free_trials
  SET videos_watched = CASE
        WHEN trial_type = 'videos' THEN videos_watched + 1
        ELSE videos_watched
      END,
      active = CASE
        WHEN trial_type = 'videos' AND videos_watched + 1 >= trial_videos THEN false
        WHEN trial_type = 'days' AND started_at + make_interval(days => trial_days) <= now() THEN false
        ELSE active
      END,
      updated_at = now()
  WHERE user_id = uid
    AND active = true
    AND (
      (trial_type = 'videos' AND videos_watched < trial_videos)
      OR
      (trial_type = 'days' AND started_at + make_interval(days => trial_days) > now())
    );

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.record_free_trial_content_access() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.record_free_trial_content_access() FROM anon;
GRANT EXECUTE ON FUNCTION public.record_free_trial_content_access() TO authenticated, service_role;