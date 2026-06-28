INSERT INTO public.email_templates (template_key, subject, body_html)
VALUES (
  'password_changed_admin',
  'Sua senha foi alterada - {{platform_name}}',
  '<h1 style="color:#dc2626;">Sua senha foi alterada 🔐</h1>'
  '<p>Olá {{name}},</p>'
  '<p>Informamos que a senha da sua conta na <strong>{{platform_name}}</strong> foi alterada em {{changed_at}} pela nossa equipe de suporte.</p>'
  '<p><strong>Se você solicitou essa alteração</strong>, já pode acessar sua conta normalmente com a nova senha informada pelo suporte. Recomendamos que altere a senha em seguida.</p>'
  '<hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;" />'
  '<p style="color:#b45309;font-weight:600;">⚠️ Se você NÃO solicitou essa alteração, entre em contato imediatamente com o suporte da {{platform_name}} por questões de segurança:</p>'
  '<p>• E-mail: <a href="mailto:{{support_email}}" style="color:#6366f1;">{{support_email}}</a></p>'
  '<p>• WhatsApp: <a href="https://wa.me/{{support_whatsapp}}" style="color:#6366f1;">{{support_whatsapp}}</a></p>'
  '<p style="text-align:center;margin:24px 0;"><a href="mailto:{{support_email}}" style="background-color:#6366f1;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;">Falar com o suporte</a></p>'
  '<p style="font-size:12px;color:#6b7280;">Esta é uma notificação automática de segurança. Por favor, não compartilhe sua senha com ninguém.</p>'
)
ON CONFLICT (template_key) DO NOTHING;