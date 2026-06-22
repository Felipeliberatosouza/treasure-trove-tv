CREATE OR REPLACE FUNCTION public.is_login_blocked(check_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*) >= 3
  FROM public.login_attempts
  WHERE email = lower(check_email)
    AND success = false
    AND attempted_at > (now() - interval '15 minutes')
$$;