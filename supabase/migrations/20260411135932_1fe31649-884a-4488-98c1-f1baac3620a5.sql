INSERT INTO public.platform_settings (key, value)
VALUES ('teacher_banner', '{
  "title": "Você é Professor?",
  "subtitle": "Faça parte da Revisão Fácil! Ganhe conosco!",
  "cta_text": "Cadastre-se como Professor",
  "cta_link": "/cadastro-professor",
  "background_image_url": ""
}'::jsonb)
ON CONFLICT (key) DO NOTHING;