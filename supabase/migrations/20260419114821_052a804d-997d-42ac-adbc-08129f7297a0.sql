-- 1. Reengagement email log
CREATE TABLE public.reengagement_email_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  template_key TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  days_inactive INTEGER,
  metadata JSONB DEFAULT '{}'::jsonb,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_reengagement_log_user_template ON public.reengagement_email_log(user_id, template_key, sent_at DESC);
CREATE INDEX idx_reengagement_log_sent_at ON public.reengagement_email_log(sent_at DESC);

ALTER TABLE public.reengagement_email_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view reengagement log"
  ON public.reengagement_email_log FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role can insert reengagement log"
  ON public.reengagement_email_log FOR INSERT
  TO public
  WITH CHECK (auth.role() = 'service_role'::text);

CREATE POLICY "Service role can read reengagement log"
  ON public.reengagement_email_log FOR SELECT
  TO public
  USING (auth.role() = 'service_role'::text);

-- 2. Email templates
INSERT INTO public.email_templates (template_key, subject, body_html, heading_color, button_color, link_color, respect_marketing_preference, always_send)
VALUES
  ('reengagement_student',
   'Sentimos sua falta! Veja o que está bombando na Revisão Fácil 🎯',
   '',
   '#dc2626',
   '#6366f1',
   '#6366f1',
   false,
   true),
  ('reengagement_teacher',
   'Seu impacto na Revisão Fácil + quanto você pode ganhar 💰',
   '',
   '#0891b2',
   '#0891b2',
   '#0891b2',
   false,
   true)
ON CONFLICT (template_key) DO NOTHING;

-- 3. Platform settings
INSERT INTO public.platform_settings (key, value)
VALUES (
  'reengagement_config',
  jsonb_build_object(
    'student_inactive_days', 14,
    'teacher_inactive_days', 30,
    'resend_interval_days', 30,
    'enabled', true,
    'cron_hour_brt', 9
  )
)
ON CONFLICT (key) DO NOTHING;