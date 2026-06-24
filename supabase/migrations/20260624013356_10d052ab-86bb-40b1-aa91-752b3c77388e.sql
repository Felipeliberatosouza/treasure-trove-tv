
CREATE OR REPLACE FUNCTION public.sync_free_trials_with_settings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cfg jsonb := NEW.value;
  cfg_type text;
  cfg_days integer;
  cfg_videos integer;
BEGIN
  IF NEW.key <> 'free_trial' THEN
    RETURN NEW;
  END IF;

  cfg_type := CASE WHEN cfg ->> 'trial_type' IN ('days','videos') THEN cfg ->> 'trial_type' ELSE 'days' END;
  cfg_days := LEAST(GREATEST(COALESCE((cfg ->> 'trial_days')::integer, 7), 1), 30);
  cfg_videos := LEAST(GREATEST(COALESCE((cfg ->> 'trial_videos')::integer, 5), 1), 50);

  UPDATE public.free_trials
     SET trial_days   = cfg_days,
         trial_videos = cfg_videos,
         active = CASE
           WHEN trial_type = 'videos' AND videos_watched >= cfg_videos THEN false
           WHEN trial_type = 'days'   AND started_at + make_interval(days => cfg_days) <= now() THEN false
           ELSE active
         END,
         updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_free_trials_with_settings ON public.platform_settings;
CREATE TRIGGER trg_sync_free_trials_with_settings
AFTER INSERT OR UPDATE ON public.platform_settings
FOR EACH ROW
WHEN (NEW.key = 'free_trial')
EXECUTE FUNCTION public.sync_free_trials_with_settings();

-- Allow admins to reset a user's free trial via a security-definer RPC
CREATE OR REPLACE FUNCTION public.admin_reset_free_trial(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Apenas administradores podem liberar o teste grátis.';
  END IF;
  DELETE FROM public.free_trials WHERE user_id = _user_id;
  RETURN true;
END;
$$;
