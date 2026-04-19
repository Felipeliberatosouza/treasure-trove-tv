-- Tabela de log dos envios automáticos de e-mail de aniversário
CREATE TABLE public.birthday_email_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  recipient_email text NOT NULL,
  recipient_name text,
  template_key text NOT NULL,
  is_active_subscriber boolean NOT NULL DEFAULT false,
  coupon_included boolean NOT NULL DEFAULT false,
  coupon_code text,
  sent_at timestamp with time zone NOT NULL DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_birthday_email_log_sent_at ON public.birthday_email_log(sent_at DESC);
CREATE INDEX idx_birthday_email_log_user_id ON public.birthday_email_log(user_id);

ALTER TABLE public.birthday_email_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view birthday email log"
ON public.birthday_email_log
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role can insert birthday email log"
ON public.birthday_email_log
FOR INSERT
TO public
WITH CHECK (auth.role() = 'service_role'::text);

CREATE POLICY "Service role can read birthday email log"
ON public.birthday_email_log
FOR SELECT
TO public
USING (auth.role() = 'service_role'::text);