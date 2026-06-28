
INSERT INTO public.email_templates (template_key, subject, body_html, show_social_footer)
VALUES (
  'cashback_referral_share',
  'Seu link de indicação da {{platform_name}} 🎁',
  $$<h1>Pronto para indicar amigos? 🎁</h1>
<p>Olá, {{name}}! Aqui está tudo que você precisa para convidar amigos para a {{platform_name}}. A cada amigo que fizer a primeira compra usando seu código ou link, você ganha <strong>{{referral_percent}}% de cashback</strong> sobre o valor.</p>

<p style="font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;margin:16px 0 6px;">Seu código de indicação</p>
<div style="background-color:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:14px;text-align:center;">
  <p style="font-size:22px;font-weight:bold;color:#dc2626;letter-spacing:4px;margin:0;font-family:monospace;">{{referral_code}}</p>
</div>

<p style="font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;margin:16px 0 6px;">Seu link de indicação</p>
<div style="background-color:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px;">
  <p style="font-size:13px;color:#374151;margin:0;word-break:break-all;">{{referral_link}}</p>
</div>

<p style="text-align:center;margin:24px 0;">
  <a href="{{referral_link}}" style="background-color:#dc2626;color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:bold;display:inline-block;">Abrir meu link</a>
</p>

<p style="font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;margin:16px 0 6px;">Texto pronto para compartilhar</p>
<div style="background-color:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:14px;">
  <p style="font-size:14px;color:#374151;line-height:1.6;margin:0;white-space:pre-wrap;">{{share_text}}</p>
</div>
<p style="font-size:12px;color:#6b7280;margin:8px 0 0;font-style:italic;">Copie e cole no WhatsApp, Instagram, e-mail ou onde preferir.</p>$$,
  true
)
ON CONFLICT (template_key) DO NOTHING;
