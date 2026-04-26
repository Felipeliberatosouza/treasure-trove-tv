UPDATE public.platform_settings
SET value = jsonb_set(value, '{logo_url}', '"https://uzhajthlokwglujtgmgm.supabase.co/storage/v1/object/public/platform-assets/logo%2Flogo-revisaofacil-final-v5.png"'::jsonb),
    updated_at = now()
WHERE key = 'branding';

UPDATE public.email_templates
SET 
  logo_url = (SELECT value->>'logo_url' FROM public.platform_settings WHERE key = 'branding'),
  use_uploaded_logo = true,
  updated_at = now()
WHERE logo_url IS NOT NULL;