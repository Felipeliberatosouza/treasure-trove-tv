INSERT INTO public.email_templates (template_key, subject, body_html, show_social_footer)
VALUES (
  'doubt_question_approved',
  'Sua dúvida foi aprovada! - {{platform_name}}',
  '<h1>Sua dúvida foi aprovada!</h1>'
  '<p>Olá, {{student_name}}!</p>'
  '<p>Sua dúvida foi analisada e aprovada pela nossa equipe. O professor já foi notificado e irá responder em breve.</p>'
  '<p style="font-size:13px;color:#6b7280;font-weight:bold;margin-bottom:4px;">Sua pergunta:</p>'
  '<p style="font-style:italic;background-color:#f9fafb;padding:12px 16px;border-radius:6px;">"{{question}}"</p>'
  '<hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0;" />'
  '<p>Te avisaremos por e-mail assim que a resposta estiver disponível. Fique de olho! 📚</p>'
  '<p style="font-size:12px;color:#9ca3af;margin-top:30px;">Equipe {{platform_name}}</p>',
  true
)
ON CONFLICT (template_key) DO NOTHING;