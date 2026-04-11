UPDATE platform_settings 
SET value = jsonb_set(value::jsonb, '{cta_link}', '"/signup/teacher"')::json
WHERE key = 'teacher_banner';