CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION public.run_platform_maintenance()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE b int := 0; l int := 0; res jsonb;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  DELETE FROM public.beta_bug_reports
   WHERE origin = 'automatico' AND status IN ('resolvido','descartado')
     AND coalesce(last_seen_at, created_at) < now() - interval '30 days';
  GET DIAGNOSTICS b = ROW_COUNT;
  DELETE FROM public.login_attempts WHERE attempted_at < now() - interval '90 days';
  GET DIAGNOSTICS l = ROW_COUNT;
  res := jsonb_build_object('last_run_at', now(), 'beta_reports_removed', b, 'login_attempts_removed', l);
  INSERT INTO public.platform_settings (key, value) VALUES ('maintenance_status', res)
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
  RETURN res;
END $$;

REVOKE ALL ON FUNCTION public.run_platform_maintenance() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.run_platform_maintenance() TO authenticated;

SELECT cron.schedule('rf-daily-maintenance', '0 6 * * *', $$SELECT public.run_platform_maintenance();$$);