UPDATE public.email_templates
SET
  logo_url = (
    SELECT value->>'logo_url'
    FROM public.platform_settings
    WHERE key = 'branding'
  ),
  use_uploaded_logo = true,
  updated_at = now()
WHERE logo_url IS NOT NULL
  AND logo_url <> (
    SELECT value->>'logo_url'
    FROM public.platform_settings
    WHERE key = 'branding'
  );