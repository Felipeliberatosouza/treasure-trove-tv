ALTER TABLE public.email_templates
ADD COLUMN IF NOT EXISTS slogan_color text NOT NULL DEFAULT '#6b7280';