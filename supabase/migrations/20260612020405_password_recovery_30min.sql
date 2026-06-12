-- Atualiza o texto padrão do template de recuperação de senha para refletir
-- a nova expiração configurada (30 minutos).
UPDATE public.email_templates
SET body_html = REPLACE(body_html, 'expira em 1 hora', 'expira em 30 minutos')
WHERE template_key = 'password_recovery'
  AND body_html LIKE '%expira em 1 hora%';
