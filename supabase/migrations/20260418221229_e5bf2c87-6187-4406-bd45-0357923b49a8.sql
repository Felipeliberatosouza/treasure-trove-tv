INSERT INTO public.platform_settings (key, value)
VALUES 
  ('hero_banner_student', '{"title": "Continue seus estudos hoje", "subtitle": "Aulas, resumos e simulados sob medida para você dominar a próxima prova.", "cta_text": "Ver minhas aulas", "cta_link": "/dashboard/aluno", "banner_image_url": ""}'::jsonb),
  ('hero_banner_teacher', '{"title": "Compartilhe seu conhecimento e ganhe", "subtitle": "Grave aulas, responda dúvidas e amplie sua audiência na maior plataforma de revisão.", "cta_text": "Ir para o painel", "cta_link": "/dashboard/professor", "banner_image_url": ""}'::jsonb)
ON CONFLICT (key) DO NOTHING;