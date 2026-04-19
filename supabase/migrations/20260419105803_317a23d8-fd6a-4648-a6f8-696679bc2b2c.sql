-- Renomear template existente para deixar claro que é para não-assinantes (tipo 1) e criar template para assinantes ativos (tipo 2)

-- 1) Garantir que o template 'birthday' continue como template do TIPO 1 (não-assinantes / professores) — mantém cupom habilitado
-- Apenas atualizar o subject default caso esteja vazio (no-op se já configurado)

-- 2) Criar/garantir template 'birthday_subscriber' para alunos com assinatura ativa (TIPO 2) — SEM cupom
INSERT INTO public.email_templates (
  template_key,
  subject,
  body_html,
  coupon_enabled,
  coupon_code,
  coupon_message,
  always_send,
  respect_marketing_preference,
  show_social_footer,
  use_uploaded_logo
)
SELECT
  'birthday_subscriber',
  'Feliz Aniversário, {{name}}! 🎂',
  '<h1 style="text-align:center;">🎉 Feliz Aniversário, {{name}}! 🎂</h1><p style="text-align:center;font-size:16px;">A equipe da Revisão Fácil deseja a você um dia muito especial, cheio de alegria e realizações!</p><p style="text-align:center;font-size:14px;">Continue aproveitando ao máximo sua assinatura e evoluindo nos estudos. Estamos com você nessa jornada!</p><p style="text-align:center;margin-top:24px;"><a href="{{login_link}}" style="background-color:#4f46e5;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;">Acessar a Plataforma</a></p>',
  false,
  '',
  '',
  false,
  true,
  true,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.email_templates WHERE template_key = 'birthday_subscriber'
);