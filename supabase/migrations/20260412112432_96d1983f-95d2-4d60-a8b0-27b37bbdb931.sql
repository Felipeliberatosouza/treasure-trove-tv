ALTER TABLE public.email_templates
  ADD COLUMN heading_color text NOT NULL DEFAULT '#dc2626',
  ADD COLUMN button_color text NOT NULL DEFAULT '#6366f1';
