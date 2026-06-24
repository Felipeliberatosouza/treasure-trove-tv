REVOKE ALL ON public.free_trials FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.free_trials FROM authenticated;
GRANT SELECT ON public.free_trials TO authenticated;
GRANT ALL ON public.free_trials TO service_role;