-- Add new birthday_teacher email template (for teachers only)
INSERT INTO public.email_templates (
  template_key,
  subject,
  body_html,
  show_social_footer,
  always_send,
  respect_marketing_preference,
  text_color,
  link_color,
  heading_color,
  button_color,
  font_family,
  use_uploaded_logo,
  coupon_enabled
)
SELECT
  'birthday_teacher',
  'Feliz aniversário, {{name}}! 🎉',
  '<h1>Parabéns, {{name}}!</h1>
<p>Hoje é um dia muito especial e nós, da equipe da plataforma, fazemos questão de celebrar com você. 🎂</p>
<p>Queremos agradecer profundamente pela sua parceria, pela dedicação em compartilhar conhecimento e por inspirar tantos alunos que aprendem com seus conteúdos. Sem professores como você, nada disso seria possível.</p>
<p>Que este novo ciclo seja repleto de saúde, conquistas, alunos engajados e muito sucesso na sua jornada como educador.</p>
<p style="text-align:center;margin:24px 0;">
  <a href="{{login_link}}" style="display:inline-block;padding:12px 24px;background:#6366f1;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Acessar minha área</a>
</p>
<p>Com carinho e gratidão,<br/>Equipe da Plataforma</p>',
  true,
  false,
  true,
  '#333333',
  '#6366f1',
  '#dc2626',
  '#6366f1',
  'Arial, sans-serif',
  true,
  false
WHERE NOT EXISTS (
  SELECT 1 FROM public.email_templates WHERE template_key = 'birthday_teacher'
);

-- Update existing birthday template body to focus on student motivation (only if it's still the default/empty)
UPDATE public.email_templates
SET body_html = '<h1>Feliz aniversário, {{name}}! 🎉</h1>
<p>Hoje é seu dia, e queremos celebrar com você! 🎂</p>
<p>Que este novo ciclo seja repleto de aprendizados, conquistas e descobertas. Lembre-se: cada vídeo assistido, cada exercício resolvido e cada conceito revisado é um passo a mais rumo aos seus objetivos.</p>
<p>Continue estudando com determinação — o conhecimento é o melhor presente que você pode dar a si mesmo. 💪📚</p>
{{recommended_video_block}}
<p style="text-align:center;margin:24px 0;">
  <a href="{{login_link}}" style="display:inline-block;padding:12px 24px;background:#6366f1;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Continuar estudando</a>
</p>
<p>Conte com a gente nessa jornada!<br/>Equipe da Plataforma</p>'
WHERE template_key = 'birthday'
  AND (body_html IS NULL OR body_html = '' OR body_html NOT LIKE '%recommended_video_block%');

-- Update birthday_subscriber template body
UPDATE public.email_templates
SET body_html = '<h1>Feliz aniversário, {{name}}! 🎉</h1>
<p>Hoje é o seu dia e queremos celebrar com você! 🎂</p>
<p>Obrigado por confiar na nossa plataforma para acompanhar seus estudos. Sua jornada inspira e nos motiva a continuar trazendo o melhor conteúdo.</p>
<p>Que este novo ciclo seja cheio de aprovações, conquistas e muito conhecimento. Continue firme — você está no caminho certo! 💪📚</p>
{{recommended_video_block}}
<p style="text-align:center;margin:24px 0;">
  <a href="{{login_link}}" style="display:inline-block;padding:12px 24px;background:#6366f1;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Continuar estudando</a>
</p>
<p>Bons estudos e muitas felicidades!<br/>Equipe da Plataforma</p>'
WHERE template_key = 'birthday_subscriber'
  AND (body_html IS NULL OR body_html = '' OR body_html NOT LIKE '%recommended_video_block%');