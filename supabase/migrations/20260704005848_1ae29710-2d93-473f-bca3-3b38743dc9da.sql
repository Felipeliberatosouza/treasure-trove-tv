UPDATE public.profiles p
SET phone_verified = true
WHERE p.phone_verified = false
  AND p.phone IS NOT NULL
  AND length(regexp_replace(p.phone, '\D', '', 'g')) >= 10
  AND EXISTS (
    SELECT 1 FROM public.phone_verifications v
    WHERE v.verified = true
      AND regexp_replace(v.phone, '\D', '', 'g') LIKE '%' || regexp_replace(p.phone, '\D', '', 'g')
  );