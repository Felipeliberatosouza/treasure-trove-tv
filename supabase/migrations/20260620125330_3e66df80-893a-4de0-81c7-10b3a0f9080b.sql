REVOKE EXECUTE ON FUNCTION public.start_free_trial() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.start_free_trial() FROM anon;
REVOKE EXECUTE ON FUNCTION public.record_free_trial_content_access() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.record_free_trial_content_access() FROM anon;
GRANT EXECUTE ON FUNCTION public.start_free_trial() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_free_trial_content_access() TO authenticated, service_role;