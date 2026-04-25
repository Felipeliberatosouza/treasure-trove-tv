UPDATE public.platform_settings
SET value = jsonb_set(
  jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          value,
          '{logo_url}', '"https://uzhajthlokwglujtgmgm.supabase.co/storage/v1/object/public/platform-assets/logo%2Flogo-revisaofacil-cobalt-white-check.png"'::jsonb
        ),
        '{primary_color}', '"#0047AB"'::jsonb
      ),
      '{accent_color}', '"#FFD700"'::jsonb
    ),
    '{secondary_color}', '"#FFFFFF"'::jsonb
  ),
  '{background_color}', '"#0F1419"'::jsonb
)
WHERE key = 'branding';