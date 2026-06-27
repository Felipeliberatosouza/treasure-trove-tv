UPDATE public.email_templates
SET
  from_name = 'Revisão Fácil',
  subject = 'Confirme seu e-mail para acessar a {{platform_name}}',
  body_html = $html$
<p style="margin:0 0 16px 0;font-size:16px;line-height:1.5;">Olá <strong>{{name}}</strong>,</p>

<p style="margin:0 0 16px 0;font-size:16px;line-height:1.5;">
  Recebemos seu cadastro na <strong>{{platform_name}}</strong>. Para ativar sua conta e começar a estudar, confirme seu e-mail clicando no botão abaixo:
</p>

<p style="text-align:center;margin:28px 0;">
  <a href="{{confirmation_link}}" style="background-color:#4f46e5;color:#ffffff;padding:14px 28px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:600;font-size:16px;">Confirmar meu e-mail</a>
</p>

<p style="margin:0 0 8px 0;font-size:14px;line-height:1.5;color:#6b7280;">
  Se o botão acima não funcionar, copie e cole o link abaixo no seu navegador:
</p>
<p style="margin:0 0 20px 0;font-size:13px;line-height:1.5;word-break:break-all;">
  <a href="{{confirmation_link}}" style="color:#4f46e5;">{{confirmation_link}}</a>
</p>

<p style="margin:0 0 16px 0;font-size:14px;line-height:1.5;color:#6b7280;">
  Este link é pessoal e expira em <strong>24 horas</strong> por motivos de segurança.
</p>

<p style="margin:0 0 16px 0;font-size:14px;line-height:1.5;color:#6b7280;">
  Se você não criou uma conta na {{platform_name}}, pode ignorar este e-mail com segurança — nenhuma conta será ativada.
</p>

<p style="margin:24px 0 0 0;font-size:14px;line-height:1.5;">
  Bons estudos,<br/>
  <strong>Equipe {{platform_name}}</strong>
</p>
$html$,
  show_social_footer = true,
  updated_at = now()
WHERE template_key = 'email_confirmation';