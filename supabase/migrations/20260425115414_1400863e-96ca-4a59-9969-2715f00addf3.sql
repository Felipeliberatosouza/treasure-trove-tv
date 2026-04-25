UPDATE public.platform_settings
SET value = jsonb_set(
  value,
  '{logo_url}',
  '"https://uzhajthlokwglujtgmgm.supabase.co/storage/v1/object/public/platform-assets/logo%2Flogo-revisaofacil-final-v2.png"'::jsonb
)
WHERE key = 'branding';