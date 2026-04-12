
-- Add new columns to email_templates
ALTER TABLE public.email_templates
  ADD COLUMN IF NOT EXISTS always_send boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS respect_marketing_preference boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS text_color text NOT NULL DEFAULT '#333333',
  ADD COLUMN IF NOT EXISTS link_color text NOT NULL DEFAULT '#6366f1',
  ADD COLUMN IF NOT EXISTS font_family text NOT NULL DEFAULT 'Arial, sans-serif',
  ADD COLUMN IF NOT EXISTS use_uploaded_logo boolean NOT NULL DEFAULT true;

-- Create security notifications table
CREATE TABLE public.security_notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL,
  template_key text NOT NULL,
  subject text NOT NULL DEFAULT '',
  ip_address text,
  user_agent text,
  status text NOT NULL DEFAULT 'pending',
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.security_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can create security notifications"
  ON public.security_notifications FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can view security notifications"
  ON public.security_notifications FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update security notifications"
  ON public.security_notifications FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_security_notifications_updated_at
  BEFORE UPDATE ON public.security_notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
