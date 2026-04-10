
-- Add phone and email_verified to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email_verified boolean DEFAULT false;

-- Phone verifications table
CREATE TABLE public.phone_verifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  phone text NOT NULL,
  code text NOT NULL,
  channel text NOT NULL DEFAULT 'sms',
  verified boolean NOT NULL DEFAULT false,
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '10 minutes'),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.phone_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own verifications"
  ON public.phone_verifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own verifications"
  ON public.phone_verifications FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own verifications"
  ON public.phone_verifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Email templates table (admin-editable)
CREATE TABLE public.email_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_key text NOT NULL UNIQUE,
  subject text NOT NULL DEFAULT '',
  body_html text NOT NULL DEFAULT '',
  logo_url text DEFAULT '',
  show_social_footer boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view email templates"
  ON public.email_templates FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Admins can insert email templates"
  ON public.email_templates FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update email templates"
  ON public.email_templates FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete email templates"
  ON public.email_templates FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_email_templates_updated_at
  BEFORE UPDATE ON public.email_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default templates
INSERT INTO public.email_templates (template_key, subject, body_html) VALUES
  ('email_confirmation', 'Confirme seu cadastro', '<h1>Confirme seu cadastro</h1><p>Olá {{name}},</p><p>Clique no link abaixo para confirmar seu cadastro na plataforma:</p><p><a href="{{confirmation_link}}" style="background-color:#4f46e5;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;">Confirmar Cadastro</a></p><p>Se você não solicitou este cadastro, ignore este e-mail.</p>'),
  ('welcome', 'Bem-vindo à plataforma!', '<h1>Bem-vindo, {{name}}!</h1><p>Seu cadastro foi confirmado com sucesso. Agora você já pode acessar todos os recursos da plataforma.</p><p><a href="{{login_link}}" style="background-color:#4f46e5;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;">Acessar Plataforma</a></p>');
