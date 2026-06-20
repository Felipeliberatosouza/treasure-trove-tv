-- Harden audit logs: users must not write arbitrary audit records directly
DROP POLICY IF EXISTS "Authenticated can insert own audit logs" ON public.audit_logs;

-- Harden free trial creation/update: users must not self-insert or manipulate trial rows directly
DROP POLICY IF EXISTS "Users can create own trial" ON public.free_trials;
DROP POLICY IF EXISTS "Users can update own trial" ON public.free_trials;

CREATE OR REPLACE FUNCTION public.start_free_trial()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  uid uuid := auth.uid();
  cfg jsonb;
  cfg_enabled boolean;
  cfg_type text;
  cfg_days integer;
  cfg_videos integer;
BEGIN
  IF uid IS NULL THEN
    RETURN false;
  END IF;

  IF EXISTS (SELECT 1 FROM public.free_trials WHERE user_id = uid) THEN
    RETURN false;
  END IF;

  SELECT value INTO cfg
  FROM public.platform_settings
  WHERE key = 'free_trial'
  LIMIT 1;

  cfg_enabled := COALESCE((cfg ->> 'enabled')::boolean, false);
  IF NOT cfg_enabled THEN
    RETURN false;
  END IF;

  cfg_type := CASE WHEN cfg ->> 'trial_type' IN ('days', 'videos') THEN cfg ->> 'trial_type' ELSE 'days' END;
  cfg_days := LEAST(GREATEST(COALESCE((cfg ->> 'trial_days')::integer, 7), 1), 30);
  cfg_videos := LEAST(GREATEST(COALESCE((cfg ->> 'trial_videos')::integer, 5), 1), 50);

  INSERT INTO public.free_trials (
    user_id,
    trial_type,
    trial_days,
    trial_videos,
    videos_watched,
    active,
    started_at
  ) VALUES (
    uid,
    cfg_type,
    cfg_days,
    cfg_videos,
    0,
    true,
    now()
  );

  RETURN true;
EXCEPTION
  WHEN unique_violation THEN
    RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.start_free_trial() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.start_free_trial() TO authenticated;

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
  SET videos_watched = videos_watched + 1,
      updated_at = now()
  WHERE user_id = uid
    AND active = true;

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.record_free_trial_content_access() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_free_trial_content_access() TO authenticated;

-- Harden phone OTP storage and access: no raw codes returned from the table
ALTER TABLE public.phone_verifications ADD COLUMN IF NOT EXISTS code_hash text;

UPDATE public.phone_verifications
SET code_hash = encode(digest(phone || ':' || code, 'sha256'), 'hex')
WHERE code_hash IS NULL
  AND code IS NOT NULL;

UPDATE public.phone_verifications
SET code = '[redigido]'
WHERE code IS NOT NULL
  AND code <> '[redigido]';

ALTER TABLE public.phone_verifications ALTER COLUMN code SET DEFAULT '[redigido]';
ALTER TABLE public.phone_verifications ALTER COLUMN code_hash SET NOT NULL;

DROP POLICY IF EXISTS "Users can view own verifications" ON public.phone_verifications;
DROP POLICY IF EXISTS "Users can create own verifications" ON public.phone_verifications;
DROP POLICY IF EXISTS "Users can update own verifications" ON public.phone_verifications;
DROP POLICY IF EXISTS "Anon can create phone verifications" ON public.phone_verifications;