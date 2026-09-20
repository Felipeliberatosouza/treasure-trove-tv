CREATE OR REPLACE FUNCTION public.is_contact_registered(_email text, _phone text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE (
      _email IS NOT NULL AND _email <> '' AND lower(p.email) = lower(_email)
    ) OR (
      _phone IS NOT NULL AND length(_phone) >= 10
      AND regexp_replace(COALESCE(p.phone, ''), '\D', '', 'g') = _phone
    )
  );
$$;

REVOKE ALL ON FUNCTION public.is_contact_registered(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_contact_registered(text, text) TO service_role;