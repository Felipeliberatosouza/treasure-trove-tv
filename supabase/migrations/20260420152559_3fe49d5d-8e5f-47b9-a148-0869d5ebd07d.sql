-- Adiciona campos de remetente personalizado por template
ALTER TABLE public.email_templates
  ADD COLUMN IF NOT EXISTS from_email TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS from_name TEXT NOT NULL DEFAULT '';

-- Garante que o template de recuperação de senha exista
INSERT INTO public.email_templates (
  template_key, subject, body_html, always_send, respect_marketing_preference,
  from_email, from_name
)
VALUES (
  'password_recovery',
  'Recuperação de senha - {{platform_name}}',
  '<p>Olá {{name}},</p><p>Recebemos uma solicitação para redefinir a senha da sua conta na <strong>{{platform_name}}</strong>.</p><p>Clique no botão abaixo para criar uma nova senha. Este link expira em 1 hora.</p><p style="text-align:center;margin:24px 0;"><a href="{{recovery_link}}" style="background:#6366f1;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;">Redefinir minha senha</a></p><p>Se você não solicitou a recuperação de senha, ignore este e-mail. Sua senha permanece inalterada.</p><p style="color:#6b7280;font-size:12px;">Por motivos de segurança, nunca compartilhe este link com terceiros.</p>',
  true,
  false,
  '',
  ''
)
ON CONFLICT (template_key) DO NOTHING;