CREATE OR REPLACE FUNCTION public.sync_free_trials_with_settings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
         updated_at = now()
   WHERE user_id IS NOT NULL;

  RETURN NEW;
END;
$function$;