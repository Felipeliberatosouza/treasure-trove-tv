ALTER TABLE public.email_templates
  ADD COLUMN IF NOT EXISTS button_text_color TEXT NOT NULL DEFAULT '#ffffff';