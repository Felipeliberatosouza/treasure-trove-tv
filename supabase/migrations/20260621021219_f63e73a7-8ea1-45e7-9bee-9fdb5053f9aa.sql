ALTER VIEW public.teacher_profiles_public SET (security_invoker = false);
GRANT SELECT ON public.teacher_profiles_public TO anon, authenticated;