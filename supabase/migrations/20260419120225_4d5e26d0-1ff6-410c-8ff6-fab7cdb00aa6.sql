-- Add monthly content goal override per teacher
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS monthly_content_goal integer;

-- Insert default global goal in platform_settings
INSERT INTO public.platform_settings (key, value)
VALUES ('teacher_content_goal', '{"monthly_goal": 8}'::jsonb)
ON CONFLICT (key) DO NOTHING;