
CREATE OR REPLACE FUNCTION public.is_email_taken(_email text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE lower(email) = lower(trim(COALESCE(_email, '')))
      AND length(trim(COALESCE(_email, ''))) > 0
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_email_taken(text) TO anon, authenticated;
