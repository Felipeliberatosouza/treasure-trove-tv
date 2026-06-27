CREATE OR REPLACE FUNCTION public.is_cpf_taken(_cpf text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE cpf IS NOT NULL
      AND regexp_replace(cpf, '\D', '', 'g') = regexp_replace(COALESCE(_cpf, ''), '\D', '', 'g')
      AND length(regexp_replace(COALESCE(_cpf, ''), '\D', '', 'g')) = 11
  );
$$;

REVOKE ALL ON FUNCTION public.is_cpf_taken(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_cpf_taken(text) TO anon, authenticated;