
-- Seed three secondary banner settings (visitor, student, teacher) using the hero carousel shape.
-- Migrate any pre-existing legacy 'teacher_banner' single-shape into 'secondary_banner' as the first slide.

INSERT INTO public.platform_settings (key, value)
SELECT 'secondary_banner', jsonb_build_object(
  'slides', jsonb_build_array(
    COALESCE(
      (SELECT jsonb_build_object(
        'title', COALESCE(value->>'title', 'Você é Professor?'),
        'subtitle', COALESCE(value->>'subtitle', 'Faça parte da Revisão Fácil! Ganhe conosco!'),
        'cta_text', COALESCE(value->>'cta_text', 'Cadastre-se como Professor'),
        'cta_link', COALESCE(value->>'cta_link', '/signup/teacher'),
        'banner_image_url', COALESCE(value->>'background_image_url', '')
       )
       FROM public.platform_settings WHERE key = 'teacher_banner' LIMIT 1),
      jsonb_build_object(
        'title', 'Você é Professor?',
        'subtitle', 'Faça parte da Revisão Fácil! Ganhe conosco!',
        'cta_text', 'Cadastre-se como Professor',
        'cta_link', '/signup/teacher',
        'banner_image_url', ''
      )
    )
  ),
  'autoplay_seconds', 6
)
WHERE NOT EXISTS (SELECT 1 FROM public.platform_settings WHERE key = 'secondary_banner');

INSERT INTO public.platform_settings (key, value)
SELECT 'secondary_banner_student', jsonb_build_object(
  'slides', jsonb_build_array(jsonb_build_object(
    'title', 'Indique e ganhe',
    'subtitle', 'Compartilhe a Revisão Fácil com seus colegas e ganhe benefícios.',
    'cta_text', 'Saiba mais',
    'cta_link', '/painel-aluno',
    'banner_image_url', ''
  )),
  'autoplay_seconds', 6
)
WHERE NOT EXISTS (SELECT 1 FROM public.platform_settings WHERE key = 'secondary_banner_student');

INSERT INTO public.platform_settings (key, value)
SELECT 'secondary_banner_teacher', jsonb_build_object(
  'slides', jsonb_build_array(jsonb_build_object(
    'title', 'Publique seu próximo conteúdo',
    'subtitle', 'Crie aulas e resoluções para alcançar mais alunos.',
    'cta_text', 'Ir para o painel',
    'cta_link', '/painel-professor',
    'banner_image_url', ''
  )),
  'autoplay_seconds', 6
)
WHERE NOT EXISTS (SELECT 1 FROM public.platform_settings WHERE key = 'secondary_banner_teacher');
